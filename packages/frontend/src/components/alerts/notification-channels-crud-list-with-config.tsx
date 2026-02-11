import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TestTube } from "lucide-react";
import type { NotificationChannel } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { cn } from "@/lib/classname-utils";

interface NotificationChannelConfig {
  id: number;
  type: NotificationChannel;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export function NotificationChannelsCrudListWithConfig() {
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannelConfig | null>(null);
  const [channelType, setChannelType] = useState<NotificationChannel>("telegram");
  const [channelName, setChannelName] = useState("");
  const [channelConfig, setChannelConfig] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const { data: channels = [] } = useQuery<NotificationChannelConfig[]>({
    queryKey: ["alerts", "channels"],
    queryFn: () => apiClient.get("/alerts/channels"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: { type: NotificationChannel; name: string; config: Record<string, unknown> }) => {
      return apiClient.post("/alerts/channels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "channels"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<NotificationChannelConfig> }) => {
      return apiClient.put(`/alerts/channels/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "channels"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.del(`/alerts/channels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "channels"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.post(`/alerts/channels/${id}/test`);
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingChannel(null);
    setChannelType("telegram");
    setChannelName("");
    setChannelConfig({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingChannel) {
      updateMutation.mutate({
        id: editingChannel.id,
        data: { name: channelName, config: channelConfig },
      });
    } else {
      createMutation.mutate({
        type: channelType,
        name: channelName,
        config: channelConfig,
      });
    }
  };

  const renderConfigFields = () => {
    switch (channelType) {
      case "telegram":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Bot Token</label>
              <input
                type="text"
                value={channelConfig.bot_token || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, bot_token: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Chat ID</label>
              <input
                type="text"
                value={channelConfig.chat_id || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, chat_id: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </>
        );
      case "slack":
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Webhook URL</label>
            <input
              type="url"
              value={channelConfig.webhook_url || ""}
              onChange={(e) => setChannelConfig({ ...channelConfig, webhook_url: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
        );
      case "email":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={channelConfig.smtp_host || ""}
                  onChange={(e) => setChannelConfig({ ...channelConfig, smtp_host: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port</label>
                <input
                  type="number"
                  value={channelConfig.port || ""}
                  onChange={(e) => setChannelConfig({ ...channelConfig, port: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">From Address</label>
              <input
                type="email"
                value={channelConfig.from || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, from: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To Addresses (comma separated)</label>
              <input
                type="text"
                value={channelConfig.to || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, to: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notification Channels</h3>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          Add Channel
        </button>
      </div>

      {/* Channel List */}
      <div className="space-y-3">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="flex items-center justify-between rounded-md border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">
                {channel.type === "telegram" ? "📱" : channel.type === "slack" ? "💬" : "📧"}
              </span>
              <div>
                <h4 className="font-medium text-sm capitalize">{channel.type}</h4>
                <p className="text-xs text-muted-foreground">{channel.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => testMutation.mutate(channel.id)}
                disabled={testMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface/80"
                title="Test notification"
              >
                <TestTube className="h-4 w-4" />
                Test
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete channel "${channel.name}"?`)) {
                    deleteMutation.mutate(channel.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/20"
                title="Delete channel"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {channels.length === 0 && (
          <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
            <p className="text-muted-foreground">No notification channels configured</p>
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-md border border-border bg-surface p-4">
          <h4 className="text-md font-semibold mb-4">
            {editingChannel ? "Edit Channel" : "Add New Channel"}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingChannel && (
              <div>
                <label className="block text-sm font-medium mb-1">Channel Type</label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value as NotificationChannel)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="telegram">Telegram</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Channel Name</label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="e.g., Production Alerts"
                required
              />
            </div>

            {renderConfigFields()}

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className={cn(
                  "rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface/80"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
