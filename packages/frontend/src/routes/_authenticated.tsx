import { useEffect } from "react";
import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-session-store";
import { useAlertNotificationStore } from "@/stores/alert-notification-toast-and-count-store";
import { AppShellLayout } from "@/components/layout/app-shell-layout";
import { AlertFiredToastNotificationPopup } from "@/components/alerts/alert-fired-toast-notification-popup";
import { socketClient } from "@/lib/socket-realtime-client";
import type { AlertEvent } from "@tinomail/shared";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addAlert = useAlertNotificationStore((state) => state.addAlert);
  const decrementCount = useAlertNotificationStore((state) => state.decrementCount);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Socket.IO listeners for alert events
    const handleAlertFired = (alert: AlertEvent) => {
      addAlert(alert);
    };

    const handleAlertResolved = () => {
      decrementCount();
    };

    socketClient.on("alert:fired", handleAlertFired);
    socketClient.on("alert:resolved", handleAlertResolved);

    return () => {
      socketClient.off("alert:fired", handleAlertFired);
      socketClient.off("alert:resolved", handleAlertResolved);
    };
  }, [isAuthenticated, addAlert, decrementCount]);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <AppShellLayout>
      <Outlet />
      <AlertFiredToastNotificationPopup />
    </AppShellLayout>
  );
}
