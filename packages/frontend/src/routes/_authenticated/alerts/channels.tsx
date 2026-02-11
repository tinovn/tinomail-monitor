import { createFileRoute } from "@tanstack/react-router";
import { NotificationChannelsCrudListWithConfig } from "@/components/alerts/notification-channels-crud-list-with-config";

export const Route = createFileRoute("/_authenticated/alerts/channels")({
  component: AlertChannelsPage,
});

function AlertChannelsPage() {
  return (
    <div className="space-y-3">
      {/* Channels Configuration */}
      <NotificationChannelsCrudListWithConfig />
    </div>
  );
}
