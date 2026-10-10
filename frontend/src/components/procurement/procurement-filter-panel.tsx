import { LoaderCircle, X } from "lucide-react";
import { Slider } from "radix-ui";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FilterOption = { value?: string; label: string };
export type AppliedFilter = { key: string; label: string; onRemove: () => void };

type Props = {
  earliestYear: number;
  currentYear: number;
  period: number[];
  onPeriodChange: (value: number[]) => void;
  onPeriodCommit: (value: number[]) => void;
  workTypeValue: string;
  workTypeOptions: FilterOption[];
  onWorkTypeChange: (value: string) => void;
  fieldValue: string;
  fieldOptions: FilterOption[];
  fieldPlaceholder?: string;
  fieldDisabled?: boolean;
  onFieldChange: (value: string) => void;
  appliedFilters: AppliedFilter[];
  onReset: () => void;
  isUpdating?: boolean;
  compact?: boolean;
};

export function ProcurementFilterPanel({
  earliestYear,
  currentYear,
  period,
  onPeriodChange,
  onPeriodCommit,
  workTypeValue,
  workTypeOptions,
  onWorkTypeChange,
  fieldValue,
  fieldOptions,
  fieldPlaceholder = "전체 분야",
  fieldDisabled,
  onFieldChange,
  appliedFilters,
  onReset,
  isUpdating,
  compact = false,
}: Props) {
  return (
    <section
      className={compact ? "min-w-0" : "mt-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"}
      aria-label="조회 조건"
    >
      <div className={`flex flex-wrap items-end ${compact ? "gap-3" : "gap-4"} lg:flex-nowrap`}>
        <div className="order-3 w-full min-w-0 lg:ml-auto lg:w-96">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">조회 연도</p>
            <strong className="text-sm tabular-nums">
              {period[0] === period[1] ? `${period[0]}년` : `${period[0]}–${period[1]}년`}
            </strong>
          </div>
          <Slider.Root
            aria-label="조회 연도 범위"
            className="relative flex h-5 w-full touch-none select-none items-center"
            min={earliestYear}
            max={currentYear}
            step={1}
            minStepsBetweenThumbs={0}
            value={period}
            onValueChange={onPeriodChange}
            onValueCommit={onPeriodCommit}
          >
            <Slider.Track className="relative h-1 grow rounded-full bg-muted">
              <Slider.Range className="absolute h-full rounded-full bg-primary" />
            </Slider.Track>
            <Slider.Thumb
              aria-label="시작 연도"
              className="block size-4 rounded-full border-2 border-primary bg-background shadow-sm outline-none ring-offset-background transition-shadow hover:ring-3 hover:ring-primary/10 focus-visible:ring-3 focus-visible:ring-primary/20"
            />
            <Slider.Thumb
              aria-label="종료 연도"
              className="block size-4 rounded-full border-2 border-primary bg-background shadow-sm outline-none ring-offset-background transition-shadow hover:ring-3 hover:ring-primary/10 focus-visible:ring-3 focus-visible:ring-primary/20"
            />
          </Slider.Root>
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            {Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => (
              <span key={earliestYear + index}>{earliestYear + index}</span>
            ))}
          </div>
        </div>
        <div className="order-1 w-full sm:w-auto sm:shrink-0">
          <p className="mb-2 text-xs font-medium text-muted-foreground">조달 유형</p>
          <Select value={workTypeValue} onValueChange={onWorkTypeChange}>
            <SelectTrigger className="h-10 w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {workTypeOptions.map((option) =>
                option.value ? (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ) : null,
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="order-2 w-full min-w-0 flex-1 sm:min-w-64">
          <p className="mb-2 text-xs font-medium text-muted-foreground">분야</p>
          <SearchableSelect
            ariaLabel="분야"
            disabled={fieldDisabled}
            emptyMessage="일치하는 분야가 없습니다."
            onValueChange={onFieldChange}
            options={fieldOptions}
            placeholder={fieldPlaceholder}
            searchPlaceholder="분야명 검색"
            value={fieldValue}
          />
        </div>
      </div>
      {appliedFilters.length > 0 && (
        <div
          className={`${compact ? "mt-3 py-2" : "mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-3"} flex flex-wrap items-center gap-2 text-xs`}
        >
          <span className="mr-1 font-semibold text-primary">적용 필터</span>
          {appliedFilters.map((filter) => (
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-3 py-1.5 font-semibold text-primary shadow-sm hover:bg-primary/[0.07]"
              key={filter.key}
              onClick={filter.onRemove}
              type="button"
            >
              {filter.label}
              <X className="size-3" />
            </button>
          ))}
          <button
            className="ml-auto px-2 py-1.5 font-medium text-primary hover:underline"
            onClick={onReset}
            type="button"
          >
            전체 초기화
          </button>
        </div>
      )}
      {isUpdating && (
        <div
          className={`${compact ? "mt-2" : "mt-4"} flex items-center justify-end gap-1.5 text-xs font-medium text-primary`}
          role="status"
        >
          <LoaderCircle className="size-3.5 animate-spin" /> 조건 적용 중
        </div>
      )}
    </section>
  );
}
