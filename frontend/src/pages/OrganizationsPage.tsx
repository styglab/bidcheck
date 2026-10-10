import { ArrowUpRight, Landmark, LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { AnalysisIndexHeader } from "@/components/layout/analysis-index-header";
import { EntityDetailToolbar, EntitySectionHeader } from "@/components/common/entity-detail-section";
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
    <PageContainer className="max-w-6xl !pt-7 sm:!pt-10">
      <AnalysisIndexHeader
        description="기관의 공고·낙찰·계약 이력과 주요 계약업체 구조를 확인할 수 있습니다."
        label="기관 분석"
        title="발주기관을 분석하세요"
      />
      <EntityDetailToolbar>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="h-11 bg-background pl-11"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="기관명 또는 기관코드 검색"
              aria-label="기관 검색"
            />
          </div>
          <Button className="h-11 px-6" disabled={input.trim().length < 2 || query.isFetching}>
            {query.isFetching ? <LoaderCircle className="animate-spin" /> : "검색"}
          </Button>
        </form>
      </EntityDetailToolbar>
      {query.isError && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {query.error.message}
        </p>
      )}
      {search ? (
        <>
          <div className="mt-9 border-b pb-4">
            <EntitySectionHeader
              title={`검색 결과 ${query.data?.pagination?.total_items?.toLocaleString() ?? organizations.length.toLocaleString()}개`}
              description="기관을 선택하면 발주 규모, 주요 분야와 계약업체 구조를 확인할 수 있습니다."
              meta={
                query.isFetching ? (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <LoaderCircle className="size-3.5 animate-spin" /> 조회 중
                  </span>
                ) : undefined
              }
            />
          </div>
          {query.isLoading ? (
            <div className="mt-4 grid gap-3">
              {[1, 2, 3].map((item) => (
                <Skeleton className="h-20 rounded-xl" key={item} />
              ))}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border bg-card">
              {organizations.map((organization) => (
                <Link
                  className="group flex items-center gap-4 border-b px-5 py-4 transition-colors last:border-0 hover:bg-muted/35"
                  key={organization.organization_code}
                  to={`/organizations/${encodeURIComponent(organization.organization_code)}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Landmark size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate group-hover:text-primary">{organization.name}</strong>
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
        <div className="mt-10 border-y py-16 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <Landmark size={22} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">기관명이나 기관코드를 입력하세요</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            발주 공고와 연결된 낙찰·계약업체를 확인할 수 있습니다.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
