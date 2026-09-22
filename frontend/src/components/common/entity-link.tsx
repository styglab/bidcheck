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
        "inline-flex max-w-full items-center rounded-md border bg-white px-2 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:bg-background",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </Link>
  );
}
