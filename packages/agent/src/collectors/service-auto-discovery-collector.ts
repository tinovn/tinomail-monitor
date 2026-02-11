import * as si from "systeminformation";
import * as net from "node:net";

/** Map of service names to their detection patterns */
const SERVICE_PATTERNS: Record<string, { processPatterns: string[]; ports: number[] }> = {
  zonemta: {
    processPatterns: ["zone-mta", "zone-mta-"],
    ports: [12080],
  },
  wildduck: {
    processPatterns: ["wildduck"],
    ports: [8080],
  },
  haraka: {
    processPatterns: ["haraka"],
    ports: [25],
  },
  mongodb: {
    processPatterns: ["mongod"],
    ports: [27017],
  },
  redis: {
    processPatterns: ["redis-server"],
    ports: [6379],
  },
  rspamd: {
    processPatterns: ["rspamd", "rspamd-worker"],
    ports: [11333],
  },
  clamav: {
    processPatterns: ["clamd", "freshclam"],
    ports: [3310],
  },
};

/** Priority order for determining primary role from detected services */
const ROLE_PRIORITY = ["zonemta", "wildduck", "haraka", "mongodb", "redis"] as const;

/** Probe whether a TCP port is listening on localhost */
function probePort(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

export class ServiceAutoDiscoveryCollector {
  private cachedServices: string[] = [];

  /** Detect all running services on this node */
  async discoverServices(): Promise<string[]> {
    const detected = new Set<string>();

    // Phase 1: Process-based detection
    try {
      const procs = await si.processes();
      const cmdLines = procs.list.map((p) => `${p.name} ${p.command}`.toLowerCase());

      for (const [service, { processPatterns }] of Object.entries(SERVICE_PATTERNS)) {
        for (const pattern of processPatterns) {
          if (cmdLines.some((cmd) => cmd.includes(pattern.toLowerCase()))) {
            detected.add(service);
            break;
          }
        }
      }
    } catch (error) {
      console.warn("[Discovery] Process detection failed:", error);
    }

    // Phase 2: Port probing for services not found via process
    const portProbes: Promise<void>[] = [];
    for (const [service, { ports }] of Object.entries(SERVICE_PATTERNS)) {
      if (detected.has(service)) continue;
      for (const port of ports) {
        portProbes.push(
          probePort(port).then((open) => {
            if (open) detected.add(service);
          })
        );
      }
    }
    await Promise.all(portProbes);

    this.cachedServices = Array.from(detected).sort();
    return this.cachedServices;
  }

  /** Get the primary role based on detected services */
  determinePrimaryRole(): string {
    for (const role of ROLE_PRIORITY) {
      if (this.cachedServices.includes(role)) return role;
    }
    return "unknown";
  }

  /** Get cached list of detected services */
  get services(): string[] {
    return this.cachedServices;
  }
}
