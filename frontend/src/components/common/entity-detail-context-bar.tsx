import { AlertCircle, Check, ChevronDown, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";

type EntityTab = { id: string; label: string; count?: number };

type Props = {
  tabs: EntityTab[];
  value: string;
  onTabChange: (value: string) => void;
  conditionSummary: string;
  compactConditionSummary?: string;
  appliedFilterCount: number;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  isUpdating?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  children: ReactNode;
};

export function EntityDetailContextBar({
  tabs,
  value,
  onTabChange,
  conditionSummary,
  compactConditionSummary,
  appliedFilterCount,
  filterOpen,
  onFilterOpenChange,
  isUpdating,
  hasError,
  onRetry,
  children,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filterPanelId = useId();
  const wasUpdating = useRef(false);
  const [isStuck, setIsStuck] = useState(false);
  const [showApplied, setShowApplied] = useState(false);

  useEffect(() => {
    let frame = 0;
    const updateStuckState = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const headerHeight = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--site-header-height"),
        );
        setIsStuck(
          (rootRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY) <=
            (Number.isFinite(headerHeight) ? headerHeight : 70) + 1,
        );
      });
    };
    updateStuckState();
    window.addEventListener("scroll", updateStuckState, { passive: true });
    window.addEventListener("resize", updateStuckState);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateStuckState);
      window.removeEventListener("resize", updateStuckState);
    };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    if (wasUpdating.current && !isUpdating) {
      setShowApplied(true);
      timer = window.setTimeout(() => setShowApplied(false), 1200);
    }
    wasUpdating.current = Boolean(isUpdating);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [isUpdating]);

  useEffect(() => {
    if (!filterOpen) return;
    const closeAndRestoreFocus = () => {
      onFilterOpenChange(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (rootRef.current?.contains(target) || target.closest("[data-radix-popper-content-wrapper]")) return;
      closeAndRestoreFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper]")) return;
      event.preventDefault();
      closeAndRestoreFocus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterOpen, onFilterOpenChange]);

  return (
    <section
      className={`sticky top-[var(--site-header-height,70px)] z-20 -mx-5 mt-6 bg-card transition-shadow sm:-mx-7 ${isStuck ? "shadow-[0_8px_18px_-16px_rgb(15_23_42/0.55)]" : ""}`}
      aria-label="상세 탐색 및 조회 조건"
      ref={rootRef}
    >
      <div className="flex min-h-14 items-stretch border-y px-2 sm:px-4">
        <EntityTabs
          className="mt-0 h-14 min-w-0 flex-1 border-b-0"
          fillHeight
          items={tabs}
          onChange={onTabChange}
          value={value}
        />
        <div className="ml-2 flex min-w-0 shrink-0 items-center gap-3 border-l pl-3">
          {compactConditionSummary && (
            <span className="hidden max-w-36 truncate text-xs font-medium text-muted-foreground md:block lg:hidden">
              {compactConditionSummary}
            </span>
          )}
          <span className="hidden max-w-64 truncate text-xs font-medium text-muted-foreground lg:block xl:max-w-80">
            {conditionSummary}
          </span>
          <span className="sr-only" aria-live="polite">
            {hasError
              ? "조건 적용에 실패했습니다"
              : isUpdating
                ? "조건 적용 중"
                : showApplied
                  ? "조건이 적용되었습니다"
                  : ""}
          </span>
          {hasError ? (
            <span
              className="hidden items-center gap-1.5 text-xs font-medium text-destructive sm:inline-flex"
              role="alert"
            >
              <AlertCircle className="size-3.5" aria-hidden="true" />
              적용 실패
              {onRetry && (
                <button className="underline underline-offset-2" onClick={onRetry} type="button">
                  재시도
                </button>
              )}
            </span>
          ) : isUpdating ? (
            <span className="hidden items-center gap-1.5 text-xs font-medium text-primary sm:inline-flex">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              조건 적용 중
            </span>
          ) : showApplied ? (
            <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-700 sm:inline-flex dark:text-emerald-300">
              <Check className="size-3.5" aria-hidden="true" />
              적용됨
            </span>
          ) : null}
          <button
            aria-controls={filterPanelId}
            aria-expanded={filterOpen}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-3 sm:text-sm ${hasError ? "border-destructive/50" : ""}`}
            onClick={() => onFilterOpenChange(!filterOpen)}
            ref={triggerRef}
            type="button"
          >
            <SlidersHorizontal className="size-3.5 sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">조건 변경</span>
            <span className="sm:hidden">필터</span>
            {appliedFilterCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] tabular-nums text-primary">
                {appliedFilterCount}
              </span>
            )}
            <ChevronDown
              className={`hidden size-3.5 transition-transform sm:block ${filterOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      {filterOpen && (
        <div
          className="absolute inset-x-0 top-full max-h-[calc(100vh-var(--site-header-height,70px)-3.5rem)] overflow-y-auto border-b bg-card p-4 shadow-xl sm:p-5"
          id={filterPanelId}
        >
          {children}
        </div>
      )}
    </section>
  );
}
