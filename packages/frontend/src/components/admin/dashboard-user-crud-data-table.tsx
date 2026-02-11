import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { DashboardUserCreateEditDialog } from "./dashboard-user-create-edit-dialog";
import { cn } from "@/lib/classname-utils";

interface DashboardUser {
  id: string;
  username: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  createdAt: string;
}

export function DashboardUserCrudDataTable() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DashboardUser | null>(null);

  const { data: users = [], isLoading } = useQuery<DashboardUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => apiClient.get("/admin/users"),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiClient.del(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      apiClient.post(`/admin/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      alert("Password reset successfully");
    },
  });

  const handleResetPassword = (userId: string) => {
    const newPassword = prompt("Enter new password:");
    if (newPassword) {
      resetPasswordMutation.mutate({ userId, newPassword });
    }
  };

  const handleDelete = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteMutation.mutate(userId);
    }
  };

  const roleColors: Record<string, string> = {
    admin: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    operator: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    viewer: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create User Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-md border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead>
              <tr className="">
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Username</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Created</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-surface/80"
                >
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{user.username}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium capitalize",
                        roleColors[user.role],
                      )}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-sm font-medium text-blue-500 hover:text-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="text-sm font-medium text-yellow-500 hover:text-yellow-600"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-sm font-medium text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <DashboardUserCreateEditDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        mode="create"
      />

      {/* Edit Dialog */}
      {editingUser && (
        <DashboardUserCreateEditDialog
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          mode="edit"
          user={editingUser}
        />
      )}
    </div>
  );
}
