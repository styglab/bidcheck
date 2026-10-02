import { Button } from "@/components/ui/button";
import { cn } from "cn";

type ListPaginationProps = {
  page: number;
  totalPages?: number;
  onChange: (page: number) => void;
  loading?: boolean;
  className?: string;
  label?: string;
};

export function ListPagination({ page, totalPages = 0, onChange, loading = false, className, label = "목록 페이지" }: ListPaginationProps) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  const pageButton = (value: number) => (
    <Button aria-current={page === value ? "page" : undefined} className={cn("w-9 px-0", page === value && "border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-blue-700")} disabled={loading} key={value} onClick={() => onChange(value)} size="sm" variant="outline">{value}</Button>
  );
  return (
    <nav className={cn("mt-5 flex items-center justify-center gap-1", className)} aria-label={label}>
      <Button aria-label="이전 페이지" disabled={loading || page <= 1} onClick={() => onChange(page - 1)} size="sm" variant="outline">이전</Button>
      <span className="text-sm font-medium tabular-nums sm:hidden">{page} / {totalPages}</span>
      <span className="hidden min-w-72 items-center justify-center gap-1 sm:flex">
        {start > 1 && <>{pageButton(1)}<span className="w-5 text-center text-sm text-muted-foreground">…</span></>}
        {pages.map(pageButton)}
        {start + pages.length - 1 < totalPages && <><span className="w-5 text-center text-sm text-muted-foreground">…</span>{pageButton(totalPages)}</>}
      </span>
      <Button aria-label="다음 페이지" disabled={loading || page >= totalPages} onClick={() => onChange(page + 1)} size="sm" variant="outline">다음</Button>
    </nav>
  );
}
