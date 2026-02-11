import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/classname-utils";

interface EmptyStatePlaceholderProps {
  icon?: LucideIcon;
  message: string;
  description?: string;
  className?: string;
}

export function EmptyStatePlaceholder({
  icon: Icon,
  message,
  description,
  className,
}: EmptyStatePlaceholderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-12 text-center",
        className,
      )}
    >
      {Icon && <Icon className="mb-4 h-12 w-12 text-muted-foreground" />}
      <p className="text-sm font-medium text-foreground">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
