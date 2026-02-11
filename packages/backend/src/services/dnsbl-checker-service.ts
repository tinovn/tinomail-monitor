import { promises as dns } from "dns";
import type { FastifyInstance } from "fastify";

/** Result of a single DNSBL check */
export interface DnsblCheckResult {
  blacklist: string;
  tier: string;
  listed: boolean;
  response: string | null;
  checkDurationMs: number;
  error?: string;
}

/** DNSBL configuration */
export interface DnsblConfig {
  blacklist: string;
  tier: "critical" | "high" | "medium";
  description: string;
}

export class DnsblCheckerService {
  private readonly DNS_TIMEOUT_MS = 5000;
  private readonly MAX_CONCURRENT_CHECKS = 50;

  constructor(_app: FastifyInstance) {}

  /**
   * Reverse IP octets for DNSBL query format
   * Example: 103.21.58.15 → 15.58.21.103
   */
  private reverseIp(ip: string): string {
    return ip.split(".").reverse().join(".");
  }

  /**
   * Check single IP against single DNSBL with timeout
   */
  async checkSingleDnsbl(
    ip: string,
    blacklist: string,
    tier: string,
  ): Promise<DnsblCheckResult> {
    const startTime = Date.now();
    const reversedIp = this.reverseIp(ip);
    const dnsQuery = `${reversedIp}.${blacklist}`;

    try {
      // DNS A record lookup with timeout
      const addresses = await Promise.race([
        dns.resolve4(dnsQuery),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("DNS lookup timeout")),
            this.DNS_TIMEOUT_MS,
          ),
        ),
      ]);

      const checkDurationMs = Date.now() - startTime;
      const response = addresses.length > 0 ? addresses[0] : null;

      return {
        blacklist,
        tier,
        listed: addresses.length > 0,
        response,
        checkDurationMs,
      };
    } catch (err) {
      const checkDurationMs = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);

      // NXDOMAIN or ENOTFOUND means not listed
      if (
        error.includes("ENOTFOUND") ||
        error.includes("ENODATA") ||
        error.includes("queryA")
      ) {
        return {
          blacklist,
          tier,
          listed: false,
          response: null,
          checkDurationMs,
        };
      }

      // Other errors (timeout, network)
      return {
        blacklist,
        tier,
        listed: false,
        response: null,
        checkDurationMs,
        error,
      };
    }
  }

  /**
   * Check IP against multiple DNSBLs with concurrency control
   */
  async checkIpAgainstDnsbls(
    ip: string,
    dnsbls: DnsblConfig[],
  ): Promise<DnsblCheckResult[]> {
    const results: DnsblCheckResult[] = [];
    const queue = [...dnsbls];

    // Process in batches with concurrency limit
    while (queue.length > 0) {
      const batch = queue.splice(0, this.MAX_CONCURRENT_CHECKS);
      const batchResults = await Promise.all(
        batch.map((dnsbl) =>
          this.checkSingleDnsbl(ip, dnsbl.blacklist, dnsbl.tier),
        ),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Check multiple IPs against a single DNSBL with concurrency control
   */
  async checkMultipleIps(
    ips: string[],
    blacklist: string,
    tier: string,
  ): Promise<Map<string, DnsblCheckResult>> {
    const results = new Map<string, DnsblCheckResult>();
    const queue = [...ips];

    while (queue.length > 0) {
      const batch = queue.splice(0, this.MAX_CONCURRENT_CHECKS);
      const batchResults = await Promise.all(
        batch.map(async (ip) => ({
          ip,
          result: await this.checkSingleDnsbl(ip, blacklist, tier),
        })),
      );

      batchResults.forEach(({ ip, result }) => {
        results.set(ip, result);
      });
    }

    return results;
  }

  /**
   * Batch check all IPs against all DNSBLs
   */
  async batchCheckAll(
    ips: string[],
    dnsbls: DnsblConfig[],
  ): Promise<Map<string, DnsblCheckResult[]>> {
    const results = new Map<string, DnsblCheckResult[]>();

    for (const ip of ips) {
      const ipResults = await this.checkIpAgainstDnsbls(ip, dnsbls);
      results.set(ip, ipResults);
    }

    return results;
  }
}
