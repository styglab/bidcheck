import { ArrowUpRight, Building2, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { AnalysisIndexHeader } from "@/components/layout/analysis-index-header";
import { EntityDetailToolbar, EntitySectionHeader } from "@/components/common/entity-detail-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney as money } from "@/shared/format/money";
import { useCompanyDiscovery, useCompanySearch } from "../features/company-context/api";

const examples = ["사무용 의자", "정보시스템 유지관리", "시설물 안전점검", "교육 기자재", "조경공사"];
const day = (value?: string) => (value ? value.replaceAll("-", ".") : "일자 미상");

export function CompaniesPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const initialMode =
    params.get("mode") === "company" || /^\d{10}$/.test(initial.replace(/\D/g, "")) ? "company" : "field";
  const [mode, setMode] = useState<"field" | "company">(initialMode);
  const [input, setInput] = useState(initial);
  const [search, setSearch] = useState(initial);
  const names = useCompanySearch(mode === "company" ? search : "");
  const discovery = useCompanyDiscovery(mode === "field" ? search : "");
  const activeQuery = mode === "company" ? names : discovery;
  const changeMode = (next: "field" | "company") => {
    setMode(next);
    setInput("");
    setSearch("");
    setParams(next === "company" ? { mode: "company" } : {});
  };
  const submit = (value = input) => {
    const next = value.trim();
    const nextMode = /^\d{10}$/.test(next.replace(/\D/g, "")) ? "company" : mode;
    setMode(nextMode);
    setInput(next);
    setSearch(next);
    setParams(
      next
        ? { q: next, ...(nextMode === "company" ? { mode: "company" } : {}) }
        : nextMode === "company"
          ? { mode: "company" }
          : {},
    );
  };

  return (
    <PageContainer className="max-w-6xl !pt-7 sm:!pt-10">
      <AnalysisIndexHeader
        description="업체명뿐 아니라 제품이나 사업 분야를 검색해 실제 낙찰·계약 이력을 확인할 수 있습니다."
        label="업체 분석"
        title="조달업체를 분석하세요"
      />

      <EntityDetailToolbar>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div
            className="mb-4 inline-flex rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="업체 검색 방식"
          >
            <button
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${mode === "field" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => changeMode("field")}
              role="tab"
              aria-selected={mode === "field"}
              type="button"
            >
              분야·제품으로 찾기
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${mode === "company" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => changeMode("company")}
              role="tab"
              aria-selected={mode === "company"}
              type="button"
            >
              업체명으로 찾기
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                className="h-11 bg-background pl-11"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  mode === "field"
                    ? "제품 또는 사업 분야를 검색하세요"
                    : "업체명 또는 사업자등록번호를 검색하세요"
                }
                aria-label={mode === "field" ? "분야 및 제품 검색" : "업체명 검색"}
              />
            </div>
            <Button className="h-11 px-6" disabled={input.trim().length < 2 || activeQuery.isFetching}>
              {activeQuery.isFetching ? <LoaderCircle className="animate-spin" /> : "검색"}
            </Button>
          </div>
          {mode === "field" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">예시</span>
              {examples.map((example) => (
                <button
                  className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  key={example}
                  onClick={() => submit(example)}
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </form>
      </EntityDetailToolbar>

      {activeQuery.isError && search && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          검색 결과가 지연되고 있습니다. 검색어를 조금 더 구체적으로 입력해 주세요.
        </p>
      )}

      {search ? (
        <div className="mt-9 space-y-10">
          {mode === "field" ? (
            <section>
              <div className="border-b pb-4">
                <EntitySectionHeader
                  title={`‘${search}’ 관련 실적 업체`}
                  description="최근 3년 낙찰 공고의 제목과 업체를 연결한 결과입니다."
                  meta={
                    discovery.isFetching ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <LoaderCircle className="size-3.5 animate-spin" /> 조회 중
                      </span>
                    ) : undefined
                  }
                />
              </div>
              {discovery.isLoading ? (
                <div className="mt-4 grid gap-3">
                  {[1, 2, 3].map((item) => (
                    <Skeleton className="h-28 rounded-xl" key={item} />
                  ))}
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border bg-card">
                  {discovery.data?.items.map((company) => {
                    const award = company.representative_award;
                    return (
                      <article
                        className="grid gap-3 border-b px-5 py-4 last:border-0 hover:bg-muted/35 md:grid-cols-[minmax(190px,1fr)_minmax(260px,1.7fr)_auto] md:items-center"
                        key={company.business_registration_number}
                      >
                        <div className="min-w-0">
                          <Link
                            className="group inline-flex max-w-full items-center gap-2 font-bold hover:text-primary"
                            to={`/companies/${company.business_registration_number}?name=${encodeURIComponent(company.name)}`}
                          >
                            <span className="truncate">{company.name}</span>
                            <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            관련 낙찰 {company.award_count}건 · {money(company.winning_amount)} · 거래기관{" "}
                            {company.organization_count}곳
                          </p>
                        </div>
                        <div className="min-w-0 border-l-0 md:border-l md:pl-5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            최근 관련 실적
                          </span>
                          {award?.bid_notice_id ? (
                            <Link
                              className="mt-1 block truncate text-sm font-medium hover:text-primary hover:underline"
                              to={`/notices/${encodeURIComponent(award.bid_notice_id)}`}
                            >
                              {award.notice_name}
                            </Link>
                          ) : (
                            <p className="mt-1 truncate text-sm">
                              {award?.notice_name ?? "실적 정보 확인 필요"}
                            </p>
                          )}
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {award?.organization_name ?? "기관 정보 없음"}
                          </p>
                        </div>
                        <time className="text-xs text-muted-foreground">
                          {day(company.latest_award_date)}
                        </time>
                      </article>
                    );
                  })}
                  {!discovery.isFetching && discovery.data?.items.length === 0 && (
                    <p className="p-10 text-center text-sm text-muted-foreground">
                      관련 낙찰 실적이 있는 업체를 찾지 못했습니다.
                    </p>
                  )}
                </div>
              )}
              {discovery.data?.partial && (
                <p className="mt-3 text-xs text-muted-foreground">
                  검색 결과가 많아 최근 낙찰 {discovery.data.sampled_award_count}건을 기준으로 업체를
                  정리했습니다.
                </p>
              )}
            </section>
          ) : (
            <section>
              <div className="border-b pb-4">
                <EntitySectionHeader
                  title={`‘${search}’ 업체 검색 결과`}
                  description="등록된 업체명 또는 사업자등록번호를 기준으로 찾았습니다."
                  meta={
                    names.isFetching ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <LoaderCircle className="size-3.5 animate-spin" /> 조회 중
                      </span>
                    ) : undefined
                  }
                />
              </div>
              {names.isLoading ? (
                <Skeleton className="mt-4 h-24 rounded-xl" />
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border bg-card">
                  {names.data?.items.map((company) =>
                    company.business_registration_number ? (
                      <Link
                        className="group flex items-center gap-4 border-b px-5 py-4 transition-colors last:border-0 hover:bg-muted/35"
                        key={company.id}
                        to={`/companies/${company.business_registration_number}?name=${encodeURIComponent(company.name ?? "업체명 확인 필요")}`}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Building2 size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate">{company.name ?? "업체명 확인 필요"}</strong>
                          <small className="mt-1 block truncate text-muted-foreground">
                            사업자등록번호 {company.business_registration_number}
                          </small>
                        </span>
                        <ArrowUpRight className="size-4 text-muted-foreground" />
                      </Link>
                    ) : null,
                  )}
                </div>
              )}
              {!names.isFetching && names.data?.items.length === 0 && (
                <p className="mt-4 rounded-xl border p-10 text-center text-sm text-muted-foreground">
                  검색된 업체가 없습니다.
                </p>
              )}
            </section>
          )}
        </div>
      ) : (
        <section className="mt-10 border-y py-8 sm:py-10">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles size={19} />
          </span>
          <h2 className="mt-5 text-xl font-bold">이름을 몰라도 업체를 찾을 수 있습니다</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            필요한 제품이나 사업 분야를 입력하면 관련 낙찰 이력이 있는 업체와 실제 수행 실적을 함께
            보여드립니다. 결과는 품질 평가나 추천이 아닌 공공조달 이력을 기준으로 합니다.
          </p>
          <div className="mt-6 grid border-y sm:grid-cols-3">
            <div className="border-b py-4 sm:border-b-0 sm:border-r sm:pr-5">
              <strong className="text-sm">1. 분야 검색</strong>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                제품명이나 수행하려는 사업을 입력합니다.
              </p>
            </div>
            <div className="border-b py-4 sm:border-b-0 sm:border-r sm:px-5">
              <strong className="text-sm">2. 실적 비교</strong>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                낙찰 건수·금액·거래기관을 비교합니다.
              </p>
            </div>
            <div className="py-4 sm:pl-5">
              <strong className="text-sm">3. 기관 구성 확인</strong>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                업체 상세에서 주요 발주기관의 계약 비중을 확인합니다.
              </p>
            </div>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
