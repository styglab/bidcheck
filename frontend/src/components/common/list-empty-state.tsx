import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ListEmptyState({
  title = "조회 결과가 없습니다",
  description = "조회 조건을 변경한 뒤 다시 확인해 주세요.",
  onReset,
}: {
  title?: string;
  description?: string;
  onReset?: () => void;
}) {
  return (
    <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed bg-muted/15 p-6 text-center">
      <div>
        <SearchX className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {onReset && (
          <Button className="mt-4" onClick={onReset} size="sm" variant="outline">
            조건 초기화
          </Button>
        )}
      </div>
    </div>
  );
}
