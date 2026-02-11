import { cn } from "@/lib/classname-utils";

interface LoadingSkeletonPlaceholderProps {
  className?: string;
  count?: number;
}

export function LoadingSkeletonPlaceholder({
  className,
  count = 1,
}: LoadingSkeletonPlaceholderProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-md bg-muted",
            className,
          )}
        />
      ))}
    </>
  );
}
