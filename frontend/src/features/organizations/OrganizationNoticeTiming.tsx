import { MetricHelp } from "@/components/common/metric-help";
import { formatProcurementCount as count } from "./procurement-presentation";

type QuarterItem = {
  quarter: number;
  notice_count: number;
  notice_share: number;
};

export function OrganizationNoticeTiming({
  items,
  periodLabel,
}: {
  items: QuarterItem[];
  periodLabel: string;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.notice_count, 0);

  return (
    <div className="border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="flex items-center gap-1 text-sm">
          공고 게시 시기
          <MetricHelp label="분기별 공고 게시 비중 계산 기준">
            선택한 기간과 분야에서 게시일이 확인된 공고를 분기별로 집계합니다. 공고·낙찰·계약 활동 수와는 집계
            대상이 다릅니다.
          </MetricHelp>
        </strong>
        <span className="text-xs text-muted-foreground">
          {periodLabel} · 공고 {count(total)}건 기준
        </span>
      </div>
      <div className="mt-3 flex h-7 overflow-hidden rounded-md bg-muted">
        {items.map((item, index) => (
          <span
            className="grid min-w-fit place-items-center bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
            key={item.quarter}
            style={{ width: `${item.notice_share * 100}%`, opacity: 1 - index * 0.14 }}
            title={`${item.quarter}분기 ${(item.notice_share * 100).toFixed(1)}% · ${count(item.notice_count)}건`}
          >
            {item.notice_share >= 0.16 ? `${item.quarter}분기` : ""}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <span key={item.quarter}>
            {item.quarter}분기 <strong className="text-foreground">{count(item.notice_count)}건</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
