import type { NodeRegistrationPayload } from "@tinomail/shared";
import { AGENT_VERSION, type AgentConfig } from "./agent-config.js";
import { SystemMetricsCollector } from "./collectors/system-metrics-collector.js";
import { ProcessHealthCollector } from "./collectors/process-health-collector.js";
import { MongodbMetricsCollector } from "./collectors/mongodb-metrics-collector.js";
import { ServiceAutoDiscoveryCollector } from "./collectors/service-auto-discovery-collector.js";
import { ZonemtaMetricsCollector } from "./collectors/zonemta-metrics-collector.js";
import { ZonemtaEmailEventCollector } from "./collectors/zonemta-email-event-collector.js";
import { RedisMetricsCollector } from "./collectors/redis-metrics-collector.js";
import {
  HttpMetricsTransport,
  type TransportConfig,
} from "./transport/http-metrics-transport.js";
import { EventHttpTransport } from "./transport/event-http-transport.js";
import { OfflineMetricsBuffer } from "./transport/offline-metrics-buffer.js";
import { SelfUpdater } from "./self-updater.js";
import * as si from "systeminformation";

export class MonitoringAgent {
  private metricsCollector: SystemMetricsCollector;
  private processCollector: ProcessHealthCollector;
  private discoveryCollector: ServiceAutoDiscoveryCollector;
  private mongodbCollector: MongodbMetricsCollector | null = null;
  private zonemtaCollector: ZonemtaMetricsCollector | null = null;
  private emailEventCollector: ZonemtaEmailEventCollector | null = null;
  private redisCollector: RedisMetricsCollector | null = null;
  private transport: HttpMetricsTransport;
  private buffer: OfflineMetricsBuffer;
  private updater: SelfUpdater;

  private intervalId: NodeJS.Timeout | null = null;
  private mongodbIntervalId: NodeJS.Timeout | null = null;
  private zonemtaIntervalId: NodeJS.Timeout | null = null;
  private redisIntervalId: NodeJS.Timeout | null = null;
  private discoveryIntervalId: NodeJS.Timeout | null = null;
  private updateCheckIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private resolvedRole: string;

  constructor(private config: AgentConfig) {
    this.metricsCollector = new SystemMetricsCollector();
    this.processCollector = new ProcessHealthCollector();
    this.discoveryCollector = new ServiceAutoDiscoveryCollector();
    this.resolvedRole = config.AGENT_NODE_ROLE;

    if (config.AGENT_MONGODB_URI) {
      this.mongodbCollector = new MongodbMetricsCollector(config.AGENT_MONGODB_URI);
    }

    const transportConfig: TransportConfig = {
      serverUrl: config.AGENT_SERVER_URL,
      apiKey: config.AGENT_API_KEY,
      timeoutMs: 10000,
      maxRetries: 3,
    };

    this.transport = new HttpMetricsTransport(transportConfig);
    this.buffer = new OfflineMetricsBuffer();
    this.updater = new SelfUpdater({
      serverUrl: config.AGENT_SERVER_URL,
      apiKey: config.AGENT_API_KEY,
      nodeId: config.AGENT_NODE_ID,
      installDir: process.cwd(),
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Agent] Already running");
      return;
    }

    console.info("[Agent] Starting monitoring agent...");

    // Run auto-discovery before registration
    await this.runDiscovery();

    // Register node with dashboard
    await this.registerNode();

    // Initialize dynamic collectors based on discovered services
    this.initDynamicCollectors();

    // Connect email event collector (ZoneMTA change stream)
    if (this.emailEventCollector) {
      try {
        await this.emailEventCollector.connect();
        console.info("[Agent] ZoneMTA email event collector connected");
      } catch (error) {
        console.error("[Agent] ZoneMTA email event collector connection failed:", error);
        this.emailEventCollector = null;
      }
    }

    // Connect MongoDB collector if configured
    if (this.mongodbCollector) {
      try {
        await this.mongodbCollector.connect();
        console.info("[Agent] MongoDB collector connected");
      } catch (error) {
        console.error("[Agent] MongoDB collector connection failed:", error);
        this.mongodbCollector = null;
      }
    }

    this.isRunning = true;

    // Start system metrics collection loop
    this.intervalId = setInterval(() => {
      this.collectAndSend().catch((err) => {
        console.error("[Agent] Collection error:", err);
      });
    }, this.config.AGENT_HEARTBEAT_INTERVAL);

    // Start MongoDB collection loop
    if (this.mongodbCollector) {
      this.mongodbIntervalId = setInterval(() => {
        this.collectAndSendMongodb().catch((err) => {
          console.error("[Agent] MongoDB collection error:", err);
        });
      }, this.config.AGENT_MONGODB_INTERVAL);
      await this.collectAndSendMongodb().catch((err) => {
        console.error("[Agent] Initial MongoDB collection failed:", err);
      });
    }

    // Start ZoneMTA collection loop
    if (this.zonemtaCollector) {
      this.zonemtaIntervalId = setInterval(() => {
        this.collectAndSendZonemta().catch((err) => {
          console.error("[Agent] ZoneMTA collection error:", err);
        });
      }, this.config.AGENT_HEARTBEAT_INTERVAL);
      await this.collectAndSendZonemta().catch((err) => {
        console.error("[Agent] Initial ZoneMTA collection failed:", err);
      });
    }

    // Start Redis collection loop
    if (this.redisCollector) {
      this.redisIntervalId = setInterval(() => {
        this.collectAndSendRedis().catch((err) => {
          console.error("[Agent] Redis collection error:", err);
        });
      }, this.config.AGENT_MONGODB_INTERVAL); // 30s same as MongoDB
      await this.collectAndSendRedis().catch((err) => {
        console.error("[Agent] Initial Redis collection failed:", err);
      });
    }

    // Immediate first system metrics collection
    await this.collectAndSend();

    // Re-discovery loop (every 5 minutes)
    this.discoveryIntervalId = setInterval(() => {
      this.runDiscovery().catch((err) => {
        console.error("[Agent] Re-discovery error:", err);
      });
    }, this.config.AGENT_DISCOVERY_INTERVAL);

    // Auto-update check loop (every 5 minutes) + immediate first check
    const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
    this.updateCheckIntervalId = setInterval(() => {
      this.checkAndUpdate().catch((err) => {
        console.error("[Agent] Update check error:", err);
      });
    }, UPDATE_CHECK_INTERVAL);
    this.checkAndUpdate().catch((err) => {
      console.error("[Agent] Initial update check error:", err);
    });

    console.info(`[Agent] Started successfully (v${AGENT_VERSION})`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.info("[Agent] Stopping monitoring agent...");
    this.isRunning = false;

    const timers = [
      this.intervalId,
      this.mongodbIntervalId,
      this.zonemtaIntervalId,
      this.redisIntervalId,
      this.discoveryIntervalId,
      this.updateCheckIntervalId,
    ];
    for (const t of timers) {
      if (t) clearInterval(t);
    }
    this.intervalId = null;
    this.mongodbIntervalId = null;
    this.zonemtaIntervalId = null;
    this.redisIntervalId = null;
    this.discoveryIntervalId = null;
    this.updateCheckIntervalId = null;

    if (this.emailEventCollector) {
      await this.emailEventCollector.disconnect();
    }

    if (this.mongodbCollector) {
      await this.mongodbCollector.disconnect();
    }

    if (!this.buffer.isEmpty) {
      console.info(`[Agent] Flushing ${this.buffer.size} buffered metrics...`);
      await this.flushBuffer();
    }

    console.info("[Agent] Stopped");
  }

  /** Run service auto-discovery and resolve role */
  private async runDiscovery(): Promise<void> {
    const services = await this.discoveryCollector.discoverServices();
    console.info(`[Discovery] Detected services: [${services.join(", ")}]`);

    if (this.config.AGENT_NODE_ROLE === "auto") {
      this.resolvedRole = this.discoveryCollector.determinePrimaryRole();
      console.info(`[Discovery] Auto-resolved role: ${this.resolvedRole}`);
    }
  }

  /** Initialize ZoneMTA/Redis collectors based on discovered services */
  private initDynamicCollectors(): void {
    const services = this.discoveryCollector.services;

    if (services.includes("zonemta") && !this.zonemtaCollector) {
      this.zonemtaCollector = new ZonemtaMetricsCollector(
        this.config.AGENT_ZONEMTA_API_URL
      );
      console.info("[Agent] ZoneMTA collector enabled");

      // Enable email event collector if ZoneMTA MongoDB URI is configured
      if (this.config.AGENT_ZONEMTA_MONGODB_URI && !this.emailEventCollector) {
        const eventTransport = new EventHttpTransport({
          serverUrl: this.config.AGENT_SERVER_URL,
          apiKey: this.config.AGENT_API_KEY,
          timeoutMs: 10000,
          maxRetries: 3,
        });
        this.emailEventCollector = new ZonemtaEmailEventCollector(
          this.config.AGENT_ZONEMTA_MONGODB_URI,
          this.config.AGENT_NODE_ID,
          eventTransport,
        );
        console.info("[Agent] ZoneMTA email event collector enabled");
      }
    }

    if (services.includes("redis") && !this.redisCollector) {
      this.redisCollector = new RedisMetricsCollector(
        this.config.AGENT_REDIS_URL
      );
      console.info("[Agent] Redis collector enabled");
    }

    // MongoDB via discovery (if not already configured via env)
    if (services.includes("mongodb") && !this.mongodbCollector && !this.config.AGENT_MONGODB_URI) {
      this.mongodbCollector = new MongodbMetricsCollector("mongodb://localhost:27017");
      console.info("[Agent] MongoDB collector enabled (auto-discovered)");
    }
  }

  private async registerNode(): Promise<void> {
    try {
      const osInfo = await si.osInfo();
      const networkInterfaces = await si.networkInterfaces();
      const primaryInterface = networkInterfaces.find((iface) => !iface.internal);

      const payload: NodeRegistrationPayload = {
        nodeId: this.config.AGENT_NODE_ID,
        hostname: osInfo.hostname,
        ipAddress: primaryInterface?.ip4 || "unknown",
        role: this.resolvedRole,
        metadata: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch,
          agentVersion: AGENT_VERSION,
          detectedServices: this.discoveryCollector.services,
        },
      };

      const response = await fetch(
        `${this.config.AGENT_SERVER_URL}/api/v1/nodes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.config.AGENT_API_KEY,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
      }

      console.info(
        `[Agent] Registered as ${payload.nodeId} (${payload.role})`
      );
    } catch (error) {
      console.error("[Agent] Registration failed:", error);
      throw error;
    }
  }

  private async collectAndSend(): Promise<void> {
    try {
      const metrics = await this.metricsCollector.collect(
        this.config.AGENT_NODE_ID,
        this.resolvedRole
      );

      const processes = await this.processCollector.collect();
      const runningProcesses = processes.filter((p) => p.running);

      // Include process health in system metrics payload
      metrics.processes = processes;

      console.info(
        `[Agent] Metrics: CPU=${metrics.cpuPercent}% RAM=${metrics.ramPercent}% ` +
          `Load=${metrics.load1m.toFixed(2)} Processes=${runningProcesses.length}/${processes.length}`
      );

      if (!this.buffer.isEmpty) {
        await this.flushBuffer();
      }

      await this.transport.send({ type: "system", data: metrics });
    } catch (error) {
      console.error("[Agent] Failed to send metrics:", error);
      try {
        const metrics = await this.metricsCollector.collect(
          this.config.AGENT_NODE_ID,
          this.resolvedRole
        );
        this.buffer.push({ type: "system", data: metrics });
        console.info(`[Agent] Buffered metrics (${this.buffer.size}/100)`);
      } catch (collectError) {
        console.error("[Agent] Failed to collect metrics:", collectError);
      }
    }
  }

  private async collectAndSendMongodb(): Promise<void> {
    if (!this.mongodbCollector) return;
    try {
      const { metrics, events } = await this.mongodbCollector.collectAllWithEvents();
      for (const m of metrics) {
        await this.transport.send({ type: "mongodb", data: m });
      }
      if (events.length > 0) {
        await this.transport.send({ type: "mongodb_events", data: events });
      }
      console.info(
        `[Agent] MongoDB: ${metrics.length} members, ${events.length} events`
      );
    } catch (error) {
      console.error("[Agent] MongoDB metrics collection failed:", error);
    }
  }

  private async collectAndSendZonemta(): Promise<void> {
    if (!this.zonemtaCollector) return;
    try {
      const metrics = await this.zonemtaCollector.collect(this.config.AGENT_NODE_ID);
      await this.transport.send({ type: "zonemta", data: metrics });
      console.info(
        `[Agent] ZoneMTA: queue=${metrics.queueSize} sent=${metrics.sentTotal} delivered=${metrics.deliveredTotal}`
      );
    } catch (error) {
      console.error("[Agent] ZoneMTA metrics collection failed:", error);
    }
  }

  private async collectAndSendRedis(): Promise<void> {
    if (!this.redisCollector) return;
    try {
      const metrics = await this.redisCollector.collect(this.config.AGENT_NODE_ID);
      await this.transport.send({ type: "redis", data: metrics });
      console.info(
        `[Agent] Redis: memory=${(metrics.memoryUsedBytes / 1024 / 1024).toFixed(1)}MB clients=${metrics.connectedClients} ops=${metrics.opsPerSec}/s`
      );
    } catch (error) {
      console.error("[Agent] Redis metrics collection failed:", error);
    }
  }

  private async checkAndUpdate(): Promise<void> {
    await this.updater.checkAndApplyUpdates();
  }

  private async flushBuffer(): Promise<void> {
    const buffered = this.buffer.getAll();
    for (const payload of buffered) {
      try {
        await this.transport.send(payload);
      } catch (error) {
        console.error("[Agent] Failed to flush buffered metric:", error);
        return;
      }
    }
    this.buffer.clear();
    console.info("[Agent] Buffer flushed successfully");
  }
}
