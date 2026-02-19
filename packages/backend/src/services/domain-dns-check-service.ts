import type { FastifyInstance } from "fastify";
import { resolveTxt } from "dns/promises";
import { eq } from "drizzle-orm";
import { sendingDomains } from "../db/schema/sending-domains-table.js";

interface DnsRecord {
  found: boolean;
  record: string | null;
  error?: string;
}

interface DmarcRecord extends DnsRecord {
  policy: string | null;
}

interface DnsCheckResult {
  spf: DnsRecord;
  dkim: DnsRecord;
  dmarc: DmarcRecord;
}

/**
 * Live DNS lookup service for domain authentication records
 * Checks SPF, DKIM, and DMARC TXT records
 */
export class DomainDnsCheckService {
  constructor(private app: FastifyInstance) {}

  /**
   * Perform DNS checks for a domain
   * Returns SPF, DKIM, and DMARC record status
   */
  async checkDomain(domain: string): Promise<DnsCheckResult> {
    const [spf, dkim, dmarc] = await Promise.all([
      this.checkSpf(domain),
      this.checkDkim(domain),
      this.checkDmarc(domain),
    ]);

    return {
      spf,
      dkim,
      dmarc,
    };
  }

  /**
   * Check SPF record for domain
   */
  private async checkSpf(domain: string): Promise<DnsRecord> {
    try {
      const records = await resolveTxt(domain);
      const spfRecord = records
        .flat()
        .find((record) => record.startsWith("v=spf1"));

      if (spfRecord) {
        return {
          found: true,
          record: spfRecord,
        };
      }

      return {
        found: false,
        record: null,
      };
    } catch (error: any) {
      this.app.log.warn({ domain, error: error.message }, "SPF lookup failed");
      return {
        found: false,
        record: null,
        error: error.code || error.message,
      };
    }
  }

  /**
   * Check DKIM record for domain (default selector)
   */
  private async checkDkim(domain: string): Promise<DnsRecord> {
    const dkimDomain = `default._domainkey.${domain}`;

    try {
      const records = await resolveTxt(dkimDomain);
      const dkimRecord = records
        .flat()
        .find((record) => record.includes("v=DKIM1") || record.includes("k=rsa"));

      if (dkimRecord) {
        return {
          found: true,
          record: dkimRecord,
        };
      }

      return {
        found: false,
        record: null,
      };
    } catch (error: any) {
      this.app.log.warn({ domain, dkimDomain, error: error.message }, "DKIM lookup failed");
      return {
        found: false,
        record: null,
        error: error.code || error.message,
      };
    }
  }

  /**
   * Check DMARC record for domain
   */
  private async checkDmarc(domain: string): Promise<DmarcRecord> {
    const dmarcDomain = `_dmarc.${domain}`;

    try {
      const records = await resolveTxt(dmarcDomain);
      const dmarcRecord = records
        .flat()
        .find((record) => record.startsWith("v=DMARC1"));

      if (dmarcRecord) {
        // Extract policy from DMARC record
        const policyMatch = dmarcRecord.match(/p=([^;]+)/);
        const policy = policyMatch ? policyMatch[1] : null;

        return {
          found: true,
          record: dmarcRecord,
          policy,
        };
      }

      return {
        found: false,
        record: null,
        policy: null,
      };
    } catch (error: any) {
      this.app.log.warn({ domain, dmarcDomain, error: error.message }, "DMARC lookup failed");
      return {
        found: false,
        record: null,
        policy: null,
        error: error.code || error.message,
      };
    }
  }

  /**
   * Check DNS and update sending_domains table with results.
   * Used by auto-sync and periodic DNS re-check workers.
   */
  async checkAndUpdateDomain(domain: string): Promise<DnsCheckResult> {
    const result = await this.checkDomain(domain);

    await this.app.db
      .update(sendingDomains)
      .set({
        dkimConfigured: result.dkim.found,
        spfConfigured: result.spf.found,
        dmarcConfigured: result.dmarc.found,
        dmarcPolicy: result.dmarc.policy,
      })
      .where(eq(sendingDomains.domain, domain));

    return result;
  }

  /**
   * Check DNS for all active domains and update the table.
   * Processes sequentially with small delay to avoid DNS rate limiting.
   */
  async checkAndUpdateAllDomains(): Promise<{ checked: number; updated: number }> {
    const domains = await this.app.db.select().from(sendingDomains);
    let updated = 0;

    for (const d of domains) {
      try {
        await this.checkAndUpdateDomain(d.domain);
        updated++;
      } catch (error) {
        this.app.log.warn({ domain: d.domain, error }, "DNS check failed for domain");
      }
      // Small delay between checks to avoid DNS rate limiting
      if (domains.length > 10) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Invalidate health scores cache since auth flags changed
    await this.app.redis.del("domains:health:all");

    return { checked: domains.length, updated };
  }
}
