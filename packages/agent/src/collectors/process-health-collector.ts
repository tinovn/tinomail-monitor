import * as si from "systeminformation";

export interface ProcessHealth {
  name: string;
  running: boolean;
  pid: number | null;
  cpuPercent: number;
  memoryMB: number;
}

const MAIL_PROCESSES = [
  "wildduck",
  "haraka",
  "zone-mta",
  "rspamd",
  "redis-server",
  "mongod",
] as const;

export class ProcessHealthCollector {
  async collect(): Promise<ProcessHealth[]> {
    try {
      const processes = await si.processes();
      const results: ProcessHealth[] = [];

      for (const processName of MAIL_PROCESSES) {
        const proc = processes.list.find((p) =>
          p.name.toLowerCase().includes(processName.toLowerCase())
        );

        if (proc) {
          results.push({
            name: processName,
            running: true,
            pid: proc.pid,
            cpuPercent: Math.round(proc.cpu * 10) / 10,
            memoryMB: Math.round(proc.memRss / 1024 / 1024),
          });
        } else {
          results.push({
            name: processName,
            running: false,
            pid: null,
            cpuPercent: 0,
            memoryMB: 0,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Failed to collect process health:", error);
      return MAIL_PROCESSES.map((name) => ({
        name,
        running: false,
        pid: null,
        cpuPercent: 0,
        memoryMB: 0,
      }));
    }
  }
}
