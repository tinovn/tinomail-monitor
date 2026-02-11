import * as si from "systeminformation";
import { execSync } from "node:child_process";

export interface ProcessHealth {
  name: string;
  running: boolean;
  pid: number | null;
  cpuPercent: number;
  memoryMB: number;
}

/** Service detection: match process name/command line, OR systemd unit PID */
const MAIL_SERVICES: Record<string, { processPatterns: string[]; systemdUnit: string }> = {
  wildduck: {
    processPatterns: ["wildduck"],
    systemdUnit: "wildduck",
  },
  haraka: {
    processPatterns: ["haraka"],
    systemdUnit: "haraka",
  },
  "zone-mta": {
    processPatterns: ["zone-mta"],
    systemdUnit: "zone-mta",
  },
  rspamd: {
    processPatterns: ["rspamd"],
    systemdUnit: "rspamd",
  },
  "redis-server": {
    processPatterns: ["redis-server"],
    systemdUnit: "redis-server",
  },
  mongod: {
    processPatterns: ["mongod"],
    systemdUnit: "mongod",
  },
};

/** Check if systemd service is active, return MainPID or null */
function getSystemdServicePid(unitName: string): number | null {
  try {
    const result = execSync(
      `systemctl show ${unitName} --property=MainPID,ActiveState 2>/dev/null`,
      { encoding: "utf-8", timeout: 2000 }
    ).trim();
    const active = result.match(/ActiveState=(\w+)/);
    const pid = result.match(/MainPID=(\d+)/);
    if (active?.[1] === "active" && pid) {
      const n = parseInt(pid[1], 10);
      return n > 0 ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}

export class ProcessHealthCollector {
  async collect(): Promise<ProcessHealth[]> {
    try {
      const procs = await si.processes();
      const results: ProcessHealth[] = [];

      for (const [serviceName, config] of Object.entries(MAIL_SERVICES)) {
        // Strategy 1: Match by process name OR command line (handles renamed binaries)
        let proc = procs.list.find((p) => {
          const cmdLine = `${p.name} ${p.command}`.toLowerCase();
          return config.processPatterns.some((pat) => cmdLine.includes(pat));
        });

        // Strategy 2: Fallback to systemd MainPID (handles binary name != service name)
        if (!proc) {
          const pid = getSystemdServicePid(config.systemdUnit);
          if (pid) {
            proc = procs.list.find((p) => p.pid === pid);
          }
        }

        results.push(proc ? {
          name: serviceName,
          running: true,
          pid: proc.pid,
          cpuPercent: Math.round(proc.cpu * 10) / 10,
          memoryMB: Math.round(proc.memRss / 1024 / 1024),
        } : {
          name: serviceName,
          running: false,
          pid: null,
          cpuPercent: 0,
          memoryMB: 0,
        });
      }

      return results;
    } catch (error) {
      console.error("Failed to collect process health:", error);
      return Object.keys(MAIL_SERVICES).map((name) => ({
        name,
        running: false,
        pid: null,
        cpuPercent: 0,
        memoryMB: 0,
      }));
    }
  }
}
