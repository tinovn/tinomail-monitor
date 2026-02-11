import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { AlertRule, SeverityLevel, NotificationChannel } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { cn } from "@/lib/classname-utils";

interface AlertRuleFormData {
  name: string;
  description: string;
  severity: SeverityLevel;
  condition: string;
  operator: string;
  threshold: number | null;
  duration: string;
  channels: string[];
  cooldown: string;
  enabled: boolean;
}

interface AlertRuleCreateEditFormDialogProps {
  rule?: AlertRule;
  open: boolean;
  onClose: () => void;
}

const CONDITION_OPTIONS = [
  { value: "cpu_percent", label: "CPU Usage (%)" },
  { value: "ram_percent", label: "RAM Usage (%)" },
  { value: "disk_percent", label: "Disk Usage (%)" },
  { value: "bounce_rate", label: "Bounce Rate (%)" },
  { value: "queue_size", label: "Queue Size" },
  { value: "delivery_rate", label: "Delivery Rate (%)" },
  { value: "spam_score", label: "Spam Score" },
];

const OPERATOR_OPTIONS = [
  { value: ">", label: "Greater than (>)" },
  { value: "<", label: "Less than (<)" },
  { value: "==", label: "Equal to (==)" },
  { value: "!=", label: "Not equal to (!=)" },
];

export function AlertRuleCreateEditFormDialog({
  rule,
  open,
  onClose,
}: AlertRuleCreateEditFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!rule;

  const [formData, setFormData] = useState<AlertRuleFormData>({
    name: "",
    description: "",
    severity: "warning",
    condition: "cpu_percent",
    operator: ">",
    threshold: null,
    duration: "5 minutes",
    channels: [],
    cooldown: "30 minutes",
    enabled: true,
  });

  const { data: channels = [] } = useQuery<Array<{ id: number; type: NotificationChannel; name: string }>>({
    queryKey: ["alerts", "channels"],
    queryFn: () => apiClient.get("/alerts/channels"),
    enabled: open,
  });

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description || "",
        severity: rule.severity as SeverityLevel,
        condition: rule.condition,
        operator: ">",
        threshold: rule.threshold,
        duration: rule.duration || "5 minutes",
        channels: rule.channels,
        cooldown: rule.cooldown,
        enabled: rule.enabled,
      });
    }
  }, [rule]);

  const saveMutation = useMutation({
    mutationFn: async (data: AlertRuleFormData) => {
      const payload = {
        ...data,
        condition: `${data.condition} ${data.operator} ${data.threshold}`,
      };

      if (isEdit && rule) {
        return apiClient.put(`/alerts/rules/${rule.id}`, payload);
      }
      return apiClient.post("/alerts/rules", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-md border border-border bg-surface p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {isEdit ? "Edit Alert Rule" : "Create Alert Rule"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-surface/80"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as SeverityLevel })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Condition</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Operator</label>
              <select
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {OPERATOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Threshold</label>
              <input
                type="number"
                value={formData.threshold ?? ""}
                onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Duration</label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 5 minutes"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cooldown</label>
              <input
                type="text"
                value={formData.cooldown}
                onChange={(e) => setFormData({ ...formData, cooldown: e.target.value })}
                placeholder="e.g., 30 minutes"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notification Channels</label>
            <div className="space-y-2">
              {channels.map((channel) => (
                <label key={channel.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.channels.includes(channel.type)}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...formData.channels, channel.type]
                        : formData.channels.filter((c) => c !== channel.type);
                      setFormData({ ...formData, channels: updated });
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-sm capitalize">{channel.type} - {channel.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="rounded border-border"
            />
            <label htmlFor="enabled" className="text-sm font-medium">
              Enable this rule
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className={cn(
                "rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {saveMutation.isPending ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface/80"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
