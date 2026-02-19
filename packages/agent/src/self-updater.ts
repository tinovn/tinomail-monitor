import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { AGENT_VERSION } from "./agent-config.js";

interface VersionCheckResponse {
  version: string;
  files: string[];
  githubRawBase: string;
  updateRequested: boolean;
  pluginFiles?: string[];
  pluginGithubRawBase?: string;
}

interface SelfUpdaterConfig {
  serverUrl: string;
  apiKey: string;
  nodeId: string;
  installDir: string;
}

const ZONEMTA_PLUGIN_DIR = "/opt/zone-mta/plugins";

export class SelfUpdater {
  constructor(private config: SelfUpdaterConfig) {}

  /** Fetch version info, update agent + plugins as needed */
  async checkAndApplyUpdates(): Promise<void> {
    let data: VersionCheckResponse;

    try {
      const url = `${this.config.serverUrl}/api/v1/agents/latest-version?nodeId=${this.config.nodeId}`;
      const response = await fetch(url, {
        headers: { "x-api-key": this.config.apiKey },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return;

      const json = (await response.json()) as { success: boolean; data: VersionCheckResponse };
      if (!json.success) return;

      data = json.data;
    } catch (error) {
      console.warn("[Updater] Version check failed:", (error as Error).message);
      return;
    }

    const needsAgentUpdate = data.version !== AGENT_VERSION || data.updateRequested;

    // Always check plugins (even if agent is current)
    if (data.pluginFiles?.length && data.pluginGithubRawBase) {
      await this.updatePlugins(data.pluginFiles, data.pluginGithubRawBase);
    }

    // Update agent source files if needed
    if (needsAgentUpdate) {
      await this.performAgentUpdate(data);
    }
  }

  /** Download updated agent source files and restart */
  private async performAgentUpdate(versionInfo: VersionCheckResponse): Promise<void> {
    const srcDir = join(this.config.installDir, "src");

    console.info(`[Updater] Updating agent from ${AGENT_VERSION} to ${versionInfo.version}...`);

    for (const file of versionInfo.files) {
      const url = `${versionInfo.githubRawBase}/${file}`;
      const filePath = join(srcDir, file);

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

    console.info("[Updater] Agent update complete. Restarting via systemd...");

    try {
      execSync("systemctl restart tinomail-agent", { timeout: 5000 });
    } catch {
      // If systemctl fails, just exit — systemd will restart us
      process.exit(0);
    }
  }

  /** Update ZoneMTA plugins — only restarts zone-mta if files actually changed */
  private async updatePlugins(pluginFiles: string[], rawBase: string): Promise<void> {
    if (!existsSync(ZONEMTA_PLUGIN_DIR)) {
      return; // No ZoneMTA installed on this node
    }

    let changed = false;

    for (const file of pluginFiles) {
      const url = `${rawBase}/${file}`;
      const filePath = join(ZONEMTA_PLUGIN_DIR, file);

      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
          console.warn(`[Updater] Failed to download plugin ${file}: ${response.status}`);
          continue;
        }

        const newContent = await response.text();

        // Compare with existing — only write + restart if changed
        let existing = "";
        if (existsSync(filePath)) {
          existing = readFileSync(filePath, "utf-8");
        }

        if (newContent !== existing) {
          writeFileSync(filePath, newContent, "utf-8");
          changed = true;
          console.info(`[Updater] Plugin updated: ${file}`);
        }
      } catch (error) {
        console.error(`[Updater] Error downloading plugin ${file}:`, (error as Error).message);
      }
    }

    if (changed) {
      console.info("[Updater] Restarting zone-mta for plugin update...");
      try {
        execSync("systemctl restart zone-mta", { timeout: 10000 });
        console.info("[Updater] zone-mta restarted successfully");
      } catch (error) {
        console.error("[Updater] Failed to restart zone-mta:", (error as Error).message);
      }
    }
  }
}
