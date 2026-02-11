export interface EventTransportConfig {
  serverUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
}

export class EventHttpTransport {
  constructor(private config: EventTransportConfig) {}

  /** POST an array of email event payloads to the backend ingestion endpoint */
  async sendEvents(events: Record<string, unknown>[]): Promise<void> {
    const body = JSON.stringify(events);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.config.serverUrl}/api/v1/events/ingest`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.config.apiKey,
            },
            body,
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
          `[EventTransport] Attempt ${attempt + 1}/${this.config.maxRetries} failed: ${lastError.message}`
        );

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error("Event transport failed after retries");
  }
}
