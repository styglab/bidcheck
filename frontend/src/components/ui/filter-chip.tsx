import type { ComponentProps } from "react";
import { cn } from "cn";

type FilterChipProps = ComponentProps<"button"> & {
  selected?: boolean;
};

export function FilterChip({ className, selected = false, ...props }: FilterChipProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      type="button"
      {...props}
    />
  );
}
