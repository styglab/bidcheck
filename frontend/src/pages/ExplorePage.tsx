import { Building2, FileText, Landmark, LoaderCircle, Search } from "lucide-react";
import { FormEvent, useState } from "react";
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

type ExploreType = "all" | "notices" | "organizations" | "companies";
export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const initialType = params.get("type") as ExploreType | null;
  const type: ExploreType = ["all", "notices", "organizations", "companies"].includes(initialType ?? "")
    ? initialType!
    : "all";
  const [input, setInput] = useState(query);
  const notices = useNotices({ q: query || undefined, page_size: 8, sort: "published_desc" });
  const organizations = useOrganizationSearch(query);
  const companies = useCompanySearch(query);
  const searchable = query.trim().length >= 2;
  const show = (target: Exclude<ExploreType, "all">) => type === "all" || type === target;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = input.trim();
    setParams({ ...(next ? { q: next } : {}), ...(type !== "all" ? { type } : {}) });
  };
  const changeType = (next: ExploreType) =>
    setParams({ ...(query ? { q: query } : {}), ...(next !== "all" ? { type: next } : {}) });

  return (
    <PageContainer className="max-w-7xl">
      <header className="mb-8">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">통합 탐색</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          공고·기관·업체를 한곳에서 찾으세요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          대상을 찾은 뒤 관련 기관과 업체, 과거 공고의 관계를 이어서 탐색할 수 있습니다.
        </p>
      </header>
      <form className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" onSubmit={submit}>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["all", "전체"],
              ["notices", "공고"],
              ["organizations", "기관"],
              ["companies", "업체"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={type === value ? "default" : "outline"}
              className="rounded-full px-4"
              onClick={() => changeType(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="h-12 bg-muted/35 pl-11"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="공고명, 기관명, 업체명 검색"
            />
          </div>
          <Button className="h-12 px-6">검색</Button>
        </div>
      </form>

      {!searchable && (
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileText,
              title: "공고에서 시작",
              text: "현재 공고 주변의 발주기관·수주업체·과거 공고를 확인합니다.",
              to: "/explore?type=notices",
              color: "blue",
            },
            {
              icon: Landmark,
              title: "기관에서 시작",
              text: "기관이 어떤 업체와 어떤 사업에서 연결됐는지 확인합니다.",
              to: "/explore?type=organizations",
              color: "violet",
            },
            {
              icon: Building2,
              title: "업체에서 시작",
              text: "업체의 주요 거래기관과 실제 수주공고를 확인합니다.",
              to: "/explore?type=companies",
              color: "teal",
            },
          ].map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <item.icon className={`text-${item.color}-700`} />
              <h2 className="mt-5 font-bold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </Link>
          ))}
        </section>
      )}

      {searchable && (
        <div className="mt-10 space-y-12">
          {show("notices") && (
            <section>
              <div className="flex items-end justify-between border-b pb-3">
                <div>
                  <h2 className="text-xl font-bold">공고</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    공고를 중심으로 주변 관계를 열 수 있습니다.
                  </p>
                </div>
                <Badge variant="secondary">{notices.data?.pagination.total_items ?? 0}건</Badge>
              </div>
              {notices.isLoading ? (
                <Skeleton className="mt-4 h-40 rounded-xl" />
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {notices.data?.items.map((notice) => (
                    <article key={notice.id} className="rounded-xl border bg-card p-5">
                      <Link
                        className="font-bold hover:text-blue-700 hover:underline"
                        to={`/notices/${encodeURIComponent(notice.id)}`}
                      >
                        {notice.name}
                      </Link>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {notice.organization} · {money(notice.allocated_budget)}
                      </p>
                      <div className="mt-4 flex gap-3 text-xs">
                        <Link
                          className="font-semibold text-blue-700"
                          to={
                            notice.organization_code
                              ? `/organizations/${encodeURIComponent(notice.organization_code)}`
                              : "/organizations"
                          }
                        >
                          계약업체 구성
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {show("organizations") && (
            <section>
              <div className="flex items-end justify-between border-b pb-3">
                <div>
                  <h2 className="text-xl font-bold">기관</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    기관 프로필에서 주요 관계업체와 발주공고를 확인합니다.
                  </p>
                </div>
                {organizations.isFetching && <LoaderCircle className="size-4 animate-spin" />}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {organizations.data?.items.map((organization) => (
                  <Link
                    key={organization.organization_code}
                    to={`/organizations/${encodeURIComponent(organization.organization_code)}`}
                    className="group flex items-center gap-4 rounded-xl border bg-card p-5 hover:border-violet-300"
                  >
                    <span className="grid size-10 place-items-center rounded-lg bg-violet-50 text-violet-700">
                      <Landmark size={18} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate group-hover:text-violet-700">
                        {organization.name}
                      </strong>
                      <small className="text-muted-foreground">
                        {organization.jurisdiction_type ?? "기관"} · {organization.organization_code}
                      </small>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {show("companies") && (
            <section>
              <div className="flex items-end justify-between border-b pb-3">
                <div>
                  <h2 className="text-xl font-bold">업체</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    업체 프로필에서 주요 거래기관과 실제 수주공고를 확인합니다.
                  </p>
                </div>
                {companies.isFetching && <LoaderCircle className="size-4 animate-spin" />}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {companies.data?.items.map(
                  (company) =>
                    company.business_registration_number && (
                      <Link
                        key={company.id}
                        to={`/companies/${company.business_registration_number}?name=${encodeURIComponent(company.name ?? "업체")}`}
                        className="group flex items-center gap-4 rounded-xl border bg-card p-5 hover:border-teal-300"
                      >
                        <span className="grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
                          <Building2 size={18} />
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate group-hover:text-teal-700">
                            {company.name ?? "업체명 미상"}
                          </strong>
                          <small className="text-muted-foreground">
                            사업자등록번호 {company.business_registration_number}
                          </small>
                        </span>
                      </Link>
                    ),
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
