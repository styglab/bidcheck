import { cn } from "cn";

type EntityTab = { id: string; label: string; count?: number };

export function EntityTabs({
  items,
  value,
  onChange,
  className,
  fillHeight = false,
}: {
  items: EntityTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  fillHeight?: boolean;
}) {
  return (
    <div className={cn("mt-9 overflow-x-auto border-b", className)} role="tablist">
      <div className={cn("flex min-w-max gap-1", fillHeight && "h-full items-stretch")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={value === item.id}
            onClick={() => onChange(item.id)}
            className={`border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${fillHeight ? "inline-flex items-center justify-center py-0" : "py-3"} ${value === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
            {item.count != null && (
              <span
                className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] leading-none ${value === item.id ? "bg-primary/10 text-primary" : "bg-muted"}`}
              >
                {item.count.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
