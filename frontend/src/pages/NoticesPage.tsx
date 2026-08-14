import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { NoticeTable } from "../features/notices/NoticeTable";
import { useNotices, type NoticeFilters } from "../features/notices/api";

function Pagination({ filters, setPage }: { filters: NoticeFilters; setPage: (page: number) => void }) {
  const { data } = useNotices(filters);
  if (!data || data.pagination.total_pages <= 1) return null;
  const { page, total_pages: total } = data.pagination;
  const start = Math.max(1, Math.min(page - 2, total - 4));
  const pages = Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
  return (
    <nav className="pagination" aria-label="공고 페이지">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
        이전
      </button>
      {start > 1 && (
        <>
          <button onClick={() => setPage(1)}>1</button>
          <span>…</span>
        </>
      )}
      {pages.map((value) => (
        <button
          className={value === page ? "active" : ""}
          aria-current={value === page ? "page" : undefined}
          key={value}
          onClick={() => setPage(value)}
        >
          {value}
        </button>
      ))}
      {start + pages.length - 1 < total && (
        <>
          <span>…</span>
          <button onClick={() => setPage(total)}>{total}</button>
        </>
      )}
      <button disabled={page >= total} onClick={() => setPage(page + 1)}>
        다음
      </button>
    </nav>
  );
}

export function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const filters: NoticeFilters = {
    q: params.get("q") || undefined,
    work_type: "service",
    published_from: params.get("published_from") || undefined,
    published_to: params.get("published_to") || undefined,
    deadline_to: params.get("deadline_to") || undefined,
    contract_method: params.get("contract_method") || undefined,
    price_min: params.get("price_min") || undefined,
    price_max: params.get("price_max") || undefined,
    sort: params.get("sort") || "deadline_asc",
    page: Number(params.get("page") || 1),
    page_size: 20,
  };
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!("page" in values)) next.set("page", "1");
    setParams(next);
  };
  const activeFilters = [
    filters.published_from && {
      key: "published_from",
      label: `게시 ${filters.published_from.slice(0, 10)}부터`,
    },
    filters.published_to && { key: "published_to", label: `게시 ${filters.published_to.slice(0, 10)}까지` },
    filters.deadline_to && { key: "deadline_to", label: `마감 ${filters.deadline_to.slice(0, 10)}까지` },
    filters.contract_method && { key: "contract_method", label: filters.contract_method },
  ].filter(Boolean) as Array<{ key: string; label: string }>;
  return (
    <main className="notices-page shell content-shell">
      <header className="notices-heading">
        <h1>공고 찾기</h1>
        <p>진행 중인 공공입찰 공고를 검색하고 조건별로 비교해 보세요.</p>
      </header>
      <div className="notice-type-tabs" aria-label="공고 업무 유형">
        <button type="button" disabled>
          <span>물품</span>
          <small>준비 중</small>
        </button>
        <button type="button" className="active" aria-pressed="true">
          <span>용역</span>
          <small>현재 제공</small>
        </button>
        <button type="button" disabled>
          <span>공사</span>
          <small>준비 중</small>
        </button>
        <button type="button" disabled>
          <span>외자</span>
          <small>준비 중</small>
        </button>
      </div>
      <section className="notice-search-panel">
        <form
          className="notice-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            update({ q: String(form.get("q") ?? "") });
          }}
        >
          <Search size={21} />
          <input
            name="q"
            aria-label="공고 검색"
            defaultValue={filters.q}
            placeholder="공고명 · 공고번호 · 발주기관 검색"
          />
          <button type="submit">
            <Search size={16} /> 검색
          </button>
        </form>
        <div className="filter-heading">
          <SlidersHorizontal size={15} /> 검색 조건
        </div>
        <div className="notice-filters">
          <label>
            게시 시작
            <input
              type="date"
              value={filters.published_from?.slice(0, 10) ?? ""}
              onChange={(event) => update({ published_from: event.target.value })}
            />
          </label>
          <label>
            게시 종료
            <input
              type="date"
              value={filters.published_to?.slice(0, 10) ?? ""}
              onChange={(event) => update({ published_to: event.target.value })}
            />
          </label>
          <label>
            마감 기한
            <input
              type="date"
              value={filters.deadline_to?.slice(0, 10) ?? ""}
              onChange={(event) => update({ deadline_to: event.target.value })}
            />
          </label>
          <label>
            계약방법
            <select
              value={filters.contract_method ?? ""}
              onChange={(event) => update({ contract_method: event.target.value })}
            >
              <option value="">전체</option>
              <option>일반경쟁</option>
              <option>제한경쟁</option>
              <option>수의계약</option>
            </select>
          </label>
        </div>
        <div className="filter-footer">
          <div className="active-filters">
            {activeFilters.map((filter) => (
              <button key={filter.key} onClick={() => update({ [filter.key]: "" })}>
                {filter.label} <span>×</span>
              </button>
            ))}
            {!activeFilters.length && <span>적용된 상세 조건이 없습니다.</span>}
          </div>
          <button
            className="filter-reset"
            onClick={() => setParams({ sort: filters.sort ?? "deadline_asc", page: "1" })}
          >
            <RotateCcw size={13} /> 초기화
          </button>
        </div>
      </section>
      <div className="result-toolbar">
        <span>검색 결과</span>
        <label>
          정렬
          <select value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
            <option value="deadline_asc">마감 임박순</option>
            <option value="published_desc">최신순</option>
          </select>
        </label>
      </div>
      <div className="page-table">
        <NoticeTable filters={filters} />
      </div>
      <Pagination filters={filters} setPage={(page) => update({ page: String(page) })} />
    </main>
  );
}
