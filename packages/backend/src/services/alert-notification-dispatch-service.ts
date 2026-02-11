import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { notificationChannels } from "../db/schema/notification-channels-table.js";
import { alertEvents } from "../db/schema/alert-events-table.js";

interface AlertEventData {
  id: number;
  severity: string | null;
  message: string | null;
  details?: Record<string, unknown> | null;
  nodeId?: string | null;
  firedAt?: Date | null;
}

interface NotificationResult {
  channel: string;
  success: boolean;
  error?: string;
}

/** Alert notification dispatch service — sends alerts to configured channels */
export class AlertNotificationDispatchService {
  constructor(private app: FastifyInstance) {}

  /** Send notification to all configured channels */
  async sendNotification(
    alertEvent: AlertEventData,
    channelNames: string[],
  ): Promise<NotificationResult[]> {
    if (channelNames.length === 0) {
      return [];
    }

    // Get channel configs
    const channels = await this.app.db
      .select()
      .from(notificationChannels)
      .where(
        inArray(notificationChannels.name, channelNames),
      );

    const enabledChannels = channels.filter((ch) => ch.enabled);
    const results: NotificationResult[] = [];

    for (const channel of enabledChannels) {
      try {
        await this.dispatchToChannel(channel, alertEvent);
        results.push({ channel: channel.name, success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        this.app.log.error(
          { channel: channel.name, error: errorMsg },
          "Notification dispatch failed",
        );
        results.push({ channel: channel.name, success: false, error: errorMsg });
      }
    }

    // Mark as notified
    await this.app.db
      .update(alertEvents)
      .set({ notified: true })
      .where(eq(alertEvents.id, alertEvent.id));

    return results;
  }

  /** Dispatch to specific channel type */
  private async dispatchToChannel(
    channel: typeof notificationChannels.$inferSelect,
    alert: AlertEventData,
  ): Promise<void> {
    const config = channel.config as Record<string, unknown>;

    switch (channel.type) {
      case "telegram":
        await this.sendTelegram(config, alert);
        break;
      case "slack":
        await this.sendSlack(config, alert);
        break;
      case "email":
        await this.sendEmail(config, alert);
        break;
      case "webhook":
        await this.sendWebhook(config, alert);
        break;
      case "inapp":
        await this.sendInApp(alert);
        break;
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  /** Send Telegram notification */
  private async sendTelegram(config: Record<string, unknown>, alert: AlertEventData): Promise<void> {
    const token = config.botToken as string;
    const chatId = config.chatId as string;

    if (!token || !chatId) {
      throw new Error("Telegram config missing botToken or chatId");
    }

    const emoji = this.getSeverityEmoji(alert.severity);
    const message = `${emoji} *${alert.severity?.toUpperCase()}*\n\n${alert.message}\n\nNode: ${alert.nodeId || "N/A"}\nTime: ${alert.firedAt?.toISOString() || "Now"}`;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
  }

  /** Send Slack notification */
  private async sendSlack(config: Record<string, unknown>, alert: AlertEventData): Promise<void> {
    const webhookUrl = config.webhookUrl as string;

    if (!webhookUrl) {
      throw new Error("Slack config missing webhookUrl");
    }

    const emoji = this.getSeverityEmoji(alert.severity);
    const color = this.getSeverityColor(alert.severity);

    const payload = {
      attachments: [
        {
          color,
          title: `${emoji} ${alert.severity?.toUpperCase()} Alert`,
          text: alert.message,
          fields: [
            {
              title: "Node",
              value: alert.nodeId || "N/A",
              short: true,
            },
            {
              title: "Time",
              value: alert.firedAt?.toISOString() || "Now",
              short: true,
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook error: ${response.statusText}`);
    }
  }

  /** Send email notification */
  private async sendEmail(config: Record<string, unknown>, alert: AlertEventData): Promise<void> {
    const to = config.to as string;
    const from = config.from as string;

    if (!to || !from) {
      throw new Error("Email config missing to or from");
    }

    // Simple email via SMTP (placeholder — implement with nodemailer if needed)
    this.app.log.info(
      { to, from, alert: alert.message },
      "Email notification (not implemented)",
    );
  }

  /** Send webhook notification */
  private async sendWebhook(config: Record<string, unknown>, alert: AlertEventData): Promise<void> {
    const url = config.url as string;
    const method = (config.method as string) || "POST";
    const headers = (config.headers as Record<string, string>) || {};

    if (!url) {
      throw new Error("Webhook config missing url");
    }

    const payload = {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      nodeId: alert.nodeId,
      details: alert.details,
      firedAt: alert.firedAt?.toISOString(),
    };

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.statusText}`);
    }
  }

  /** Send in-app notification via Socket.IO */
  private async sendInApp(alert: AlertEventData): Promise<void> {
    this.app.io.to("alerts").emit("alert:notification", {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      nodeId: alert.nodeId,
      timestamp: alert.firedAt?.toISOString() || new Date().toISOString(),
    });
  }

  /** Get severity emoji */
  private getSeverityEmoji(severity: string | null | undefined): string {
    switch (severity) {
      case "critical":
        return "🔴";
      case "warning":
        return "🟡";
      case "info":
        return "🔵";
      default:
        return "⚪";
    }
  }

  /** Get severity color for Slack */
  private getSeverityColor(severity: string | null | undefined): string {
    switch (severity) {
      case "critical":
        return "#FF0000";
      case "warning":
        return "#FFA500";
      case "info":
        return "#0000FF";
      default:
        return "#808080";
    }
  }
}
