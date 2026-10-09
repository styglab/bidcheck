import { ArrowDown, ArrowUpRight, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ProcurementRelationship } from "@/features/organizations/api";
import { formatCompactMoney as money } from "@/shared/format/money";

type CounterpartType = "organization" | "company";

type TreemapEntry = {
  key: string;
  label: string;
  amount: number;
  contractCount?: number;
  weight: number;
  rank?: number;
  relationship?: ProcurementRelationship;
  groupedCount?: number;
};

type TreemapBranch =
  | { kind: "leaf"; entry: TreemapEntry; value: number }
  | { kind: "split"; direction: "row" | "column"; children: TreemapBranch[]; value: number };

type Props = {
  title: string;
  description: string;
  counterpartType: CounterpartType;
  relationships: ProcurementRelationship[];
  counterpartCount?: number | null;
  totalAmount?: number | null;
  topFiveShare?: number | null;
  aggregateUnlisted?: boolean;
  showMetrics?: boolean;
  enableDistributionView?: boolean;
  selectedRelationship?: ProcurementRelationship;
  onSelectRelationship?: (relationship?: ProcurementRelationship) => void;
  relationshipDetail?: ReactNode;
  relationshipDetailLoading?: boolean;
  getCounterpartHref: (relationship: ProcurementRelationship) => string | undefined;
  onOpenContracts?: (relationship: ProcurementRelationship) => void;
};

const counterpartKey = (relationship: ProcurementRelationship, type: CounterpartType) =>
  type === "organization" ? relationship.organization_code : relationship.company_number;

const counterpartName = (relationship: ProcurementRelationship, type: CounterpartType) =>
  (type === "organization" ? relationship.organization_name : relationship.company_name) ||
  counterpartKey(relationship, type) ||
  "이름 미확인";

function buildBranch(entries: TreemapEntry[], depth = 0): TreemapBranch {
  if (entries.length === 1) return { kind: "leaf", entry: entries[0], value: entries[0].weight };
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let running = 0;
  let splitAt = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < entries.length; index += 1) {
    running += entries[index - 1].weight;
    const difference = Math.abs(total / 2 - running);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      splitAt = index;
    }
  }
  return {
    kind: "split",
    direction: depth % 2 === 0 ? "row" : "column",
    value: total,
    children: [
      buildBranch(entries.slice(0, splitAt), depth + 1),
      buildBranch(entries.slice(splitAt), depth + 1),
    ],
  };
}

export function RelationshipTreemap({
  title,
  description,
  counterpartType,
  relationships,
  counterpartCount,
  totalAmount,
  topFiveShare,
  aggregateUnlisted = false,
  showMetrics = true,
  enableDistributionView = false,
  selectedRelationship,
  onSelectRelationship,
  relationshipDetail,
  relationshipDetailLoading = false,
  getCounterpartHref,
  onOpenContracts,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>();
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionWidth, setSectionWidth] = useState(1200);
  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new ResizeObserver(([entry]) => setSectionWidth(entry.contentRect.width));
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);
  const contracted = useMemo(
    () =>
      relationships
        .filter((relationship) => relationship.contract_event_count > 0)
        .sort(
          (left, right) =>
            (right.total_attributed_contract_amount ?? 0) - (left.total_attributed_contract_amount ?? 0),
        ),
    [relationships],
  );
  const loadedTotal = contracted.reduce(
    (sum, relationship) => sum + Math.max(0, relationship.total_attributed_contract_amount ?? 0),
    0,
  );
  const knownTotal =
    (aggregateUnlisted || enableDistributionView) && totalAmount != null ? totalAmount : loadedTotal;
  const responsiveMaximum = sectionWidth < 640 ? 10 : sectionWidth < 900 ? 14 : 20;
  const visibleLimit = useMemo(() => {
    if (!enableDistributionView) return showAll ? 50 : 15;
    const maximum = Math.min(responsiveMaximum, contracted.length);
    const minimum = Math.min(10, maximum);
    if (knownTotal <= 0) return minimum;
    let count = minimum;
    let cumulative = contracted
      .slice(0, count)
      .reduce(
        (sum, relationship) => sum + Math.max(0, relationship.total_attributed_contract_amount ?? 0),
        0,
      );
    while (count < maximum && cumulative / knownTotal < 0.5) {
      cumulative += Math.max(0, contracted[count].total_attributed_contract_amount ?? 0);
      count += 1;
    }
    return count;
  }, [contracted, enableDistributionView, knownTotal, responsiveMaximum, showAll]);
  const entries = useMemo(() => {
    const visible = contracted.slice(0, visibleLimit);
    const visibleTotal = visible.reduce(
      (sum, relationship) => sum + Math.max(0, relationship.total_attributed_contract_amount ?? 0),
      0,
    );
    const minimumWeight =
      (enableDistributionView ? visibleTotal : knownTotal) > 0
        ? (enableDistributionView ? visibleTotal : knownTotal) * 0.008
        : 1;
    const result: TreemapEntry[] = visible.map((relationship, index) => {
      const amount = Math.max(0, relationship.total_attributed_contract_amount ?? 0);
      return {
        key: counterpartKey(relationship, counterpartType) || `unknown-${index}`,
        label: counterpartName(relationship, counterpartType),
        amount,
        contractCount: relationship.contract_event_count,
        weight: amount > 0 ? amount : Math.max(minimumWeight, relationship.contract_event_count),
        rank: index + 1,
        relationship,
      };
    });
    if (enableDistributionView) return result;
    const loadedRemaining = contracted.slice(visibleLimit);
    const unlistedCount = aggregateUnlisted
      ? Math.max(0, (counterpartCount ?? contracted.length) - visible.length)
      : loadedRemaining.length;
    if (unlistedCount > 0) {
      const loadedRemainingAmount = loadedRemaining.reduce(
        (sum, relationship) => sum + Math.max(0, relationship.total_attributed_contract_amount ?? 0),
        0,
      );
      const visibleAmount = visible.reduce(
        (sum, relationship) => sum + Math.max(0, relationship.total_attributed_contract_amount ?? 0),
        0,
      );
      const amount =
        aggregateUnlisted && totalAmount != null
          ? Math.max(0, totalAmount - visibleAmount)
          : loadedRemainingAmount;
      result.push({
        key: "other",
        label: `기타 ${unlistedCount.toLocaleString("ko-KR")}곳`,
        amount,
        contractCount: aggregateUnlisted
          ? undefined
          : loadedRemaining.reduce((sum, relationship) => sum + relationship.contract_event_count, 0),
        weight: amount > 0 ? amount : Math.max(minimumWeight, unlistedCount),
        groupedCount: unlistedCount,
      });
    }
    return result;
  }, [
    aggregateUnlisted,
    contracted,
    counterpartCount,
    counterpartType,
    enableDistributionView,
    knownTotal,
    totalAmount,
    visibleLimit,
  ]);
  const branch = entries.length ? buildBranch(entries) : undefined;
  const comparisonTotal = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const selected =
    selectedRelationship ??
    contracted.find((relationship) => counterpartKey(relationship, counterpartType) === selectedKey);
  const selectedAmount = selected?.total_attributed_contract_amount ?? 0;
  const selectedShare = knownTotal > 0 && selectedAmount > 0 ? selectedAmount / knownTotal : undefined;
  const selectedHref = selected ? getCounterpartHref(selected) : undefined;

  const renderBranch = (item: TreemapBranch): ReactNode => {
    if (item.kind === "leaf") {
      const { entry } = item;
      const shareTotal = enableDistributionView ? comparisonTotal : knownTotal;
      const share = shareTotal > 0 && entry.amount > 0 ? entry.amount / shareTotal : undefined;
      const density = entry.groupedCount
        ? "other"
        : (entry.rank ?? 99) <= 2
          ? "primary"
          : (entry.rank ?? 99) <= 5
            ? "secondary"
            : "standard";
      return (
        <button
          type="button"
          className={`relationship-treemap-tile ${density}${selectedKey === entry.key ? " is-selected" : ""}`}
          style={{ flexGrow: item.value, flexBasis: 0 }}
          disabled={!entry.relationship}
          onClick={() => {
            if (!entry.relationship) return;
            setSelectedKey(entry.key);
            onSelectRelationship?.(entry.relationship);
          }}
          aria-label={`${entry.label}${entry.contractCount == null ? "" : `, 계약 ${entry.contractCount.toLocaleString("ko-KR")}건`}, ${entry.amount > 0 ? money(entry.amount) : "금액 미확인"}`}
          title={`${entry.label} · ${entry.amount > 0 ? money(entry.amount) : "금액 미확인"}${entry.contractCount == null ? "" : ` · 계약 ${entry.contractCount.toLocaleString("ko-KR")}건`}`}
        >
          {entry.rank && <span className="relationship-treemap-rank">{entry.rank}</span>}
          <span className="relationship-treemap-label">
            <strong>{entry.label}</strong>
            <span className="relationship-treemap-value">
              {entry.amount > 0 ? money(entry.amount) : "금액 미확인"}
              {share != null && <small>{(share * 100).toFixed(1)}%</small>}
            </span>
            {entry.contractCount != null && (
              <small className="relationship-treemap-count">
                계약 {entry.contractCount.toLocaleString("ko-KR")}건
              </small>
            )}
          </span>
        </button>
      );
    }
    return (
      <div
        className={`relationship-treemap-split ${item.direction}`}
        style={{ flexGrow: item.value, flexBasis: 0 }}
      >
        {item.children.map((child, index) => (
          <div
            className="relationship-treemap-branch"
            style={{ flexGrow: child.value, flexBasis: 0 }}
            key={index}
          >
            {renderBranch(child)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <section
      className="relationship-overview-treemap"
      aria-labelledby="relationship-treemap-title"
      ref={sectionRef}
    >
      <div className="relationship-overview-heading">
        <div>
          <h2 className="text-xl font-bold tracking-tight" id="relationship-treemap-title">
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {!enableDistributionView && contracted.length > 15 && (
          <Button size="sm" variant="outline" onClick={() => setShowAll((current) => !current)}>
            {showAll
              ? "상위 15개만"
              : `전체 ${Math.min(contracted.length, 50).toLocaleString("ko-KR")}개 보기`}
            <ArrowDown className={`ml-1 size-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
          </Button>
        )}
      </div>

      {showMetrics && (
        <dl className="relationship-overview-metrics">
          <div>
            <dt>계약 상대</dt>
            <dd>{(counterpartCount ?? contracted.length).toLocaleString("ko-KR")}곳</dd>
          </div>
          <div>
            <dt>귀속 계약금액</dt>
            <dd>{money(totalAmount ?? knownTotal)}</dd>
          </div>
          <div>
            <dt>상위 5개 금액 비중</dt>
            <dd>{topFiveShare == null ? "-" : `${(topFiveShare * 100).toFixed(1)}%`}</dd>
          </div>
        </dl>
      )}

      {enableDistributionView &&
        (() => {
          const topFiveRatio = topFiveShare ?? 0;
          const displayedRatio = knownTotal > 0 ? Math.min(1, comparisonTotal / knownTotal) : 0;
          const middleRatio = Math.max(0, displayedRatio - topFiveRatio);
          const remainderRatio = Math.max(0, 1 - displayedRatio);
          const remainderCount = Math.max(0, (counterpartCount ?? contracted.length) - entries.length);
          const groups = [
            { label: "상위 5개", ratio: topFiveRatio, className: "bg-blue-800 dark:bg-blue-500" },
            {
              label: `6–${entries.length}위`,
              ratio: middleRatio,
              className: "bg-blue-400 dark:bg-blue-700",
            },
            {
              label: `나머지 ${remainderCount.toLocaleString("ko-KR")}개`,
              ratio: remainderRatio,
              className: "bg-slate-300 dark:bg-slate-700",
            },
          ];
          return (
            <div className="mt-5 rounded-2xl border bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm">전체 계약금액 분포</strong>
                <span className="text-xs text-muted-foreground">전체 계약업체 기준</span>
              </div>
              <div
                className="flex h-10 overflow-hidden rounded-lg bg-muted"
                aria-label="전체 업체 계약금액 분포"
              >
                {groups
                  .filter((group) => group.ratio > 0)
                  .map((group) => (
                    <span
                      className={`grid min-w-0 place-items-center px-2 text-xs font-semibold ${group.className} ${group.label.startsWith("나머지") ? "text-slate-700 dark:text-slate-200" : "text-white"}`}
                      key={group.label}
                      style={{ width: `${group.ratio * 100}%` }}
                    >
                      {group.ratio >= 0.1 ? `${(group.ratio * 100).toFixed(1)}%` : ""}
                    </span>
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                {groups.map((group) => (
                  <span key={group.label}>
                    <span className="text-muted-foreground">{group.label}</span>{" "}
                    <strong>{(group.ratio * 100).toFixed(1)}%</strong>
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

      {enableDistributionView && knownTotal > 0 && comparisonTotal > 0 && (
        <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">주요 계약업체 비교</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              누적 50%를 목표로 화면에서 읽을 수 있는 범위까지 표시합니다.
            </p>
          </div>
          <strong className="text-sm">
            {entries.length.toLocaleString("ko-KR")}개 · 전체의{" "}
            {((comparisonTotal / knownTotal) * 100).toFixed(1)}%
          </strong>
        </div>
      )}
      <div
        className="relationship-overview-canvas"
        onClick={(event) => {
          if (event.currentTarget !== event.target) return;
          setSelectedKey(undefined);
          onSelectRelationship?.(undefined);
        }}
      >
        {branch ? renderBranch(branch) : <p>현재 조건에서 확인된 계약 관계가 없습니다.</p>}
      </div>
      {enableDistributionView && (
        <p className="mt-2 text-xs text-muted-foreground">
          타일 면적과 비율은 표시된 계약업체 사이의 상대적 계약금액입니다. 작은 영역은 마우스를 올리면
          업체명과 금액을 확인할 수 있습니다.
        </p>
      )}

      {!enableDistributionView && selected && (
        <div className="relationship-inline-summary" aria-live="polite">
          <div>
            <span>선택 관계</span>
            <strong>{counterpartName(selected, counterpartType)}</strong>
            <p>
              계약 {selected.contract_event_count.toLocaleString("ko-KR")}건 · {money(selectedAmount)}
              {selectedShare != null ? ` · 전체의 ${(selectedShare * 100).toFixed(1)}%` : ""}
              {selected.latest_contract_date ? ` · 최근 ${selected.latest_contract_date.slice(0, 10)}` : ""}
            </p>
          </div>
          <div>
            {onOpenContracts && (
              <Button size="sm" onClick={() => onOpenContracts(selected)}>
                계약 내역 보기
              </Button>
            )}
            {selectedHref && (
              <Button asChild size="sm" variant="outline">
                <Link to={selectedHref}>
                  {counterpartType === "organization" ? "기관" : "업체"} 상세
                  <ArrowUpRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {enableDistributionView && selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget !== event.target) return;
            setSelectedKey(undefined);
            onSelectRelationship?.(undefined);
          }}
        >
          <aside
            aria-label={`${counterpartName(selected, counterpartType)} 계약 관계 상세`}
            aria-modal="true"
            className="h-full w-full max-w-5xl overflow-y-auto border-l bg-background p-5 shadow-2xl sm:p-6"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b pb-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold">{counterpartName(selected, counterpartType)}</h3>
                  {selectedHref && (
                    <Link
                      className="inline-flex items-center text-xs font-semibold text-[var(--brand)] hover:underline"
                      to={selectedHref}
                    >
                      {counterpartType === "organization" ? "기관" : "업체"} 프로필 보기
                      <ArrowUpRight className="ml-1 size-3.5" />
                    </Link>
                  )}
                </div>
                {counterpartKey(selected, counterpartType) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {counterpartType === "company" ? "사업자등록번호" : "기관코드"}{" "}
                    {counterpartKey(selected, counterpartType)}
                  </p>
                )}
              </div>
              <Button
                aria-label="업체 상세 닫기"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setSelectedKey(undefined);
                  onSelectRelationship?.(undefined);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-4">
                <dt className="text-xs text-muted-foreground">귀속 계약금액</dt>
                <dd className="mt-1 text-lg font-bold">{money(selectedAmount)}</dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <dt className="text-xs text-muted-foreground">조회 조건 내 계약금액 비중</dt>
                <dd className="mt-1 text-lg font-bold">
                  {selectedShare == null ? "-" : `${(selectedShare * 100).toFixed(1)}%`}
                </dd>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  현재 조회 기간·분야의 전체 업체 귀속 계약금액 기준
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <dt className="text-xs text-muted-foreground">계약 건수</dt>
                <dd className="mt-1 text-lg font-bold">
                  {selected.contract_event_count.toLocaleString("ko-KR")}건
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <dt className="text-xs text-muted-foreground">최근 계약</dt>
                <dd className="mt-1 text-sm font-bold">
                  {selected.latest_contract_date?.slice(0, 10) ?? "일자 미확인"}
                </dd>
              </div>
            </dl>

            {relationshipDetailLoading && (
              <div className="mt-7 rounded-xl border p-5" role="status">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <LoaderCircle className="size-4 animate-spin text-[var(--brand)]" />
                  계약 관계 상세를 불러오는 중입니다.
                </span>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <span className="h-20 animate-pulse rounded-xl bg-muted" />
                  <span className="h-20 animate-pulse rounded-xl bg-muted" />
                </div>
                <span className="mt-3 block h-36 animate-pulse rounded-xl bg-muted" />
              </div>
            )}
            {relationshipDetail}

            {!relationshipDetail && !relationshipDetailLoading && (
              <div className="mt-7">
                <h4 className="text-sm font-semibold">관련 공고·계약</h4>
                <div className="mt-3 space-y-2">
                  {selected.representative_notices.slice(0, 3).map((notice) => (
                    <div
                      className="rounded-xl border p-3"
                      key={`${notice.bid_notice_id}-${notice.activity_type}`}
                    >
                      <strong className="block text-sm">{notice.notice_name}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {notice.activity_date?.slice(0, 10) ?? "일자 미확인"}
                        {notice.amount != null ? ` · ${money(notice.amount)}` : " · 금액 미확인"}
                      </p>
                    </div>
                  ))}
                  {!selected.representative_notices.length && (
                    <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                      표시할 관련 공고·계약이 없습니다.
                    </p>
                  )}
                </div>
              </div>
            )}

            {selected.amount_completeness !== "complete" && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/35 dark:text-amber-200">
                일부 계약의 업체 귀속금액이 불완전해 표시 금액이 전체 계약을 포함하지 않을 수 있습니다.
              </p>
            )}

            {onOpenContracts && (
              <div className="mt-7 border-t pt-5">
                {onOpenContracts && <Button onClick={() => onOpenContracts(selected)}>전체 계약 내역</Button>}
              </div>
            )}
          </aside>
        </div>
      )}

      {contracted.some((relationship) => relationship.amount_completeness !== "complete") && (
        <p className="mt-2 text-xs text-muted-foreground">
          일부 계약은 업체 귀속금액이 불완전하며, 금액 미확인 관계는 면적 비교에서 제한적으로 표시됩니다.
        </p>
      )}
    </section>
  );
}
