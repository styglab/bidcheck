import { useRef, useState, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Dialog } from "radix-ui";
import { ArrowRight, Search, X } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanySectorDiscovery } from "@/features/company-context/CompanySectorDiscovery";
import { CompanyExplorerPanel } from "@/features/company-context/CompanyExplorerPanel";
import {
  useCompanySearch,
  useContractCompanyDiscovery,
  type ContractCompanyCandidate,
} from "@/features/company-context/api";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";

const examples = ["정보시스템 유지관리", "시설물 안전점검", "사무용 의자", "교육 기자재"];
function subscribeDesktop(callback: () => void) {
  const media = window.matchMedia?.("(min-width: 1024px)");
  media?.addEventListener("change", callback);
  return () => media?.removeEventListener("change", callback);
}
function isDesktop() {
  return window.matchMedia?.("(min-width: 1024px)").matches ?? true;
}

export function CompaniesPage() {
  const [params] = useSearchParams();
  return <CompanyExplorer key={`${params.get("q")}-${params.get("mode")}-${params.get("period")}`} />;
}

function CompanyExplorer() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const mode = params.get("mode") === "company" ? "company" : "field";
  const period = [1, 3, 5].includes(Number(params.get("period"))) ? Number(params.get("period")) : 3;
  const sort = params.get("sort") === "amount" ? "amount" : "count";
  const [input, setInput] = useState(search);
  const [showSectors, setShowSectors] = useState(false);
  const [limit, setLimit] = useState(20);
  const [compareOpen, setCompareOpen] = useState(false);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => true);
  const contracts = useContractCompanyDiscovery(mode === "field" ? search : "", period);
  const names = useCompanySearch(mode === "company" ? search : "");
  const request = mode === "field" ? contracts : names;
  const candidates: ContractCompanyCandidate[] =
    mode === "field"
      ? (contracts.data?.items ?? [])
      : (names.data?.items ?? [])
          .filter((item) => item.business_registration_number)
          .map((item) => ({
            business_registration_number: item.business_registration_number!,
            name: item.name ?? "업체명 확인 필요",
            contract_count: 0,
            contracts: [],
          }));
  const items = [...candidates].sort((a, b) =>
    sort === "amount"
      ? (b.contracts[0]?.amount ?? -1) - (a.contracts[0]?.amount ?? -1) || a.name.localeCompare(b.name)
      : b.contract_count - a.contract_count || a.name.localeCompare(b.name),
  );
  const selected = items.find((item) => item.business_registration_number === params.get("selected"));
  const compared = (params.get("compare") ?? "").split(",").filter(Boolean);
  const comparison = items.filter((item) => compared.includes(item.business_registration_number)).slice(0, 3);
  const toYear = contracts.data?.analysis_basis.period_to_year ?? new Date().getFullYear();
  const fromYear = contracts.data?.analysis_basis.period_from_year ?? toYear - period + 1;
  const maximum = Math.max(1, ...items.map((item) => item.contracts[0]?.amount ?? 0));
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next);
  };
  const submit = (value = input) => {
    const query = value.trim();
    if (query.length < 2) return;
    update({
      q: query,
      selected: undefined,
      compare: undefined,
      mode: /^\d{10}$/.test(query.replace(/\D/g, "")) ? "company" : mode,
    });
  };
  const toggleCompare = (number: string) => {
    const next = comparison.map((item) => item.business_registration_number);
    if (next.includes(number)) update({ compare: next.filter((item) => item !== number).join(",") });
    else if (next.length < 3) update({ compare: [...next, number].join(",") });
  };
  const panel = selected && (
    <CompanyExplorerPanel
      key={`${selected.business_registration_number}-${fromYear}-${toYear}`}
      candidate={selected}
      fromYear={fromYear}
      toYear={toYear}
    />
  );
  return (
    <PageContainer className="max-w-7xl !pt-8 sm:!pt-12">
      <header className={search ? "max-w-3xl" : "mx-auto max-w-3xl py-8 text-center sm:py-14"}>
        <p className="text-xs font-semibold tracking-[.16em] text-primary">BIDCHECK · 실적 업체 탐색</p>
        <h1 className={`mt-4 font-bold tracking-tight ${search ? "text-3xl" : "text-4xl sm:text-5xl"}`}>
          어떤 업체를 찾으세요?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          사업 분야를 검색하고, 실제 계약 실적과 경쟁업체를 확인하세요.
        </p>
        <form
          className="mt-7 flex gap-2 rounded-2xl border bg-card p-2 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="사업 분야 또는 업체명 검색"
              className="h-12 border-0 bg-transparent pl-11 shadow-none"
              placeholder={
                mode === "field" ? "정보시스템 유지관리, 시설물 안전점검…" : "업체명 또는 사업자등록번호"
              }
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </div>
          <Button className="h-12 px-5" disabled={input.trim().length < 2}>
            검색 <ArrowRight />
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">검색 대상</span>
          <button
            type="button"
            aria-pressed={mode === "field"}
            className={`rounded-full px-3 py-1.5 ${mode === "field" ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}
            onClick={() => setParams({ period: String(period) })}
          >
            사업 분야
          </button>
          <button
            type="button"
            aria-pressed={mode === "company"}
            className={`rounded-full px-3 py-1.5 ${mode === "company" ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}
            onClick={() => setParams({ mode: "company", period: String(period) })}
          >
            업체명
          </button>
          {!search &&
            mode === "field" &&
            examples.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() => submit(example)}
              >
                {example}
              </button>
            ))}
        </div>
      </header>
      {!search ? (
        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => setShowSectors(!showSectors)} aria-expanded={showSectors}>
            주요 분야 살펴보기
          </Button>
          {showSectors && (
            <div className="mt-8 text-left">
              <CompanySectorDiscovery />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-9 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
            <div>
              <h2 className="text-xl font-semibold">
                ‘{search}’ {mode === "field" ? "관련 계약 업체" : "업체 검색 결과"}
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {mode === "field"
                  ? `${fromYear}–${toYear}년 계약 검색 · 금액순 최대 100건에서 확인한 업체입니다. 전체 시장 순위가 아니며, 막대는 대표 계약의 전체 금액입니다.`
                  : "업체명·사업자등록번호로 찾은 결과입니다. 관련 계약은 사업 분야 검색에서 확인하세요."}
              </p>
            </div>
            <div className="flex gap-3">
              <label className="text-xs text-muted-foreground">
                조회 기간
                <select
                  aria-label="조회 기간"
                  className="mt-1 block rounded-lg border bg-background p-2 text-sm text-foreground"
                  value={period}
                  onChange={(event) =>
                    update({ period: event.target.value, selected: undefined, compare: undefined })
                  }
                >
                  {[1, 3, 5].map((year) => (
                    <option key={year} value={year}>
                      최근 {year}개년
                    </option>
                  ))}
                </select>
              </label>
              {mode === "field" && (
                <label className="text-xs text-muted-foreground">
                  결과 내 정렬
                  <select
                    aria-label="업체 정렬"
                    className="mt-1 block rounded-lg border bg-background p-2 text-sm text-foreground"
                    value={sort}
                    onChange={(event) => update({ sort: event.target.value })}
                  >
                    <option value="count">관련 계약 건수순</option>
                    <option value="amount">대표 계약금액순</option>
                  </select>
                </label>
              )}
            </div>
          </div>
          {request.isError ? (
            <div role="alert" className="mt-5 rounded-xl border p-5">
              <p>검색 결과를 불러오지 못했습니다.</p>
              <Button className="mt-3" onClick={() => void request.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : request.isLoading ? (
            <div role="status" aria-label="업체 검색 중" className="mt-6 space-y-3">
              {[1, 2, 3].map((key) => (
                <Skeleton className="h-32 rounded-xl" key={key} />
              ))}
            </div>
          ) : (
            <div
              className={`mt-6 grid items-start gap-6 ${selected ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : ""}`}
            >
              <section aria-label="업체 후보" className="min-w-0">
                {contracts.data?.partial && mode === "field" && (
                  <p className="mb-4 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                    일부 결과 · 조회된 계약 {contracts.data.sampled_contract_count}건 기준
                    {contracts.data.unidentified_contract_count > 0
                      ? ` · 업체 식별이 확인되지 않은 계약 ${contracts.data.unidentified_contract_count}건 제외`
                      : ""}
                  </p>
                )}
                {names.data?.truncated && mode === "company" && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    업체 검색 결과 일부만 표시됩니다. 검색어를 구체적으로 입력해 주세요.
                  </p>
                )}
                <ol className="overflow-hidden rounded-2xl border bg-card">
                  {items.slice(0, limit).map((item, index) => {
                    const active =
                      selected?.business_registration_number === item.business_registration_number;
                    const representative = item.contracts[0];
                    return (
                      <li
                        key={item.business_registration_number}
                        className={`border-b p-5 last:border-0 sm:p-6 ${active ? "bg-primary/[.06] shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-muted/25"}`}
                      >
                        <button
                          type="button"
                          aria-label={`${item.name} 분석 보기`}
                          aria-pressed={active}
                          onClick={(event) => {
                            selectedTrigger.current = event.currentTarget;
                            update({ selected: item.business_registration_number });
                          }}
                          className="block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-baseline gap-4">
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <h3 className="min-w-0 flex-1 text-lg font-bold">{item.name}</h3>
                            {representative && (
                              <span
                                className="shrink-0 text-lg font-semibold tabular-nums"
                                title={formatExactMoney(representative.amount)}
                              >
                                {formatCompactMoney(representative.amount)}
                              </span>
                            )}
                          </div>
                          {representative && (
                            <div className="ml-8 mt-3 h-1.5 rounded-full bg-muted" aria-hidden="true">
                              {representative.amount != null && (
                                <div
                                  className="h-full rounded-full bg-primary/75"
                                  style={{
                                    width: `${(Math.max(0, representative.amount) / maximum) * 100}%`,
                                  }}
                                />
                              )}
                            </div>
                          )}
                          <p className="ml-8 mt-3 text-xs text-muted-foreground">
                            {mode === "field"
                              ? `표본 내 관련 계약 ${item.contract_count}건 · 표시 금액은 대표 계약 전체 금액`
                              : `사업자등록번호 ${item.business_registration_number}`}
                          </p>
                          {representative && (
                            <p className="ml-8 mt-3 truncate text-sm">
                              <span className="mr-2 text-xs text-muted-foreground">대표 실적</span>
                              {representative.name ?? "계약명 확인 필요"}
                            </p>
                          )}
                        </button>
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${compared.includes(item.business_registration_number) ? "비교에서 제외" : "비교 추가"} ${item.name}`}
                            aria-pressed={compared.includes(item.business_registration_number)}
                            disabled={
                              !compared.includes(item.business_registration_number) && comparison.length >= 3
                            }
                            onClick={() => toggleCompare(item.business_registration_number)}
                          >
                            {compared.includes(item.business_registration_number)
                              ? "비교에서 제외"
                              : "비교 추가"}
                            <span className="sr-only"> {item.name}</span>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {!items.length && (
                  <div className="rounded-xl border p-10 text-center">
                    <p className="font-medium">검색된 업체가 없습니다.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      더 짧은 사업명으로 검색하거나 업체명 검색을 이용해 주세요.
                    </p>
                  </div>
                )}
                {items.length > limit && (
                  <Button className="mt-4 w-full" variant="outline" onClick={() => setLimit(limit + 20)}>
                    업체 더 보기
                  </Button>
                )}
                {!selected && items.length > 0 && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    업체를 선택하면 실적과 경쟁관계가 열립니다.
                  </p>
                )}
              </section>
              {selected && desktop && (
                <aside aria-label="선택 업체 분석" className="min-w-0 rounded-2xl border bg-card p-6">
                  <div className="mb-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => update({ selected: undefined })}>
                      선택 해제 <X />
                    </Button>
                  </div>
                  {panel}
                </aside>
              )}
            </div>
          )}
        </>
      )}
      {!desktop && (
        <Dialog.Root
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) update({ selected: undefined });
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Dialog.Content
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                selectedTrigger.current?.focus();
              }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border bg-background p-6 shadow-xl"
            >
              <Dialog.Title className="sr-only">선택 업체 분석</Dialog.Title>
              <Dialog.Description className="sr-only">
                선택한 업체의 실적, 경쟁관계와 계약 근거를 확인합니다.
              </Dialog.Description>
              <Dialog.Close asChild>
                <Button className="mb-4 ml-auto flex" variant="ghost" aria-label="업체 분석 닫기">
                  <X />
                </Button>
              </Dialog.Close>
              {panel}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      {comparison.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-8 flex flex-wrap items-center gap-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
          <span className="text-xs text-muted-foreground">비교 후보 {comparison.length}/3</span>
          {comparison.map((item) => (
            <Button
              key={item.business_registration_number}
              variant="secondary"
              size="sm"
              onClick={() => toggleCompare(item.business_registration_number)}
            >
              {item.name}
              <X aria-label={`${item.name} 비교 제외`} />
            </Button>
          ))}
          <Button
            className="ml-auto"
            disabled={comparison.length < 2}
            onClick={() => setCompareOpen(!compareOpen)}
            aria-expanded={compareOpen}
          >
            {compareOpen ? "비교 접기" : "비교하기"}
          </Button>
        </div>
      )}
      {compareOpen && comparison.length >= 2 && (
        <section aria-label="업체 실적 비교" className="mt-8">
          <h2 className="text-xl font-semibold">업체 실적 비교</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            동일 기간의 전체 분야 실적을 비교합니다. 검색어에 해당하는 계약만의 합계가 아닙니다.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {comparison.map((item) => (
              <div key={item.business_registration_number} className="rounded-2xl border p-5">
                <CompanyExplorerPanel candidate={item} fromYear={fromYear} toYear={toYear} compact />
              </div>
            ))}
          </div>
        </section>
      )}
      {search && (
        <p className="mt-8 text-xs text-muted-foreground">
          기관·공고의 자세한 분석도 이어서 확인할 수 있습니다.{" "}
          <Link className="ml-2 text-primary hover:underline" to="/organizations">
            기관 분석
          </Link>
          <Link className="ml-3 text-primary hover:underline" to="/notices">
            공고 탐색
          </Link>
        </p>
      )}
    </PageContainer>
  );
}
