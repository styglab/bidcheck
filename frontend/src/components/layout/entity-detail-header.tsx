import type { ReactNode } from "react";

const tones = {
  organization: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  company: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  notice: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

const badgeTones = {
  organization: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  company: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  notice: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
};

type Props = {
  tone: keyof typeof tones;
  icon: ReactNode;
  entityLabel: string;
  meta?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function EntityDetailHeader({ tone, icon, entityLabel, meta, title, actions, children }: Props) {
  return <header className="border-b pb-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded-md px-2 py-0.5 font-semibold ${badgeTones[tone]}`}>{entityLabel}</span>
            {meta}
          </div>
          <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {children}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  </header>;
}
