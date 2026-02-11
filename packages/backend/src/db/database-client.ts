import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as metricsSystem from "./schema/metrics-system-hypertable.js";
import * as metricsMongodb from "./schema/metrics-mongodb-hypertable.js";
import * as metricsRedis from "./schema/metrics-redis-hypertable.js";
import * as metricsZonemta from "./schema/metrics-zonemta-hypertable.js";
import * as metricsRspamd from "./schema/metrics-rspamd-hypertable.js";
import * as emailEvents from "./schema/email-events-hypertable.js";
import * as blacklistChecks from "./schema/blacklist-checks-hypertable.js";
import * as nodes from "./schema/nodes-table.js";
import * as sendingIps from "./schema/sending-ips-table.js";
import * as sendingDomains from "./schema/sending-domains-table.js";
import * as alertRules from "./schema/alert-rules-table.js";
import * as alertEvents from "./schema/alert-events-table.js";
import * as dashboardUsers from "./schema/dashboard-users-table.js";
import * as savedViews from "./schema/saved-views-table.js";

export const schema = {
  ...metricsSystem,
  ...metricsMongodb,
  ...metricsRedis,
  ...metricsZonemta,
  ...metricsRspamd,
  ...emailEvents,
  ...blacklistChecks,
  ...nodes,
  ...sendingIps,
  ...sendingDomains,
  ...alertRules,
  ...alertEvents,
  ...dashboardUsers,
  ...savedViews,
};

export function createDb(connectionUrl: string) {
  const sql = postgres(connectionUrl, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
