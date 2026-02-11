import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { AGENT_VERSION } from "./agent-config.js";

interface VersionCheckResponse {
  version: string;
  files: string[];
  githubRawBase: string;
  updateRequested: boolean;
}

interface SelfUpdaterConfig {
  serverUrl: string;
  apiKey: string;
  nodeId: string;
  installDir: string;
}

export class SelfUpdater {
  constructor(private config: SelfUpdaterConfig) {}

  /** Check if update is available. Returns new version or null */
  async checkForUpdate(): Promise<VersionCheckResponse | null> {
    try {
      const url = `${this.config.serverUrl}/api/v1/agents/latest-version?nodeId=${this.config.nodeId}`;
      const response = await fetch(url, {
        headers: { "x-api-key": this.config.apiKey },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const json = (await response.json()) as { success: boolean; data: VersionCheckResponse };
      if (!json.success) return null;

      const data = json.data;

      // Update needed if version is newer or admin requested
      if (data.version !== AGENT_VERSION || data.updateRequested) {
        return data;
      }

      return null;
    } catch (error) {
      console.warn("[Updater] Version check failed:", (error as Error).message);
      return null;
    }
  }

  /** Download updated files and restart */
  async performUpdate(versionInfo: VersionCheckResponse): Promise<void> {
    const srcDir = join(this.config.installDir, "src");

    console.info(`[Updater] Updating from ${AGENT_VERSION} to ${versionInfo.version}...`);

    // Download each source file
    for (const file of versionInfo.files) {
      const url = `${versionInfo.githubRawBase}/${file}`;
      const filePath = join(srcDir, file);

      // Ensure directory exists
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
          console.warn(`[Updater] Failed to download ${file}: ${response.status}`);
          continue;
        }

        let content = await response.text();

        // Patch @tinomail/shared imports to relative paths
        const depth = file.split("/").length - 1;
        const prefix = depth === 0 ? "./" : "../".repeat(depth);
        content = content.replace(
          /from ["']@tinomail\/shared["']/g,
          `from "${prefix}shared/index.js"`,
        );

        writeFileSync(filePath, content, "utf-8");
        console.info(`[Updater] Updated ${file}`);
      } catch (error) {
        console.error(`[Updater] Error downloading ${file}:`, (error as Error).message);
      }
    }

    // Acknowledge update to server
    try {
      await fetch(
        `${this.config.serverUrl}/api/v1/agents/ack-update?nodeId=${this.config.nodeId}`,
        {
          method: "POST",
          headers: { "x-api-key": this.config.apiKey },
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      // Non-critical
    }

    console.info("[Updater] Update complete. Restarting via systemd...");

    // Restart via systemd — exit process, systemd Restart=always will bring it back
    try {
      execSync("systemctl restart tinomail-agent", { timeout: 5000 });
    } catch {
      // If systemctl fails, just exit — systemd will restart us
      process.exit(0);
    }
  }
}
