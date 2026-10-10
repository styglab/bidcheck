import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export function EntitySectionHeader({
  title,
  description,
  meta,
  headingId,
  level = 2,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  headingId?: string;
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading
          className={
            level === 3
              ? "text-base font-semibold text-foreground"
              : "text-xl font-bold tracking-tight text-foreground"
          }
          id={headingId}
        >
          {title}
        </Heading>
        {description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {meta && <div className="shrink-0 text-xs text-muted-foreground">{meta}</div>}
    </div>
  );
}

export function EntityDetailSection({
  title,
  description,
  meta,
  headingId,
  sectionId,
  divided = false,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  headingId?: string;
  sectionId?: string;
  divided?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(divided ? "mt-9 border-t pt-9 sm:mt-12 sm:pt-12" : "mt-8", className)}
      aria-labelledby={headingId}
      id={sectionId}
    >
      <EntitySectionHeader headingId={headingId} title={title} description={description} meta={meta} />
      {children}
    </section>
  );
}

export function EntityMetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid border-y", className)}>{children}</dl>;
}

export function EntityMetric({
  label,
  value,
  note,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-1 py-5", className)}>
      <dt className="flex min-h-4 items-center gap-1 text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</dd>
      {note && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{note}</p>}
    </div>
  );
}

export function EntityMetricValue({ value, unit }: { value: ReactNode; unit?: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{value}</span>
      {unit && <span className="text-sm font-semibold tracking-normal text-muted-foreground">{unit}</span>}
    </span>
  );
}

export function EntityDetailPanel({
  children,
  className,
  muted = true,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return <div className={cn("border-y py-5", muted && "bg-muted/[0.08]", className)}>{children}</div>;
}

export function EntityDetailToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-muted/[0.08] p-3.5", className)}>{children}</div>;
}

export function EntityDetailAction({
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <Button size="sm" variant="outline" {...props}>
      {children}
    </Button>
  );
}
