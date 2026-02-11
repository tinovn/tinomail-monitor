import type { FastifyInstance } from "fastify";
import { resolveTxt } from "dns/promises";

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
}
