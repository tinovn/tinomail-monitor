import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardUsers } from "../schema/dashboard-users-table.js";
import { alertRules } from "../schema/alert-rules-table.js";
import { dnsblLists } from "../schema/dnsbl-lists-table.js";
import { ALERT_RULES_SEED_DATA } from "./seed-alert-rules.js";
import { DNSBL_SEED_DATA } from "./seed-dnsbl-lists.js";

const scryptAsync = promisify(scrypt);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function seed() {
  const url = process.env.DATABASE_URL ?? "postgres://tinomail:devpassword@localhost:5432/tinomail_monitor";
  const sql = postgres(url);
  const db = drizzle(sql);

  console.info("Running TimescaleDB setup SQL...");
  const setupSql = readFileSync(resolve(__dirname, "../timescale-setup.sql"), "utf-8");
  await sql.unsafe(setupSql);
  console.info("TimescaleDB hypertables, aggregates, retention, compression configured.");

  console.info("Seeding admin user...");
  const adminHash = await hashPassword("admin123");
  await db.insert(dashboardUsers).values({
    username: "admin",
    passwordHash: adminHash,
    role: "admin",
  }).onConflictDoNothing();

  console.info("Seeding alert rules...");
  for (const rule of ALERT_RULES_SEED_DATA) {
    await db.insert(alertRules).values({
      name: rule.name,
      severity: rule.severity,
      condition: rule.condition,
      threshold: "threshold" in rule ? rule.threshold : null,
      duration: "duration" in rule ? rule.duration : null,
      channels: [...rule.channels],
      description: rule.description,
    }).onConflictDoNothing();
  }

  console.info(`Seeded ${ALERT_RULES_SEED_DATA.length} alert rules.`);

  console.info("Seeding DNSBL lists...");
  for (const dnsbl of DNSBL_SEED_DATA) {
    await db.insert(dnsblLists).values({
      blacklist: dnsbl.blacklist,
      tier: dnsbl.tier,
      description: dnsbl.description,
      enabled: true,
    }).onConflictDoNothing();
  }

  console.info(`Seeded ${DNSBL_SEED_DATA.length} DNSBL lists.`);
  console.info("Seed complete.");
  await sql.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
