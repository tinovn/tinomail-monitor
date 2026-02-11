/** DNSBL providers seeded into the system for IP reputation checks */
export const DNSBL_SEED_DATA = [
  // Critical tier — major blocklists, check every 1min
  { blacklist: "zen.spamhaus.org", tier: "critical", description: "Spamhaus ZEN (SBL+XBL+PBL)" },
  { blacklist: "b.barracudacentral.org", tier: "critical", description: "Barracuda BRBL" },
  { blacklist: "bl.spamcop.net", tier: "critical", description: "SpamCop" },
  { blacklist: "cbl.abuseat.org", tier: "critical", description: "CBL Composite" },
  { blacklist: "dnsbl.sorbs.net", tier: "critical", description: "SORBS aggregate" },

  // High tier — well-known lists, check every 5min
  { blacklist: "dnsbl-1.uceprotect.net", tier: "high", description: "UCEPROTECT Level 1" },
  { blacklist: "dnsbl-2.uceprotect.net", tier: "high", description: "UCEPROTECT Level 2" },
  { blacklist: "psbl.surriel.com", tier: "high", description: "PSBL Passive Spam" },
  { blacklist: "db.wpbl.info", tier: "high", description: "WPBL" },
  { blacklist: "dnsbl.dronebl.org", tier: "high", description: "DroneBL" },
  { blacklist: "bl.mailspike.net", tier: "high", description: "Mailspike BL" },
  { blacklist: "spam.dnsbl.sorbs.net", tier: "high", description: "SORBS Spam" },
  { blacklist: "new.spam.dnsbl.sorbs.net", tier: "high", description: "SORBS New Spam" },

  // Medium tier — supplementary lists, check every 15min
  { blacklist: "dyna.spamrats.com", tier: "medium", description: "SpamRATS Dynamic" },
  { blacklist: "noptr.spamrats.com", tier: "medium", description: "SpamRATS NoPTR" },
  { blacklist: "spam.spamrats.com", tier: "medium", description: "SpamRATS Spam" },
  { blacklist: "all.s5h.net", tier: "medium", description: "S5H BL" },
  { blacklist: "rbl.interserver.net", tier: "medium", description: "InterServer BL" },
  { blacklist: "bl.blocklist.de", tier: "medium", description: "Blocklist.de" },
  { blacklist: "dnsbl.justspam.org", tier: "medium", description: "JustSpam" },
  { blacklist: "bl.nordspam.com", tier: "medium", description: "NordSpam BL" },
  { blacklist: "combined.abuse.ch", tier: "medium", description: "Abuse.ch Combined" },
  { blacklist: "dnsbl.anticaptcha.net", tier: "medium", description: "AntiCaptcha" },
  { blacklist: "ix.dnsbl.manitu.net", tier: "medium", description: "NiX Spam" },
] as const;
