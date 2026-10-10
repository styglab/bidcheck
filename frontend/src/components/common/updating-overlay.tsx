import { LoaderCircle } from "lucide-react";

export function UpdatingOverlay({ show, label = "불러오는 중" }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-background/45 backdrop-blur-[1px]"
      role="status"
    >
      <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm">
        <LoaderCircle className="size-4 animate-spin text-primary" />
        {label}
      </span>
    </div>
  );
}
