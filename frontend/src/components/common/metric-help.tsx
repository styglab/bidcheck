import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

export function MetricHelp({ label, children }: { label: string; children: ReactNode }) {
  return <button
    aria-label={label}
    className="group relative inline-flex rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
    type="button"
  >
    <CircleHelp aria-hidden="true" className="size-3.5" />
    <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-64 rounded-xl border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-hover:block group-focus:block">
      {children}
    </span>
  </button>;
}
