/** Collects ZoneMTA metrics by polling the HTTP API (default port 12080) */

interface ZonemtaMetricsResult {
  time: Date;
  nodeId: string;
  mtaRole: string | null;
  queueSize: number;
  activeDeliveries: number;
  sentTotal: number;
  deliveredTotal: number;
  bouncedTotal: number;
  deferredTotal: number;
  rejectedTotal: number;
  connectionsActive: number;
  throughputPerSec: number;
}

interface PrometheusMetric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export class ZonemtaMetricsCollector {
  private apiUrl: string;
  private prevCounters: Record<string, number> = {};
  private prevTimestamp = 0;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
  }

  async collect(nodeId: string): Promise<ZonemtaMetricsResult> {
    const [queueData, prometheusData] = await Promise.all([
      this.fetchQueueCounters(),
      this.fetchPrometheusMetrics(),
    ]);

    // Aggregate queue sizes across all zones
    let queueSize = 0;
    let deferredQueue = 0;
    for (const zone of Object.values(queueData)) {
      const z = zone as { active?: number; deferred?: number };
      queueSize += z.active ?? 0;
      deferredQueue += z.deferred ?? 0;
    }

    // Extract prometheus counters
    const deliveredTotal = this.getMetricValue(prometheusData, "zonemta_delivery_status", { status: "delivered" });
    const bouncedTotal = this.getMetricValue(prometheusData, "zonemta_delivery_status", { status: "bounced" });
    const rejectedTotal = this.getMetricValue(prometheusData, "zonemta_delivery_status", { status: "rejected" });
    const sentTotal = this.getMetricValue(prometheusData, "zonemta_message_push") || (deliveredTotal + bouncedTotal + rejectedTotal);
    const connectionsActive = this.getMetricValue(prometheusData, "zonemta_connection_pool_size");

    // Calculate throughput from counter deltas
    const now = Date.now();
    const throughputPerSec = this.calcThroughput(sentTotal, now);

    return {
      time: new Date(),
      nodeId,
      mtaRole: null,
      queueSize,
      activeDeliveries: queueSize,
      sentTotal,
      deliveredTotal,
      bouncedTotal,
      deferredTotal: deferredQueue,
      rejectedTotal,
      connectionsActive,
      throughputPerSec,
    };
  }

  /** GET /counter/zone/ — returns queue sizes per zone */
  private async fetchQueueCounters(): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`${this.apiUrl}/counter/zone/`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return {};
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** GET /metrics — returns Prometheus text format */
  private async fetchPrometheusMetrics(): Promise<PrometheusMetric[]> {
    try {
      const res = await fetch(`${this.apiUrl}/metrics`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const text = await res.text();
      return this.parsePrometheusText(text);
    } catch {
      return [];
    }
  }

  /** Parse Prometheus exposition format into structured metrics */
  private parsePrometheusText(text: string): PrometheusMetric[] {
    const metrics: PrometheusMetric[] = [];
    for (const line of text.split("\n")) {
      if (!line || line.startsWith("#")) continue;

      // Match: metric_name{label="value",...} 123.45
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?([^}]*)\}?\s+([\d.eE+-]+)/);
      if (!match) {
        // Simple metric without labels: metric_name 123.45
        const simple = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([\d.eE+-]+)/);
        if (simple) {
          metrics.push({ name: simple[1], labels: {}, value: parseFloat(simple[2]) });
        }
        continue;
      }

      const labels: Record<string, string> = {};
      if (match[2]) {
        for (const pair of match[2].split(",")) {
          const [k, v] = pair.split("=");
          if (k && v) labels[k.trim()] = v.replace(/"/g, "").trim();
        }
      }
      metrics.push({ name: match[1], labels, value: parseFloat(match[3]) });
    }
    return metrics;
  }

  /** Find a metric value by name and optional label match */
  private getMetricValue(metrics: PrometheusMetric[], name: string, labels?: Record<string, string>): number {
    for (const m of metrics) {
      if (m.name !== name) continue;
      if (labels) {
        const match = Object.entries(labels).every(([k, v]) => m.labels[k] === v);
        if (!match) continue;
      }
      return m.value;
    }
    return 0;
  }

  /** Calculate throughput (msgs/sec) from counter delta */
  private calcThroughput(currentSent: number, nowMs: number): number {
    const prevSent = this.prevCounters.sentTotal ?? 0;
    const elapsedSec = this.prevTimestamp ? (nowMs - this.prevTimestamp) / 1000 : 0;

    this.prevCounters.sentTotal = currentSent;
    this.prevTimestamp = nowMs;

    if (elapsedSec <= 0 || prevSent === 0) return 0;
    const delta = currentSent - prevSent;
    if (delta < 0) return 0; // Counter reset
    return Math.round((delta / elapsedSec) * 100) / 100;
  }
}
