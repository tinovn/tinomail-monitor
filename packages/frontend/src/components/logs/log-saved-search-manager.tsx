import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { Save, ChevronDown, Trash2 } from "lucide-react";
import type { LogSearchFilters } from "@/routes/_authenticated/logs/index";

interface SavedSearch {
  id: string;
  name: string;
  config: LogSearchFilters;
  createdAt: string;
}

interface LogSavedSearchManagerProps {
  currentFilters: LogSearchFilters;
  onLoadSearch: (filters: LogSearchFilters) => void;
}

export function LogSavedSearchManager({
  currentFilters,
  onLoadSearch,
}: LogSavedSearchManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const queryClient = useQueryClient();

  const { data: savedSearches } = useQuery({
    queryKey: ["logs", "saved-searches"],
    queryFn: () => apiClient.get<SavedSearch[]>("/logs/saved-searches"),
  });

  const saveMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.post<SavedSearch>("/logs/saved-searches", {
        name,
        config: currentFilters,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs", "saved-searches"] });
      setSaveName("");
      setShowSaveInput(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del(`/logs/saved-searches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs", "saved-searches"] });
    },
  });

  const handleSave = () => {
    if (saveName.trim()) {
      saveMutation.mutate(saveName.trim());
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <Save className="h-4 w-4" />
        Saved Searches
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-md border border-border bg-surface shadow-lg">
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Saved Searches</h3>

            {/* Save Current Search */}
            <div className="mb-4">
              {showSaveInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Search name..."
                    className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveInput(false);
                      setSaveName("");
                    }}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="w-full rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  + Save Current Search
                </button>
              )}
            </div>

            {/* Saved Searches List */}
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {savedSearches && savedSearches.length > 0 ? (
                savedSearches.map((search) => (
                  <div
                    key={search.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background p-3 hover:bg-muted"
                  >
                    <button
                      onClick={() => {
                        onLoadSearch(search.config);
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left text-sm font-medium text-foreground"
                    >
                      {search.name}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(search.id)}
                      className="ml-2 rounded-md p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground">No saved searches</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
