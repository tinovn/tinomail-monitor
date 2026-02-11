import type { SystemMetrics } from "@tinomail/shared";

const MAX_BUFFER_SIZE = 100; // ~25 minutes at 15s intervals

export class OfflineMetricsBuffer {
  private buffer: SystemMetrics[] = [];

  push(metrics: SystemMetrics): void {
    this.buffer.push(metrics);

    // Circular buffer - remove oldest when full
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  getAll(): SystemMetrics[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }

  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}
