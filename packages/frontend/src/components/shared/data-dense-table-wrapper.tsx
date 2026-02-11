import { cn } from "@/lib/classname-utils";

interface DataDenseTableWrapperProps {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export function DataDenseTableWrapper({
  children,
  maxHeight,
  className,
}: DataDenseTableWrapperProps) {
  return (
    <div
      className={cn(
        "overflow-auto rounded-md border border-border bg-surface",
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full table-dense">{children}</table>
    </div>
  );
}
