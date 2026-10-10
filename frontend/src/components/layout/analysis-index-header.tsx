import type { ReactNode } from "react";

export function AnalysisIndexHeader({
  label,
  title,
  description,
  meta,
}: {
  label: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-7 border-b pb-7 sm:mb-8 sm:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">{label}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        </div>
        {meta && <div className="shrink-0 text-xs text-muted-foreground">{meta}</div>}
      </div>
    </header>
  );
}
