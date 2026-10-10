import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function EntityLink({
  type,
  to,
  children,
  className,
}: {
  type: "organization" | "company" | "notice";
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      data-entity={type}
      className={cn(
        "inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-xs font-semibold transition-colors",
        type === "notice" &&
          "bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200",
        type === "company" &&
          "bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-200",
        type === "organization" &&
          "bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/60 dark:text-violet-200",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </Link>
  );
}
