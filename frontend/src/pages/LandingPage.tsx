import { ArrowRight, Building2, FileText, Landmark, LoaderCircle, Search } from "lucide-react";
import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanySearch } from "../features/company-context/api";
import { useNotices } from "../features/notices/api";
import { useOrganizationSearch } from "../features/organizations/api";
import { formatCompactMoney as money } from "@/shared/format/money";

export function LandingPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [input, setInput] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(initial.length >= 2);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchable = query.trim().length >= 2;
  const recentNotices = useNotices({ page_size: 8, sort: "published_desc" });
  const notices = useNotices({
    q: searchable ? query : undefined,
    include_history: searchable || undefined,
    page_size: 6,
    sort: "published_desc",
  });
  const organizations = useOrganizationSearch(query);
  const companies = useCompanySearch(query);
  const noticeResults = searchable ? (notices.data?.items ?? []) : [];
  const organizationResults = searchable ? (organizations.data?.items ?? []) : [];
  const companyResults = searchable ? (companies.data?.items ?? []) : [];
  const resultCount = noticeResults.length + organizationResults.length + companyResults.length;
  const loading = searchable && (notices.isFetching || organizations.isFetching || companies.isFetching);

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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    setQuery(value);
    setOpen(value.length >= 2);
    setParams(value ? { q: value } : {});
  };

  return (
    <main>
      <section className="home-search-hero border-b">
        <PageContainer className="max-w-5xl py-16 text-center sm:py-24">
          <Badge className="border-0 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-950/60">
            공공조달 통합검색
          </Badge>
          <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
            공고·기관·업체를
            <br />
            <span className="text-blue-800 dark:text-blue-300">한 번에 찾아보세요.</span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            검색한 대상의 실제 공고·낙찰·계약 관계를 상세 화면에서 이어서 확인할 수 있습니다.
          </p>
          <div className="relative mx-auto mt-9 max-w-3xl text-left" ref={wrapperRef}>
            <form
              className="flex gap-2 rounded-2xl border bg-background p-2 shadow-[0_22px_60px_-30px_rgba(30,64,175,.5)]"
              onSubmit={submit}
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
                  placeholder="기관명, 업체명, 공고명 또는 사업명을 검색하세요"
                  aria-label="통합 검색"
                />
                {loading && (
                  <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button className="h-12 px-6">검색</Button>
            </form>
            {open && searchable && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[540px] overflow-y-auto rounded-2xl border bg-popover p-2 shadow-2xl">
                {organizationResults.length > 0 && (
                  <ResultGroup icon={Landmark} title="기관">
                    {organizationResults.slice(0, 5).map((organization) => (
                      <Link
                        key={organization.organization_code}
                        to={`/organizations/${encodeURIComponent(organization.organization_code)}`}
                        className="search-result-row"
                      >
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">{organization.name}</strong>
                          <small className="mt-1 block text-muted-foreground">
                            {organization.jurisdiction_type ?? "기관"} · 기관코드{" "}
                            {organization.organization_code}
                          </small>
                        </span>
                        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                          기관 보기
                        </span>
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
                          >
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-sm">
                                {company.name ?? "업체명 미상"}
                              </strong>
                              <small className="mt-1 block text-muted-foreground">
                                사업자등록번호 {company.business_registration_number}
                              </small>
                            </span>
                            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                              업체 보기
                            </span>
                          </Link>
                        ),
                    )}
                  </ResultGroup>
                )}
                {noticeResults.length > 0 && (
                  <ResultGroup icon={FileText} title="공고">
                    {noticeResults.map((notice) => (
                      <Link
                        key={notice.id}
                        to={`/notices/${encodeURIComponent(notice.id)}`}
                        className="search-result-row"
                      >
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">{notice.name}</strong>
                          <small className="mt-1 block truncate text-muted-foreground">
                            {notice.organization} · {money(notice.allocated_budget ?? notice.estimated_price)}
                          </small>
                        </span>
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          공고 보기
                        </span>
                      </Link>
                    ))}
                  </ResultGroup>
                )}
                {!loading && resultCount === 0 && (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    검색 결과가 없습니다. 명칭이나 사업 키워드를 확인해 주세요.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span>예시</span>
            {["근로복지공단", "한국이디에스", "정보시스템 구축"].map((example) => (
              <button
                type="button"
                key={example}
                className="rounded-full bg-muted px-3 py-1 hover:text-foreground"
                onClick={() => {
                  setInput(example);
                  setQuery(example);
                  setOpen(true);
                  setParams({ q: example });
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </PageContainer>
      </section>

      <PageContainer className="max-w-6xl py-14">
        <div className="flex items-end justify-between border-b pb-4">
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">최근 공고</p>
            <h2 className="mt-1 text-2xl font-bold">새로 등록된 공고</h2>
          </div>
          <Link
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
            to="/notices"
          >
            공고 전체 보기 <ArrowRight size={14} />
          </Link>
        </div>
        {recentNotices.isLoading ? (
          <Skeleton className="mt-5 h-72 rounded-2xl" />
        ) : (
          <div className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card">
            {(recentNotices.data?.items ?? []).slice(0, 8).map((notice) => (
              <Link
                key={notice.id}
                to={`/notices/${encodeURIComponent(notice.id)}`}
                className="group grid gap-2 p-4 hover:bg-muted/45 sm:grid-cols-[minmax(0,1fr)_14rem_7rem] sm:items-center"
              >
                <strong className="truncate text-sm group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  {notice.name}
                </strong>
                <span className="truncate text-xs text-muted-foreground">{notice.organization}</span>
                <span className="text-right text-xs font-medium">
                  {money(notice.allocated_budget ?? notice.estimated_price)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>
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
