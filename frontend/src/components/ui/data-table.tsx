import type { CSSProperties, ReactNode } from "react";
import { cn } from "cn";

type DataTableProps = {
  children: ReactNode;
  className?: string;
  minWidth?: number;
};

export function DataTable({ children, className, minWidth = 640 }: DataTableProps) {
  return (
    <div className={cn("app-data-table-frame", className)}>
      <div className="overflow-x-auto">
        <table className="app-data-table" style={{ "--data-table-min-width": `${minWidth}px` } as CSSProperties}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function DataTableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td className="app-data-table-empty" colSpan={colSpan}>{children}</td></tr>;
}
