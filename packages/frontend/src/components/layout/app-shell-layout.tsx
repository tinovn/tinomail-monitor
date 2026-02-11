import { ReactNode } from "react";
import { useSidebarStore } from "@/stores/sidebar-navigation-store";
import { AppSidebarNavigation } from "./app-sidebar-navigation";
import { AppHeaderBar } from "./app-header-bar";
import { cn } from "@/lib/classname-utils";

interface AppShellLayoutProps {
  children: ReactNode;
}

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const collapsed = useSidebarStore((state) => state.collapsed);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-surface transition-all duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-10 items-center border-b border-border px-3",
            collapsed && "justify-center px-2",
          )}
        >
          {!collapsed && (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation
            </span>
          )}
        </div>
        <AppSidebarNavigation />
      </aside>

      <div className="flex flex-1 flex-col">
        <AppHeaderBar />
        <main className="flex-1 overflow-auto p-3">{children}</main>
      </div>
    </div>
  );
}
