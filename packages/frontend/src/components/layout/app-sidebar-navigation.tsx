import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Server,
  Mail,
  Network,
  Globe,
  Users,
  MapPin,
  Shield,
  ShieldAlert,
  Search,
  Bell,
  FileText,
  Settings,
  Database,
} from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-navigation-store";
import { cn } from "@/lib/classname-utils";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, to: "/" },
  { id: "servers", label: "Servers", icon: Server, to: "/servers" },
  { id: "mongodb", label: "MongoDB", icon: Database, to: "/servers/mongodb" },
  { id: "email-flow", label: "Email Flow", icon: Mail, to: "/email-flow" },
  { id: "zonemta", label: "ZoneMTA / IPs", icon: Network, to: "/servers/zonemta" },
  { id: "domains", label: "Domains", icon: Globe, to: "/domains" },
  { id: "users", label: "Users", icon: Users, to: "/users" },
  {
    id: "destinations",
    label: "Destinations",
    icon: MapPin,
    to: "/destinations",
  },
  { id: "logs", label: "Logs", icon: Search, to: "/logs" },
  {
    id: "ip-reputation",
    label: "IP Reputation",
    icon: Shield,
    to: "/ip-reputation",
  },
  {
    id: "spam-security",
    label: "Spam & Security",
    icon: ShieldAlert,
    to: "/spam-security",
  },
  { id: "alerts", label: "Alerts", icon: Bell, to: "/alerts" },
  { id: "reports", label: "Reports", icon: FileText, to: "/reports" },
  { id: "admin", label: "Admin", icon: Settings, to: "/admin" },
];

export function AppSidebarNavigation() {
  const { collapsed } = useSidebarStore();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav className="flex-1 space-y-0.5 px-1.5 py-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to));

        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-surface-elevated text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "justify-center",
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
