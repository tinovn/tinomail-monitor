/**
 * Categorizes active MongoDB connections by application name (appName).
 * Uses db.currentOp({ $all: true }) — PRIMARY only.
 */

import type { MongoClient } from "mongodb";

export interface ConnectionBreakdown {
  connAppImap: number | null;
  connAppSmtp: number | null;
  connAppInternal: number | null;
  connAppMonitoring: number | null;
  connAppOther: number | null;
}

const NULL_BREAKDOWN: ConnectionBreakdown = {
  connAppImap: null,
  connAppSmtp: null,
  connAppInternal: null,
  connAppMonitoring: null,
  connAppOther: null,
};

const IMAP_RE = /wildduck.*imap|dovecot/i;
const SMTP_RE = /wildduck.*smtp|haraka|zone-mta|postfix/i;
const INTERNAL_RE = /^MongoDB .*(Repl|Internal)/i;
const MONITORING_RE = /monitor|agent|prometheus|telegraf|datadog/i;

interface CurrentOpEntry {
  appName?: string;
  client?: { driver?: { name?: string } };
}

/**
 * Collects connection counts grouped by application category.
 * Must be called with a client connected to the PRIMARY.
 * Returns all-null breakdown on any error.
 */
export async function collectConnectionBreakdown(
  client: MongoClient
): Promise<ConnectionBreakdown> {
  try {
    const admin = client.db("admin");
    const result = await admin.command({ currentOp: 1, $all: true });

    const ops: CurrentOpEntry[] = result.inprog ?? [];

    let imap = 0;
    let smtp = 0;
    let internal = 0;
    let monitoring = 0;
    let other = 0;

    for (const op of ops) {
      const appName = op.appName ?? "";
      const driverName = op.client?.driver?.name ?? "";

      if (IMAP_RE.test(appName)) {
        imap++;
      } else if (SMTP_RE.test(appName)) {
        smtp++;
      } else if (INTERNAL_RE.test(appName) || driverName.toLowerCase().includes("internal")) {
        internal++;
      } else if (MONITORING_RE.test(appName)) {
        monitoring++;
      } else {
        other++;
      }
    }

    return {
      connAppImap: imap,
      connAppSmtp: smtp,
      connAppInternal: internal,
      connAppMonitoring: monitoring,
      connAppOther: other,
    };
  } catch (error) {
    console.warn(
      "[MongoDB ConnBreakdown] currentOp failed, returning nulls:",
      (error as Error).message
    );
    return NULL_BREAKDOWN;
  }
}
