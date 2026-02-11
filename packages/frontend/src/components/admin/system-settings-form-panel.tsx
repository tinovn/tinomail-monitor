import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";

interface SystemSettings {
  retention: {
    rawMetricsDays: number;
    emailEventsDays: number;
    aggregatedDays: number;
  };
  collection: {
    systemMetricsInterval: number;
    dnsblCheckInterval: number;
    alertEvaluationInterval: number;
  };
  display: {
    defaultTimezone: string;
    defaultTheme: string;
    dashboardTitle: string;
  };
  alerts: {
    defaultCooldown: number;
    escalationEnabled: boolean;
  };
}

export function SystemSettingsFormPanel() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["admin", "settings"],
    queryFn: () => apiClient.get("/admin/settings"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      apiClient.put(`/admin/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      alert("Setting updated successfully");
    },
  });

  const handleUpdate = (key: string, value: unknown) => {
    updateMutation.mutate({ key, value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Data Retention */}
      <div className="rounded-md border border-border bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Data Retention</h3>
        <div className="space-y-4">
          <SettingInput
            label="Raw Metrics (days)"
            value={settings.retention.rawMetricsDays}
            min={7}
            onSave={(value) => handleUpdate("retention.rawMetricsDays", value)}
          />
          <SettingInput
            label="Email Events (days)"
            value={settings.retention.emailEventsDays}
            onSave={(value) => handleUpdate("retention.emailEventsDays", value)}
          />
          <SettingInput
            label="Aggregated Data (days)"
            value={settings.retention.aggregatedDays}
            onSave={(value) => handleUpdate("retention.aggregatedDays", value)}
          />
        </div>
      </div>

      {/* Collection Intervals */}
      <div className="rounded-md border border-border bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Collection Intervals (seconds)</h3>
        <div className="space-y-4">
          <SettingInput
            label="System Metrics Interval"
            value={settings.collection.systemMetricsInterval}
            onSave={(value) => handleUpdate("collection.systemMetricsInterval", value)}
          />
          <SettingInput
            label="DNSBL Check Interval"
            value={settings.collection.dnsblCheckInterval}
            onSave={(value) => handleUpdate("collection.dnsblCheckInterval", value)}
          />
          <SettingInput
            label="Alert Evaluation Interval"
            value={settings.collection.alertEvaluationInterval}
            onSave={(value) => handleUpdate("collection.alertEvaluationInterval", value)}
          />
        </div>
      </div>

      {/* Display Settings */}
      <div className="rounded-md border border-border bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Display Settings</h3>
        <div className="space-y-4">
          <SettingSelectInput
            label="Default Timezone"
            value={settings.display.defaultTimezone}
            options={["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"]}
            onSave={(value) => handleUpdate("display.defaultTimezone", value)}
          />
          <SettingSelectInput
            label="Default Theme"
            value={settings.display.defaultTheme}
            options={["dark", "light"]}
            onSave={(value) => handleUpdate("display.defaultTheme", value)}
          />
          <SettingInput
            label="Dashboard Title"
            value={settings.display.dashboardTitle}
            onSave={(value) => handleUpdate("display.dashboardTitle", value)}
          />
        </div>
      </div>

      {/* Alert Settings */}
      <div className="rounded-md border border-border bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Alert Settings</h3>
        <div className="space-y-4">
          <SettingInput
            label="Default Cooldown (seconds)"
            value={settings.alerts.defaultCooldown}
            onSave={(value) => handleUpdate("alerts.defaultCooldown", value)}
          />
          <SettingSwitchInput
            label="Escalation Enabled"
            value={settings.alerts.escalationEnabled}
            onSave={(value) => handleUpdate("alerts.escalationEnabled", value)}
          />
        </div>
      </div>
    </div>
  );
}

// Helper component for number/string input
function SettingInput({
  label,
  value,
  min,
  onSave,
}: {
  label: string;
  value: number | string;
  min?: number;
  onSave: (value: number | string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const handleSave = () => {
    const finalValue = typeof value === "number" ? Number(editValue) : editValue;
    onSave(finalValue);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type={typeof value === "number" ? "number" : "text"}
            value={editValue}
            min={min}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
          />
          <button
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setEditValue(String(value));
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{value}</span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// Helper component for select input
function SettingSelectInput({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: string;
  options: string[];
  onSave: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// Helper component for switch/toggle input
function SettingSwitchInput({
  label,
  value,
  onSave,
}: {
  label: string;
  value: boolean;
  onSave: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <button
        onClick={() => onSave(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
