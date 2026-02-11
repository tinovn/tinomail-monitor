import type { NodeRegistrationPayload } from "@tinomail/shared";
import { AGENT_VERSION, type AgentConfig } from "./agent-config.js";
import { SystemMetricsCollector } from "./collectors/system-metrics-collector.js";
import { ProcessHealthCollector } from "./collectors/process-health-collector.js";
import { MongodbMetricsCollector } from "./collectors/mongodb-metrics-collector.js";
import {
  HttpMetricsTransport,
  type TransportConfig,
} from "./transport/http-metrics-transport.js";
import { OfflineMetricsBuffer } from "./transport/offline-metrics-buffer.js";
import { SelfUpdater } from "./self-updater.js";
import * as si from "systeminformation";

export class MonitoringAgent {
  private metricsCollector: SystemMetricsCollector;
  private processCollector: ProcessHealthCollector;
  private mongodbCollector: MongodbMetricsCollector | null = null;
  private transport: HttpMetricsTransport;
  private buffer: OfflineMetricsBuffer;
  private updater: SelfUpdater;
  private intervalId: NodeJS.Timeout | null = null;
  private mongodbIntervalId: NodeJS.Timeout | null = null;
  private updateCheckIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private config: AgentConfig) {
    this.metricsCollector = new SystemMetricsCollector();
    this.processCollector = new ProcessHealthCollector();

    // Initialize MongoDB collector if URI is provided
    if (config.AGENT_MONGODB_URI) {
      this.mongodbCollector = new MongodbMetricsCollector(
        config.AGENT_MONGODB_URI
      );
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

    // Register node with dashboard
    await this.registerNode();

    // Connect MongoDB collector if configured
    if (this.mongodbCollector) {
      try {
        await this.mongodbCollector.connect();
        console.info("[Agent] MongoDB collector connected");
      } catch (error) {
        console.error("[Agent] MongoDB collector connection failed:", error);
        // Continue without MongoDB metrics
        this.mongodbCollector = null;
      }
    }

    // Start collection loop
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.collectAndSend().catch((error) => {
        console.error("[Agent] Collection error:", error);
      });
    }, this.config.AGENT_HEARTBEAT_INTERVAL);

    // Start MongoDB collection loop if available
    if (this.mongodbCollector) {
      this.mongodbIntervalId = setInterval(() => {
        this.collectAndSendMongodb().catch((error) => {
          console.error("[Agent] MongoDB collection error:", error);
        });
      }, this.config.AGENT_MONGODB_INTERVAL);

      // Immediate first MongoDB collection
      await this.collectAndSendMongodb().catch((error) => {
        console.error("[Agent] Initial MongoDB collection failed:", error);
      });
    }

    // Immediate first collection
    await this.collectAndSend();

    // Start auto-update check loop (every 5 minutes)
    const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
    this.updateCheckIntervalId = setInterval(() => {
      this.checkAndUpdate().catch((error) => {
        console.error("[Agent] Update check error:", error);
      });
    }, UPDATE_CHECK_INTERVAL);

    console.info(`[Agent] Started successfully (v${AGENT_VERSION})`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.info("[Agent] Stopping monitoring agent...");

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.mongodbIntervalId) {
      clearInterval(this.mongodbIntervalId);
      this.mongodbIntervalId = null;
    }

    if (this.updateCheckIntervalId) {
      clearInterval(this.updateCheckIntervalId);
      this.updateCheckIntervalId = null;
    }

    // Disconnect MongoDB collector
    if (this.mongodbCollector) {
      await this.mongodbCollector.disconnect();
    }

    // Flush remaining buffered metrics
    if (!this.buffer.isEmpty) {
      console.info(`[Agent] Flushing ${this.buffer.size} buffered metrics...`);
      await this.flushBuffer();
    }

    console.info("[Agent] Stopped");
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
        role: this.config.AGENT_NODE_ROLE,
        metadata: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch,
          agentVersion: AGENT_VERSION,
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
      // Collect system metrics
      const metrics = await this.metricsCollector.collect(
        this.config.AGENT_NODE_ID,
        this.config.AGENT_NODE_ROLE
      );

      // Collect process health (for logging only, not sent in this phase)
      const processes = await this.processCollector.collect();
      const runningProcesses = processes.filter((p) => p.running);

      console.info(
        `[Agent] Metrics: CPU=${metrics.cpuPercent}% RAM=${metrics.ramPercent}% ` +
          `Load=${metrics.load1m.toFixed(2)} Processes=${runningProcesses.length}/${processes.length}`
      );

      // Try to send buffered metrics first if any exist
      if (!this.buffer.isEmpty) {
        await this.flushBuffer();
      }

      // Send current metrics wrapped in payload
      await this.transport.send({ type: "system", data: metrics });
    } catch (error) {
      console.error("[Agent] Failed to send metrics:", error);

      // Buffer metrics for later if collection succeeded but transport failed
      try {
        const metrics = await this.metricsCollector.collect(
          this.config.AGENT_NODE_ID,
          this.config.AGENT_NODE_ROLE
        );
        this.buffer.push({ type: "system", data: metrics });
        console.info(
          `[Agent] Buffered metrics (${this.buffer.size}/${100})`
        );
      } catch (collectError) {
        console.error("[Agent] Failed to collect metrics:", collectError);
      }
    }
  }

  private async collectAndSendMongodb(): Promise<void> {
    if (!this.mongodbCollector) {
      return;
    }

    try {
      const metricsArray = await this.mongodbCollector.collectAll();

      for (const metrics of metricsArray) {
        await this.transport.send({ type: "mongodb", data: metrics });
      }

      console.info(
        `[Agent] MongoDB: ${metricsArray.length} members collected`
      );
    } catch (error) {
      console.error("[Agent] MongoDB metrics collection failed:", error);
      // Don't crash the agent, just log the error
    }
  }

  private async checkAndUpdate(): Promise<void> {
    const update = await this.updater.checkForUpdate();
    if (update) {
      console.info(`[Agent] Update available: ${AGENT_VERSION} → ${update.version}`);
      await this.updater.performUpdate(update);
    }
  }

  private async flushBuffer(): Promise<void> {
    const buffered = this.buffer.getAll();

    for (const payload of buffered) {
      try {
        await this.transport.send(payload);
      } catch (error) {
        console.error("[Agent] Failed to flush buffered metric:", error);
        return; // Stop flushing if we hit an error
      }
    }

    this.buffer.clear();
    console.info("[Agent] Buffer flushed successfully");
  }
}
