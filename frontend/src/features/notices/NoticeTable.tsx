import { ArrowRight, Building2, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "../company-context/useCompany";
import { useNotices, type NoticeFilters } from "./api";
function dday(deadline?: string) {
  if (!deadline) return "-";
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return days >= 0 ? `D-${days}` : "마감";
}
function price(value?: number) {
  if (!value) return "가격 미정";
  return value >= 100000000
    ? `${(value / 100000000).toFixed(1)}억원`
    : `${Math.round(value / 10000).toLocaleString()}만원`;
}
export function NoticeTable({ filters = {} }: { filters?: NoticeFilters }) {
  const { currentCompany } = useCompany();
  const query = useNotices(filters);
  if (query.isLoading) return <div className="table-state">공고를 불러오고 있습니다.</div>;
  if (query.isError)
    return (
      <div className="table-state error">
        <strong>공고를 불러오지 못했습니다.</strong>
        <span>{query.error.message}</span>
        <button onClick={() => query.refetch()}>다시 시도</button>
      </div>
    );
  if (!query.data?.items.length)
    return <div className="table-state">조건에 맞는 진행 중 공고가 없습니다.</div>;
  return (
    <>
      <div className="notice-result-meta">
        진행 중인 용역 공고 <strong>{query.data.pagination.total_items.toLocaleString()}건</strong>
        {currentCompany && <span>· {currentCompany.name} 선택됨</span>}
      </div>
      <div className="notice-table">
        <div className="table-head">
          <span>공고명 · 발주기관</span>
          <span>추정가격</span>
          <span>계약방법</span>
          <span>마감</span>
          <span>검토</span>
        </div>
        {query.data.items.map((notice) => (
          <Link className="notice-row" to={`/notices/${encodeURIComponent(notice.id)}`} key={notice.id}>
            <span className="notice-name">
              <strong>{notice.name}</strong>
              <small>
                <Building2 size={12} /> {notice.organization}
              </small>
              <em>
                {notice.notice_number}-{notice.notice_order}
              </em>
            </span>
            <span className="price">{price(notice.estimated_price)}</span>
            <span className="contract-method">{notice.contract_method ?? notice.bid_method ?? "미상"}</span>
            <span className="dday">
              <b>{dday(notice.deadline_at)}</b>
              <small>
                <CalendarClock size={11} />
                {notice.deadline_at ? new Date(notice.deadline_at).toLocaleDateString("ko-KR") : "미정"}
              </small>
            </span>
            <span className="row-action">
              {currentCompany ? "요건별 검토" : "공고 보기"}
              <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
      {query.data.truncated && (
        <p className="truncated-note">검색 결과가 많아 일부만 표시합니다. 검색 기간을 줄여 확인해 주세요.</p>
      )}
    </>
  );
}
