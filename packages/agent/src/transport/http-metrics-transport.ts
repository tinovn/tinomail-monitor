import { gzipSync } from "node:zlib";
import type { SystemMetrics } from "@tinomail/shared";

export interface TransportConfig {
  serverUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
}

export class HttpMetricsTransport {
  constructor(private config: TransportConfig) {}

  async send(metrics: SystemMetrics): Promise<void> {
    const payload = { type: "system", data: metrics };
    const compressed = gzipSync(JSON.stringify(payload));

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.config.serverUrl}/api/v1/metrics`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Encoding": "gzip",
              "x-api-key": this.config.apiKey,
            },
            body: compressed,
            signal: AbortSignal.timeout(this.config.timeoutMs),
          }
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${await response.text()}`
          );
        }

        return; // Success
      } catch (error) {
        lastError = error as Error;
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s

        console.warn(
          `[Transport] Attempt ${attempt + 1}/${this.config.maxRetries} failed: ${lastError.message}`
        );

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error("Transport failed after retries");
  }
}
