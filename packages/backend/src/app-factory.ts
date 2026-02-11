import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import type { ServerConfig } from "./server-config.js";
import databasePlugin from "./plugins/database-plugin.js";
import redisPlugin from "./plugins/redis-plugin.js";
import socketIoPlugin from "./plugins/socket-io-plugin.js";
import errorHandlerHook from "./hooks/error-handler-hook.js";

// Routes
import authRoutes from "./routes/auth/auth-routes.js";
import nodeRoutes from "./routes/node/node-routes.js";
import nodeComparisonRoutes from "./routes/node/node-comparison-routes.js";
import nodeHeatmapRoutes from "./routes/node/node-heatmap-routes.js";
import metricsIngestionRoutes from "./routes/metrics/metrics-ingestion-routes.js";
import metricsQueryRoutes from "./routes/metrics/metrics-query-routes.js";
import dashboardMetricsRoutes from "./routes/metrics/dashboard-metrics-routes.js";
import nodeMetricsRoutes from "./routes/metrics/node-metrics-routes.js";
import ipRoutes from "./routes/ip/ip-routes.js";
import ipWarmupRoutes from "./routes/ip/ip-warmup-routes.js";
import ipPoolRoutes from "./routes/ip/ip-pool-routes.js";
import zonemtaClusterRoutes from "./routes/zonemta/zonemta-cluster-routes.js";
import mongodbClusterRoutes from "./routes/mongodb/mongodb-cluster-routes.js";
import overviewRoutes from "./routes/overview/overview-routes.js";
import eventIngestionRoutes from "./routes/events/event-ingestion-routes.js";
import emailThroughputRoutes from "./routes/email/email-throughput-routes.js";
import domainQualityRoutes from "./routes/domains/domain-quality-routes.js";
import destinationAnalysisRoutes from "./routes/destinations/destination-analysis-routes.js";
import ipReputationRoutes from "./routes/ip-reputation/ip-reputation-routes.js";
import mailUserAnalyticsRoutes from "./routes/users/mail-user-analytics-routes.js";
import rspamdDashboardRoutes from "./routes/spam-security/rspamd-dashboard-routes.js";
import authMonitoringRoutes from "./routes/spam-security/auth-monitoring-routes.js";
import authEventIngestionRoutes from "./routes/spam-security/auth-event-ingestion-routes.js";
import tlsMonitoringRoutes from "./routes/spam-security/tls-monitoring-routes.js";
import emailEventSearchRoutes from "./routes/logs/email-event-search-routes.js";
import savedSearchRoutes from "./routes/logs/saved-search-routes.js";
import alertActiveAndHistoryRoutes from "./routes/alerts/alert-active-and-history-routes.js";
import alertRuleCrudRoutes from "./routes/alerts/alert-rule-crud-routes.js";
import alertActionRoutes from "./routes/alerts/alert-action-routes.js";
import notificationChannelCrudRoutes from "./routes/alerts/notification-channel-crud-routes.js";
import reportDataRoutes from "./routes/reports/report-data-routes.js";
import dataExportRoutes from "./routes/reports/data-export-routes.js";
import dashboardUserCrudRoutes from "./routes/admin/dashboard-user-crud-routes.js";
import systemSettingsRoutes from "./routes/admin/system-settings-routes.js";
import auditLogQueryRoutes from "./routes/admin/audit-log-query-routes.js";
import agentVersionCheckRoutes from "./routes/agents/agent-version-check-routes.js";
import agentUpdateRequestRoutes from "./routes/admin/agent-update-request-routes.js";
import nodeDeleteAndBlockRoutes from "./routes/admin/node-delete-and-block-routes.js";

// Augment Fastify with config
declare module "fastify" {
  interface FastifyInstance {
    config: ServerConfig;
  }
}

export async function buildApp(config: ServerConfig) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Config accessible on app instance
  app.decorate("config", config);

  // CORS
  await app.register(cors, {
    origin: config.NODE_ENV === "development"
      ? true
      : config.CORS_ORIGIN
        ? config.CORS_ORIGIN.split(",").map((o) => o.trim())
        : false,
    credentials: true,
  });

  // JWT
  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  // Rate limiting
  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
  });

  // Plugins
  await app.register(databasePlugin);
  await app.register(redisPlugin);
  await app.register(socketIoPlugin);

  // Error handler
  app.setErrorHandler(errorHandlerHook);

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // API Routes (all under /api/v1)
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(nodeRoutes, { prefix: "/api/v1/nodes" });
  await app.register(nodeComparisonRoutes, { prefix: "/api/v1/nodes/comparison" });
  await app.register(nodeHeatmapRoutes, { prefix: "/api/v1/nodes/heatmap" });
  await app.register(metricsIngestionRoutes, { prefix: "/api/v1/metrics" });
  await app.register(metricsQueryRoutes, { prefix: "/api/v1/metrics" });
  await app.register(dashboardMetricsRoutes, { prefix: "/api/v1/metrics" });
  await app.register(nodeMetricsRoutes, { prefix: "/api/v1/metrics" });
  await app.register(ipRoutes, { prefix: "/api/v1/ips" });
  await app.register(ipWarmupRoutes, { prefix: "/api/v1/ips" });
  await app.register(ipPoolRoutes, { prefix: "/api/v1/ips" });
  await app.register(zonemtaClusterRoutes, { prefix: "/api/v1/zonemta" });
  await app.register(mongodbClusterRoutes, { prefix: "/api/v1/mongodb" });
  await app.register(overviewRoutes, { prefix: "/api/v1/overview" });
  await app.register(eventIngestionRoutes, { prefix: "/api/v1/events" });
  await app.register(emailThroughputRoutes, { prefix: "/api/v1/email" });
  await app.register(domainQualityRoutes, { prefix: "/api/v1/domains" });
  await app.register(destinationAnalysisRoutes, { prefix: "/api/v1/destinations" });
  await app.register(ipReputationRoutes, { prefix: "/api/v1/ip-reputation" });
  await app.register(mailUserAnalyticsRoutes, { prefix: "/api/v1/mail-users" });
  await app.register(rspamdDashboardRoutes, { prefix: "/api/v1/spam/rspamd" });
  await app.register(authMonitoringRoutes, { prefix: "/api/v1/security/auth" });
  await app.register(authEventIngestionRoutes, { prefix: "/api/v1/security/auth" });
  await app.register(tlsMonitoringRoutes, { prefix: "/api/v1/security/tls" });
  await app.register(emailEventSearchRoutes, { prefix: "/api/v1/logs" });
  await app.register(savedSearchRoutes, { prefix: "/api/v1/logs" });
  await app.register(alertActiveAndHistoryRoutes, { prefix: "/api/v1/alerts" });
  await app.register(alertRuleCrudRoutes, { prefix: "/api/v1/alerts" });
  await app.register(alertActionRoutes, { prefix: "/api/v1/alerts" });
  await app.register(notificationChannelCrudRoutes, { prefix: "/api/v1/alerts" });
  await app.register(reportDataRoutes, { prefix: "/api/v1/reports" });
  await app.register(dataExportRoutes, { prefix: "/api/v1/export" });
  await app.register(dashboardUserCrudRoutes, { prefix: "/api/v1/admin" });
  await app.register(systemSettingsRoutes, { prefix: "/api/v1/admin" });
  await app.register(auditLogQueryRoutes, { prefix: "/api/v1/admin" });
  await app.register(agentVersionCheckRoutes, { prefix: "/api/v1/agents" });
  await app.register(agentUpdateRequestRoutes, { prefix: "/api/v1/admin" });
  await app.register(nodeDeleteAndBlockRoutes, { prefix: "/api/v1/admin" });

  return app;
}
