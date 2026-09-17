import { ArrowUpRight, Landmark, LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationSearch } from "../features/organizations/api";

export function OrganizationsPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [input, setInput] = useState(initial);
  const [search, setSearch] = useState(initial);
  const query = useOrganizationSearch(search);
  const organizations = query.data?.items ?? [];
  const submit = () => {
    const value = input.trim();
    setSearch(value);
    setParams(value ? { q: value } : {});
  };
  return (
    <PageContainer className="max-w-7xl">
      <header className="mb-8">
        <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">기관 탐색</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">발주기관을 찾아보세요</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          기관의 공고·낙찰·계약 이력과 주요 거래업체를 확인할 수 있습니다.
        </p>
      </header>
      <form
        className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="h-12 bg-muted/35 pl-11"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="기관명 또는 기관코드 검색"
              aria-label="기관 검색"
            />
          </div>
          <Button
            className="h-12 bg-violet-700 px-6 hover:bg-violet-600"
            disabled={input.trim().length < 2 || query.isFetching}
          >
            {query.isFetching ? <LoaderCircle className="animate-spin" /> : "검색"}
          </Button>
        </div>
      </form>
      {query.isError && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {query.error.message}
        </p>
      )}
      {search ? (
        <>
          <div className="mt-8 flex items-center justify-between border-b pb-3">
            <strong>
              검색 결과{" "}
              {query.data?.pagination?.total_items?.toLocaleString() ?? organizations.length.toLocaleString()}
              개
            </strong>
            {query.isFetching && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <LoaderCircle className="animate-spin" size={13} />
                조회 중
              </span>
            )}
          </div>
          {query.isLoading ? (
            <div className="mt-4 grid gap-3">
              {[1, 2, 3].map((item) => (
                <Skeleton className="h-20 rounded-xl" key={item} />
              ))}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
              {organizations.map((organization) => (
                <Link
                  className="group flex items-center gap-4 border-b p-5 transition-colors last:border-0 hover:bg-violet-50/40 dark:hover:bg-violet-950/10"
                  key={organization.organization_code}
                  to={`/organizations/${encodeURIComponent(organization.organization_code)}`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    <Landmark size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate group-hover:text-violet-700">
                      {organization.name}
                    </strong>
                    <small className="mt-1 block text-muted-foreground">
                      {organization.jurisdiction_type ?? "기관 유형 미상"} · 기관코드{" "}
                      {organization.organization_code}
                    </small>
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              ))}
              {!query.isFetching && organizations.length === 0 && (
                <p className="p-10 text-center text-sm text-muted-foreground">검색된 기관이 없습니다.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Landmark size={22} />
          </span>
          <h2 className="mt-4 font-semibold">기관을 검색해 보세요</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            발주 공고와 연결된 낙찰·계약업체를 확인할 수 있습니다.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
