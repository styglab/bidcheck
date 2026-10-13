import {
  useOrganizationProcurementProfile,
  useOrganizationSupplierEntries,
} from "@/features/organizations/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { SectionError } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKoreanDate } from "@/shared/format/date";
import { RelationshipTreemap } from "./RelationshipTreemap";
import { useRelationshipDiscovery } from "./api";

export function RelationshipDiscoverySection() {
  const [limit, setLimit] = useState(12);
  const [position, setPosition] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const query = useRelationshipDiscovery(3, "", limit);
  const organizations = query.data?.organizations ?? [];
  const index = Math.min(position, Math.max(0, organizations.length - 1));
  const current = organizations[index];
  const next = organizations[index + 1];
  const basis = query.data?.analysis_basis;
  const profile = useOrganizationProcurementProfile(
    current?.organization_code,
    3,
    {},
    Boolean(current),
    basis ? { from: basis.from_year, to: basis.to_year } : undefined,
    { pageSize: 30, sort: "contract_amount_desc" },
  );
  const suppliers = useOrganizationSupplierEntries(
    current?.organization_code,
    basis?.to_year,
    {},
    Boolean(current),
    1,
    3,
  );
  const relationships =
    (profile.data?.company_relationships ?? current?.relationships)?.filter(
      (item) => (item.total_attributed_contract_amount ?? 0) > 0,
    ) ?? [];
  const loadedAmount = relationships.reduce(
    (total, item) => total + item.total_attributed_contract_amount!,
    0,
  );
  const structure = profile.data?.company_structure ?? current?.company_structure;
  const totalAmount = structure?.total_company_attributed_contract_amount;
  const sharesKnown =
    structure?.concentration_computable === true &&
    totalAmount != null &&
    totalAmount > 0 &&
    totalAmount >= loadedAmount &&
    !(profile.data?.truncated ?? current?.truncated);
  const newNumbers = new Set(suppliers.data?.items.map((item) => item.company_number));
  const move = (direction: number) =>
    setPosition(Math.max(0, Math.min(organizations.length - 1, index + direction)));

  return (
    <section className="mt-8" aria-label="기관별 계약업체 분포" aria-roledescription="캐러셀">
      {query.isError ? (
        <SectionError title="기관 거래 관계" error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !current ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          현재 조회 범위에서 확인된 기관이 없습니다.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {basis && `${basis.from_year}–${basis.to_year}년 업체 귀속 계약금액 기준`}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="mr-2 text-sm tabular-nums text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {index + 1} / {organizations.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="이전 기관"
                disabled={index === 0}
                onClick={() => move(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="다음 기관"
                disabled={!next}
                onClick={() => move(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div
            role="group"
            aria-roledescription="슬라이드"
            aria-label={`${current.organization_name ?? current.organization_code}, ${index + 1} / ${organizations.length}`}
            style={{ touchAction: "pan-y" }}
            onTouchStart={(event) => {
              const point = event.touches[0];
              touch.current = { x: point.clientX, y: point.clientY };
            }}
            onTouchEnd={(event) => {
              const start = touch.current;
              touch.current = null;
              const end = event.changedTouches[0];
              if (!start || !end) return;
              const dx = end.clientX - start.x;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(end.clientY - start.y) * 1.5)
                move(dx < 0 ? 1 : -1);
            }}
            onTouchCancel={() => {
              touch.current = null;
            }}
          >
            {profile.isLoading ? (
              <div>
                <h2 className="mb-4 text-lg font-bold">
                  {current.organization_name ?? current.organization_code}
                </h2>
                <Skeleton className="h-80 rounded-2xl" />
              </div>
            ) : profile.isError ? (
              <SectionError
                title={current.organization_name ?? current.organization_code}
                error={profile.error}
                onRetry={() => void profile.refetch()}
              />
            ) : relationships.length ? (
              <RelationshipTreemap
                key={current.organization_code}
                title={current.organization_name ?? current.organization_code}
                description={
                  sharesKnown
                    ? "칸의 크기는 계약금액 비중을 나타냅니다."
                    : "금액이 확인된 업체끼리 계약 규모를 비교합니다. 전체 비중은 확인 필요합니다."
                }
                counterpartType="company"
                relationships={relationships}
                counterpartCount={sharesKnown ? structure?.contracted_company_count : relationships.length}
                totalAmount={sharesKnown ? totalAmount : undefined}
                aggregateUnlisted={sharesKnown}
                summaryOnly
                showShares={sharesKnown}
                showMetrics={false}
                headingLevel={2}
                getCounterpartHref={() => undefined}
                getCounterpartBadge={(item) =>
                  newNumbers.has(item.company_number) ||
                  (item.supplier_entry?.entry_status === "first_observed" &&
                    item.supplier_entry.target_year === basis?.to_year) ? (
                    <small className="mt-1 text-[11px] font-semibold">{basis?.to_year}년 신규 관측</small>
                  ) : null
                }
                className="animate-in fade-in slide-in-from-right-2 motion-reduce:animate-none [&_.relationship-overview-canvas]:!h-80 sm:[&_.relationship-overview-canvas]:!h-96"
              />
            ) : (
              <div className="rounded-xl border p-8">
                <h2 className="text-lg font-bold">
                  {current.organization_name ?? current.organization_code}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  계약금액이 확인된 업체를 찾지 못했습니다.
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>화살표 또는 좌우로 밀어서 다른 기관을 볼 수 있습니다.</span>
            {next && (
              <button type="button" onClick={() => move(1)} className="font-medium text-primary">
                다음 · {next.organization_name ?? next.organization_code} →
              </button>
            )}
          </div>
          {organizations.length >= limit && limit < 24 && (
            <Button
              variant="outline"
              className="mt-5"
              disabled={query.isFetching}
              onClick={() => setLimit(24)}
            >
              {query.isFetching ? "기관을 불러오는 중" : "기관 더 불러오기"}
            </Button>
          )}
          {suppliers.isError ? (
            <p className="mt-4 text-xs text-muted-foreground">일부 기관의 신규 관계를 조회하지 못했습니다.</p>
          ) : null}
          {query.data?.partial && (
            <p className="mt-3 text-xs text-muted-foreground">
              일부 정보가 누락된 결과입니다. 확인된 계약금액 기준으로 표시합니다.
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            최근 낙찰에서 확인된 기관을 보여줍니다. 전체 시장 순위가 아닙니다. 신규 관측은 확보된 과거
            이력에서 처음 확인된 관계를 뜻합니다.
          </p>
          {query.data?.snapshot_updated_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              갱신{" "}
              {formatKoreanDate(
                query.data.snapshot_updated_at,
                { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" },
                "시각 확인 필요",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
