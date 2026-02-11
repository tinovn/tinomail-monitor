import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { AlertRule } from "@tinomail/shared";
import { AlertRulesCrudDataTable } from "@/components/alerts/alert-rules-crud-data-table";
import { AlertRuleCreateEditFormDialog } from "@/components/alerts/alert-rule-create-edit-form-dialog";

export const Route = createFileRoute("/_authenticated/alerts/rules")({
  component: AlertRulesPage,
});

function AlertRulesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | undefined>(undefined);

  const handleEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(undefined);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setEditingRule(undefined);
            setDialogOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          Create Rule
        </button>
      </div>

      {/* Rules Table */}
      <AlertRulesCrudDataTable onEditRule={handleEditRule} />

      {/* Create/Edit Dialog */}
      <AlertRuleCreateEditFormDialog
        rule={editingRule}
        open={dialogOpen}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
