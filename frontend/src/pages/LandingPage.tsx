import { Building2, FileText, Landmark, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySearch } from "../features/company-context/api";
import { useNotices } from "../features/notices/api";
import { useOrganizationSearch } from "../features/organizations/api";

const RelationsPage = lazy(() =>
  import("./RelationsPage").then((module) => ({ default: module.RelationsPage })),
);

const examples = [
  { label: "지능형 생활안정지원시스템", noticeId: "R26BK01713978:000" },
  { label: "근로복지공단", query: "근로복지공단" },
  { label: "한국이디에스", query: "한국이디에스" },
];

const money = (value?: number) =>
  value == null
    ? "금액 미상"
    : value >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
      : `${value.toLocaleString("ko-KR")}원`;

export function LandingPage() {
  const [params, setParams] = useSearchParams();
  const noticeId = params.get("notice") ?? "";
  const initialQuery = params.get("q") ?? "";
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchable = query.trim().length >= 2;
  const notices = useNotices({ q: searchable ? query : undefined, page_size: 5, sort: "published_desc" });
  const organizations = useOrganizationSearch(query);
  const companies = useCompanySearch(query);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const noticeResults = searchable ? (notices.data?.items ?? []) : [];
  const organizationResults = searchable ? (organizations.data?.items ?? []) : [];
  const companyResults = searchable ? (companies.data?.items ?? []) : [];
  const resultCount = noticeResults.length + organizationResults.length + companyResults.length;
  const loading = notices.isFetching || organizations.isFetching || companies.isFetching;
  const selectedTitle = useMemo(
    () => noticeResults.find((notice) => notice.id === noticeId)?.name,
    [noticeId, noticeResults],
  );

  const runSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const value = input.trim();
    setQuery(value);
    setOpen(value.length >= 2);
    setParams(value ? { q: value } : {});
  };
  const selectNotice = (id: string, name: string) => {
    setInput(name);
    setOpen(false);
    setParams({ notice: id, q: name });
  };
  const reset = () => {
    setInput("");
    setQuery("");
    setOpen(false);
    setParams({});
  };

  return (
    <main className={noticeId ? "home-graph-active" : ""}>
      <section className={`home-search-hero ${noticeId ? "is-compact" : ""}`}>
        <PageContainer className={noticeId ? "max-w-6xl py-3" : "max-w-6xl py-12 sm:py-16"}>
          <div className={noticeId ? "" : "mx-auto max-w-3xl text-center"}>
            {!noticeId && (
              <>
                <Badge className="border-0 bg-blue-100 text-blue-800 hover:bg-blue-100">
                  <Sparkles className="mr-1 size-3" />
                  공공조달 관계 탐색
                </Badge>
                <h1 className="mt-6 text-4xl font-bold leading-tight tracking-[-0.04em] sm:text-6xl">
                  공고만 찾지 말고,
                  <br />
                  <span className="text-blue-800 dark:text-blue-300">그 뒤의 관계를 보세요.</span>
                </h1>
                <p className="mt-5 text-base text-muted-foreground sm:text-lg">
                  공고명, 기관명 또는 업체명으로 검색하면 연결된 조달 관계를 보여드립니다.
                </p>
              </>
            )}
            {noticeId && <span className="sr-only">현재 관계 그래프: {selectedTitle ?? input}</span>}

            <div className={`relative ${noticeId ? "mx-auto max-w-4xl" : "mt-9"}`} ref={wrapperRef}>
              <form
                className="flex gap-2 rounded-2xl border bg-background p-2 shadow-[0_22px_60px_-30px_rgba(30,64,175,.5)]"
                onSubmit={runSearch}
              >
                <div className="relative flex-1">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={19}
                  />
                  <Input
                    className="h-12 border-0 bg-muted/40 pl-11 shadow-none focus-visible:ring-0"
                    value={input}
                    onChange={(event) => {
                      setInput(event.target.value);
                      setOpen(event.target.value.trim().length >= 2);
                    }}
                    onFocus={() => searchable && setOpen(true)}
                    placeholder="공고명, 기관명, 업체명을 검색하세요"
                    aria-label="통합 검색"
                  />
                  {loading && (
                    <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                {noticeId && (
                  <Button type="button" variant="ghost" className="h-12 px-3" onClick={reset}>
                    <X className="size-4" />
                    <span className="sr-only">새로 검색</span>
                  </Button>
                )}
                <Button className="h-12 bg-blue-800 px-6 hover:bg-blue-700">검색</Button>
              </form>

              {open && searchable && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[520px] overflow-y-auto rounded-2xl border bg-popover p-2 text-left shadow-2xl">
                  {noticeResults.length > 0 && (
                    <ResultGroup icon={FileText} title="공고">
                      {noticeResults.map((notice) => (
                        <button
                          type="button"
                          key={notice.id}
                          onClick={() => selectNotice(notice.id, notice.name)}
                          className="search-result-row"
                        >
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm">{notice.name}</strong>
                            <small className="mt-1 block truncate text-muted-foreground">
                              {notice.organization} ·{" "}
                              {money(notice.allocated_budget ?? notice.estimated_price)}
                            </small>
                          </span>
                          <span className="text-xs font-semibold text-blue-700">그래프 열기</span>
                        </button>
                      ))}
                    </ResultGroup>
                  )}
                  {organizationResults.length > 0 && (
                    <ResultGroup icon={Landmark} title="기관">
                      {organizationResults.slice(0, 5).map((organization) => (
                        <Link
                          key={organization.organization_code}
                          to={`/organizations/${encodeURIComponent(organization.organization_code)}`}
                          className="search-result-row"
                          onClick={() => setOpen(false)}
                        >
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm">{organization.name}</strong>
                            <small className="mt-1 block text-muted-foreground">
                              {organization.jurisdiction_type ?? "기관"}
                            </small>
                          </span>
                          <span className="text-xs text-muted-foreground">프로필</span>
                        </Link>
                      ))}
                    </ResultGroup>
                  )}
                  {companyResults.length > 0 && (
                    <ResultGroup icon={Building2} title="업체">
                      {companyResults.slice(0, 5).map(
                        (company) =>
                          company.business_registration_number && (
                            <Link
                              key={company.id}
                              to={`/companies/${company.business_registration_number}?name=${encodeURIComponent(company.name ?? "업체")}`}
                              className="search-result-row"
                              onClick={() => setOpen(false)}
                            >
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-sm">
                                  {company.name ?? "업체명 미상"}
                                </strong>
                                <small className="mt-1 block text-muted-foreground">
                                  {company.business_registration_number}
                                </small>
                              </span>
                              <span className="text-xs text-muted-foreground">프로필</span>
                            </Link>
                          ),
                      )}
                    </ResultGroup>
                  )}
                  {!loading && resultCount === 0 && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      검색 결과가 없습니다. 공고명·기관명·업체명을 확인해 주세요.
                    </p>
                  )}
                </div>
              )}
            </div>

            {!noticeId && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">직접 살펴보기</span>
                {examples.map((example) => (
                  <button
                    type="button"
                    key={example.label}
                    className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => {
                      if (example.noticeId) selectNotice(example.noticeId, example.label);
                      else {
                        setInput(example.query!);
                        setQuery(example.query!);
                        setOpen(true);
                        setParams({ q: example.query! });
                      }
                    }}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </PageContainer>
      </section>

      {noticeId ? (
        <Suspense
          fallback={
            <PageContainer className="max-w-6xl">
              <div className="mt-3 h-[560px] animate-pulse rounded-2xl bg-muted" />
            </PageContainer>
          }
        >
          <RelationsPage embedded />
        </Suspense>
      ) : (
        <section className="border-t">
          <PageContainer className="max-w-6xl py-14">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: FileText,
                  title: "공고",
                  text: "발주기관과 관련 수주업체, 연결된 과거 공고를 탐색합니다.",
                  color: "text-blue-700 bg-blue-50",
                },
                {
                  icon: Landmark,
                  title: "기관",
                  text: "기관이 어떤 업체와 어떤 공고에서 연결됐는지 확인합니다.",
                  color: "text-violet-700 bg-violet-50",
                },
                {
                  icon: Building2,
                  title: "업체",
                  text: "업체의 주요 거래기관과 실제 수주공고를 확인합니다.",
                  color: "text-teal-700 bg-teal-50",
                },
              ].map((item) => (
                <article key={item.title} className="rounded-2xl border bg-card p-6">
                  <span className={`grid size-11 place-items-center rounded-xl ${item.color}`}>
                    <item.icon size={19} />
                  </span>
                  <h2 className="mt-5 font-bold">{item.title}에서 시작</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </article>
              ))}
            </div>
          </PageContainer>
        </section>
      )}
    </main>
  );
}

function ResultGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b p-2 last:border-0">
      <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground">
        <Icon size={13} />
        {title}
      </div>
      {children}
    </section>
  );
}
