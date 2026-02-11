import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";

interface DashboardUser {
  id: string;
  username: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  createdAt: string;
}

interface DashboardUserCreateEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  user?: DashboardUser;
}

export function DashboardUserCreateEditDialog({
  isOpen,
  onClose,
  mode,
  user,
}: DashboardUserCreateEditDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "viewer" as "admin" | "operator" | "viewer",
  });

  useEffect(() => {
    if (mode === "edit" && user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: "",
        role: user.role,
      });
    } else {
      setFormData({
        username: "",
        email: "",
        password: "",
        role: "viewer",
      });
    }
  }, [mode, user, isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.post("/admin/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiClient.put(`/admin/users/${user?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create") {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ email: formData.email, role: formData.role });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          {mode === "create" ? "Create User" : "Edit User"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username (create only) */}
          {mode === "create" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Username</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>

          {/* Password (create only) */}
          {mode === "create" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </div>
          )}

          {/* Role */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Role</label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as "admin" | "operator" | "viewer" })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface/80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mode === "create" ? "Create" : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
