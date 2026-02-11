-- TimescaleDB setup: hypertables, continuous aggregates, retention, compression
-- Run AFTER Drizzle migrations create the base tables

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- HYPERTABLES
-- ============================================================

SELECT create_hypertable('metrics_system', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
SELECT create_hypertable('metrics_mongodb', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
SELECT create_hypertable('metrics_redis', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
SELECT create_hypertable('metrics_zonemta', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
SELECT create_hypertable('metrics_rspamd', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
SELECT create_hypertable('email_events', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
SELECT create_hypertable('blacklist_checks', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- ============================================================
-- CONTINUOUS AGGREGATES
-- ============================================================

-- Drop if they exist as regular views or non-continuous aggregates (from previous runs)
DROP VIEW IF EXISTS email_stats_daily CASCADE;
DROP VIEW IF EXISTS email_stats_1h CASCADE;
DROP VIEW IF EXISTS email_stats_5m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS email_stats_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS email_stats_1h CASCADE;
DROP MATERIALIZED VIEW IF EXISTS email_stats_5m CASCADE;

-- Email stats rolled up every 5 minutes
CREATE MATERIALIZED VIEW IF NOT EXISTS email_stats_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  from_domain,
  mta_node,
  sending_ip,
  event_type,
  COUNT(*) AS event_count,
  AVG(delivery_time_ms) AS avg_delivery_ms,
  AVG(message_size) AS avg_message_size,
  SUM(CASE WHEN dkim_result = 'pass' THEN 1 ELSE 0 END) AS dkim_pass,
  SUM(CASE WHEN spf_result = 'pass' THEN 1 ELSE 0 END) AS spf_pass,
  SUM(CASE WHEN dmarc_result = 'pass' THEN 1 ELSE 0 END) AS dmarc_pass
FROM email_events
GROUP BY bucket, from_domain, mta_node, sending_ip, event_type
WITH NO DATA;

-- Email stats rolled up every 1 hour
CREATE MATERIALIZED VIEW IF NOT EXISTS email_stats_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  from_domain,
  to_domain,
  mta_node,
  event_type,
  COUNT(*) AS event_count,
  AVG(delivery_time_ms) AS avg_delivery_ms
FROM email_events
GROUP BY bucket, from_domain, to_domain, mta_node, event_type
WITH NO DATA;

-- Email stats rolled up daily (for reports)
CREATE MATERIALIZED VIEW IF NOT EXISTS email_stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  from_domain,
  from_user,
  to_domain,
  mta_node,
  sending_ip,
  event_type,
  COUNT(*) AS event_count,
  AVG(delivery_time_ms) AS avg_delivery_ms,
  AVG(message_size) AS avg_message_size
FROM email_events
GROUP BY bucket, from_domain, from_user, to_domain, mta_node, sending_ip, event_type
WITH NO DATA;

-- MongoDB stats rolled up every 5 minutes
DROP VIEW IF EXISTS mongodb_stats_5m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mongodb_stats_5m CASCADE;
CREATE MATERIALIZED VIEW IF NOT EXISTS mongodb_stats_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  node_id,
  last(role, time) AS role,
  AVG(connections_current) AS connections_current,
  AVG(connections_available) AS connections_available,
  SUM(ops_insert) AS ops_insert,
  SUM(ops_query) AS ops_query,
  SUM(ops_update) AS ops_update,
  SUM(ops_delete) AS ops_delete,
  SUM(ops_command) AS ops_command,
  AVG(repl_lag_seconds) AS repl_lag_seconds,
  MAX(data_size_bytes) AS data_size_bytes,
  MAX(index_size_bytes) AS index_size_bytes,
  MAX(storage_size_bytes) AS storage_size_bytes,
  AVG(oplog_window_hours) AS oplog_window_hours,
  AVG(wt_cache_used_bytes) AS wt_cache_used_bytes,
  AVG(wt_cache_max_bytes) AS wt_cache_max_bytes
FROM metrics_mongodb
GROUP BY bucket, node_id
WITH NO DATA;

-- MongoDB stats rolled up every 1 hour
DROP VIEW IF EXISTS mongodb_stats_1h CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mongodb_stats_1h CASCADE;
CREATE MATERIALIZED VIEW IF NOT EXISTS mongodb_stats_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  node_id,
  last(role, time) AS role,
  AVG(connections_current) AS connections_current,
  AVG(connections_available) AS connections_available,
  SUM(ops_insert) AS ops_insert,
  SUM(ops_query) AS ops_query,
  SUM(ops_update) AS ops_update,
  SUM(ops_delete) AS ops_delete,
  SUM(ops_command) AS ops_command,
  AVG(repl_lag_seconds) AS repl_lag_seconds,
  MAX(data_size_bytes) AS data_size_bytes,
  MAX(index_size_bytes) AS index_size_bytes,
  MAX(storage_size_bytes) AS storage_size_bytes,
  AVG(oplog_window_hours) AS oplog_window_hours,
  AVG(wt_cache_used_bytes) AS wt_cache_used_bytes,
  AVG(wt_cache_max_bytes) AS wt_cache_max_bytes
FROM metrics_mongodb
GROUP BY bucket, node_id
WITH NO DATA;

-- MongoDB stats rolled up daily
DROP VIEW IF EXISTS mongodb_stats_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mongodb_stats_daily CASCADE;
CREATE MATERIALIZED VIEW IF NOT EXISTS mongodb_stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  node_id,
  last(role, time) AS role,
  AVG(connections_current) AS connections_current,
  AVG(connections_available) AS connections_available,
  SUM(ops_insert) AS ops_insert,
  SUM(ops_query) AS ops_query,
  SUM(ops_update) AS ops_update,
  SUM(ops_delete) AS ops_delete,
  SUM(ops_command) AS ops_command,
  AVG(repl_lag_seconds) AS repl_lag_seconds,
  MAX(data_size_bytes) AS data_size_bytes,
  MAX(index_size_bytes) AS index_size_bytes,
  MAX(storage_size_bytes) AS storage_size_bytes,
  AVG(oplog_window_hours) AS oplog_window_hours,
  AVG(wt_cache_used_bytes) AS wt_cache_used_bytes,
  AVG(wt_cache_max_bytes) AS wt_cache_max_bytes
FROM metrics_mongodb
GROUP BY bucket, node_id
WITH NO DATA;

-- ============================================================
-- CONTINUOUS AGGREGATE REFRESH POLICIES
-- ============================================================

SELECT add_continuous_aggregate_policy('mongodb_stats_5m',
  start_offset => INTERVAL '30 minutes',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('mongodb_stats_1h',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('mongodb_stats_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('email_stats_5m',
  start_offset => INTERVAL '30 minutes',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('email_stats_1h',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('email_stats_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE);

-- ============================================================
-- RETENTION POLICIES
-- ============================================================

SELECT add_retention_policy('metrics_system', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics_mongodb', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics_redis', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics_zonemta', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics_rspamd', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('email_events', INTERVAL '180 days', if_not_exists => TRUE);
SELECT add_retention_policy('blacklist_checks', INTERVAL '365 days', if_not_exists => TRUE);

-- ============================================================
-- COMPRESSION POLICIES (compress after 7 days)
-- ============================================================

ALTER TABLE metrics_system SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'node_id',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('metrics_system', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE metrics_mongodb SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'node_id',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('metrics_mongodb', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE metrics_redis SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'node_id',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('metrics_redis', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE metrics_zonemta SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'node_id',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('metrics_zonemta', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE metrics_rspamd SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'node_id',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('metrics_rspamd', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE email_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'from_domain',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('email_events', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE blacklist_checks SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'ip',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('blacklist_checks', INTERVAL '7 days', if_not_exists => TRUE);
