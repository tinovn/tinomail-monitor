import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import type { EnrichedSendingIp } from "@tinomail/shared";
import { cn } from "@/lib/classname-utils";
import { TrendingUp, Calendar, AlertCircle } from "lucide-react";

interface IpWarmupScheduleManagerProps {
  ip: EnrichedSendingIp;
}

export function IpWarmupScheduleManager({ ip }: IpWarmupScheduleManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [warmupDay, setWarmupDay] = useState(ip.warmupDay);
  const [dailyLimit, setDailyLimit] = useState(ip.dailyLimit || 0);
  const queryClient = useQueryClient();

  const updateWarmupMutation = useMutation({
    mutationFn: async (data: { warmupDay: number; dailyLimit: number }) => {
      return apiClient.put(`/ips/${ip.ip}/warmup`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zonemta"] });
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    updateWarmupMutation.mutate({ warmupDay, dailyLimit });
  };

  const getWarmupProgress = () => {
    if (warmupDay === 0) return 0;
    return Math.min((warmupDay / 90) * 100, 100);
  };

  const getSuggestedLimit = (day: number) => {
    if (day === 0) return 50;
    if (day <= 7) return 50 + day * 50;
    if (day <= 30) return 400 + (day - 7) * 100;
    if (day <= 60) return 2700 + (day - 30) * 200;
    if (day <= 90) return 8700 + (day - 60) * 300;
    return 0; // Unlimited
  };

  const progress = getWarmupProgress();
  const suggestedLimit = getSuggestedLimit(warmupDay);

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-foreground">Warmup Schedule</h3>
        </div>
        <span className="text-sm text-muted-foreground font-mono">{ip.ip}</span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Day {warmupDay} of 90</span>
          <span className="font-medium text-foreground">{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              progress >= 100 ? "bg-status-ok" :
              progress >= 50 ? "bg-primary" : "bg-status-warning"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Daily Limit Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Daily Sent</span>
          <span className="font-medium text-foreground">
            {ip.currentDailySent.toLocaleString()} / {ip.dailyLimit?.toLocaleString() || "∞"}
          </span>
        </div>
        {ip.dailyLimit && (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                ip.currentDailySent >= ip.dailyLimit ? "bg-status-critical" :
                ip.currentDailySent >= ip.dailyLimit * 0.8 ? "bg-status-warning" : "bg-status-ok"
              )}
              style={{ width: `${Math.min((ip.currentDailySent / ip.dailyLimit) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Edit Form */}
      {isEditing ? (
        <div className="space-y-3 pt-3 border-t border-border">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Warmup Day
            </label>
            <input
              type="number"
              min="0"
              max="90"
              value={warmupDay}
              onChange={(e) => setWarmupDay(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Daily Limit
            </label>
            <input
              type="number"
              min="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Suggested: {suggestedLimit > 0 ? suggestedLimit.toLocaleString() : "Unlimited"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={updateWarmupMutation.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-md border border-border bg-surface text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-border">
          {/* Suggestions */}
          {ip.bounceRate < 2 && warmupDay >= 3 && warmupDay < 90 && (
            <div className="flex items-start gap-2 mb-3 p-2 rounded-md bg-status-ok/10 border border-status-ok/20">
              <TrendingUp className="h-4 w-4 text-status-ok mt-0.5" />
              <div className="text-xs text-foreground">
                <p className="font-medium">Warmup performing well!</p>
                <p className="text-muted-foreground mt-0.5">
                  Bounce rate below 2% for 3+ days. Consider increasing daily limit.
                </p>
              </div>
            </div>
          )}
          {ip.bounceRate > 5 && (
            <div className="flex items-start gap-2 mb-3 p-2 rounded-md bg-status-warning/10 border border-status-warning/20">
              <AlertCircle className="h-4 w-4 text-status-warning mt-0.5" />
              <div className="text-xs text-foreground">
                <p className="font-medium">High bounce rate detected</p>
                <p className="text-muted-foreground mt-0.5">
                  Consider pausing warmup and checking domain configuration.
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="w-full px-4 py-2 rounded-md border border-border bg-surface text-sm font-medium hover:bg-muted"
          >
            Edit Warmup Schedule
          </button>
        </div>
      )}
    </div>
  );
}
