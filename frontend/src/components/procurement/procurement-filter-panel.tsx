import { LoaderCircle, X } from "lucide-react";
import { Slider } from "radix-ui";
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
};

export function ProcurementFilterPanel({ earliestYear, currentYear, period, onPeriodChange, onPeriodCommit, workTypeValue, workTypeOptions, onWorkTypeChange, fieldValue, fieldOptions, fieldPlaceholder = "전체 분야", fieldDisabled, onFieldChange, appliedFilters, onReset, isUpdating }: Props) {
  return <section className="mt-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-label="조회 조건">
    <div className="flex flex-wrap items-end gap-4 lg:flex-nowrap">
      <div className="order-3 w-full min-w-0 lg:ml-auto lg:w-96">
        <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">조회 연도</p><strong className="text-sm tabular-nums">{period[0] === period[1] ? `${period[0]}년` : `${period[0]}–${period[1]}년`}</strong></div>
        <Slider.Root aria-label="조회 연도 범위" className="relative flex h-5 w-full touch-none select-none items-center" min={earliestYear} max={currentYear} step={1} minStepsBetweenThumbs={0} value={period} onValueChange={onPeriodChange} onValueCommit={onPeriodCommit}><Slider.Track className="relative h-1 grow rounded-full bg-muted"><Slider.Range className="absolute h-full rounded-full bg-blue-800 dark:bg-blue-500" /></Slider.Track><Slider.Thumb aria-label="시작 연도" className="block size-4 rounded-full border-2 border-blue-800 bg-background shadow-sm outline-none ring-offset-background transition-shadow hover:ring-3 hover:ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200 dark:border-blue-500" /><Slider.Thumb aria-label="종료 연도" className="block size-4 rounded-full border-2 border-blue-800 bg-background shadow-sm outline-none ring-offset-background transition-shadow hover:ring-3 hover:ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200 dark:border-blue-500" /></Slider.Root>
        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">{Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => <span key={earliestYear + index}>{earliestYear + index}</span>)}</div>
      </div>
      <div className="order-1 w-full sm:w-auto sm:shrink-0"><p className="mb-2 text-xs font-medium text-muted-foreground">조달 유형</p><Select value={workTypeValue} onValueChange={onWorkTypeChange}><SelectTrigger className="h-10 w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent position="popper">{workTypeOptions.map((option) => option.value ? <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem> : null)}</SelectContent></Select></div>
      <div className="order-2 w-full min-w-0 flex-1 sm:min-w-64"><p className="mb-2 text-xs font-medium text-muted-foreground">분야</p><Select value={fieldValue} onValueChange={onFieldChange} disabled={fieldDisabled}><SelectTrigger className="h-10 w-full"><SelectValue placeholder={fieldPlaceholder} /></SelectTrigger><SelectContent position="popper">{fieldOptions.map((option) => option.value ? <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem> : null)}</SelectContent></Select></div>
    </div>
    {appliedFilters.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/20"><span className="mr-1 font-semibold text-blue-800 dark:text-blue-200">적용 필터</span>{appliedFilters.map((filter) => <button className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-background px-3 py-1.5 font-semibold text-blue-800 shadow-sm hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-950" key={filter.key} onClick={filter.onRemove} type="button">{filter.label}<X className="size-3" /></button>)}<button className="ml-auto px-2 py-1.5 font-medium text-blue-800 hover:underline dark:text-blue-200" onClick={onReset} type="button">전체 초기화</button></div>}
    {isUpdating && <div className="mt-4 flex items-center justify-end gap-1.5 text-xs font-medium text-blue-800 dark:text-blue-300" role="status"><LoaderCircle className="size-3.5 animate-spin" /> 조건 적용 중</div>}
  </section>;
}
