import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { Network, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/classname-utils";

interface IpCidrRangeFormProps {
  nodeId: string;
  onSuccess?: () => void;
}

export function IpCidrRangeForm({ nodeId, onSuccess }: IpCidrRangeFormProps) {
  const [cidr, setCidr] = useState("");
  const [subnet, setSubnet] = useState("");
  const [previewIps, setPreviewIps] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();

  const addRangeMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post("/ips/range", {
        cidr,
        nodeId,
        subnet: subnet || cidr,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zonemta"] });
      setCidr("");
      setSubnet("");
      setPreviewIps([]);
      setShowPreview(false);
      onSuccess?.();
    },
  });

  const handlePreview = () => {
    try {
      const [baseIp, prefixStr] = cidr.split("/");
      const prefix = parseInt(prefixStr, 10);

      if (prefix < 8 || prefix > 32) {
        alert("CIDR prefix must be between /8 and /32");
        return;
      }

      const hostBits = 32 - prefix;
      const numIps = Math.pow(2, hostBits) - 2;

      if (numIps > 1000) {
        alert("IP range too large. Maximum 1000 IPs per request.");
        return;
      }

      // Generate preview (first 10 IPs)
      const baseOctets = baseIp.split(".").map((o) => parseInt(o, 10));
      const preview = [];
      for (let i = 1; i <= Math.min(numIps, 10); i++) {
        const ip = [
          baseOctets[0],
          baseOctets[1],
          baseOctets[2],
          baseOctets[3] + i,
        ].join(".");
        preview.push(ip);
      }

      setPreviewIps(preview);
      setShowPreview(true);
    } catch (error) {
      alert("Invalid CIDR notation");
    }
  };

  const handleConfirm = () => {
    addRangeMutation.mutate();
  };

  const calculateTotalIps = () => {
    try {
      const [, prefixStr] = cidr.split("/");
      const prefix = parseInt(prefixStr, 10);
      const hostBits = 32 - prefix;
      return Math.pow(2, hostBits) - 2;
    } catch {
      return 0;
    }
  };

  const totalIps = calculateTotalIps();
  const isValidCidr = /^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(cidr);

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium text-foreground">Add IP Range (CIDR)</h3>
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            CIDR Notation
          </label>
          <input
            type="text"
            value={cidr}
            onChange={(e) => {
              setCidr(e.target.value);
              setShowPreview(false);
            }}
            placeholder="e.g., 192.168.1.0/24"
            className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm font-mono"
          />
          {isValidCidr && (
            <p className="mt-1 text-xs text-muted-foreground">
              Will generate {totalIps} IP addresses
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Subnet Label (Optional)
          </label>
          <input
            type="text"
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            placeholder="e.g., US-East-1"
            className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm"
          />
        </div>

        {!showPreview ? (
          <button
            onClick={handlePreview}
            disabled={!isValidCidr || totalIps === 0 || totalIps > 1000}
            className={cn(
              "w-full px-4 py-2 rounded-md text-sm font-medium transition-colors",
              "border border-border bg-surface hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Preview IPs
          </button>
        ) : (
          <>
            {/* Preview */}
            <div className="p-3 rounded-md bg-muted/30 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-status-ok" />
                <span className="text-sm font-medium text-foreground">
                  Preview ({previewIps.length} of {totalIps} IPs)
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {previewIps.map((ip) => (
                  <div key={ip} className="text-xs font-mono text-muted-foreground">
                    {ip}
                  </div>
                ))}
                {totalIps > 10 && (
                  <div className="text-xs text-muted-foreground italic">
                    ... and {totalIps - 10} more
                  </div>
                )}
              </div>
            </div>

            {/* Warning */}
            {totalIps > 254 && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-status-warning/10 border border-status-warning/20">
                <AlertTriangle className="h-4 w-4 text-status-warning mt-0.5" />
                <div className="text-xs text-foreground">
                  <p className="font-medium">Large IP range</p>
                  <p className="text-muted-foreground mt-0.5">
                    This will create {totalIps} IP entries. Consider using multiple smaller ranges for better management.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={addRangeMutation.isPending}
                className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {addRangeMutation.isPending ? "Creating..." : "Confirm & Create"}
              </button>
              <button
                onClick={() => setShowPreview(false)}
                disabled={addRangeMutation.isPending}
                className="px-4 py-2 rounded-md border border-border bg-surface text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Success Message */}
      {addRangeMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-status-ok/10 border border-status-ok/20">
          <CheckCircle className="h-4 w-4 text-status-ok" />
          <span className="text-sm text-foreground">
            IP range created successfully!
          </span>
        </div>
      )}

      {/* Error Message */}
      {addRangeMutation.isError && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-status-critical/10 border border-status-critical/20">
          <AlertTriangle className="h-4 w-4 text-status-critical" />
          <span className="text-sm text-foreground">
            Failed to create IP range. Please try again.
          </span>
        </div>
      )}
    </div>
  );
}
