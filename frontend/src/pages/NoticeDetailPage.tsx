import { AlertTriangle, Check, ExternalLink, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAssessment, useNotice } from "../features/notices/api";
import { useCompany } from "../features/company-context/useCompany";

export function NoticeDetailPage() {
  const { noticeId } = useParams();
  const query = useNotice(noticeId);
  const { currentCompany } = useCompany();
  const assessment = useAssessment(noticeId, currentCompany?.businessNumber);
  if (query.isLoading)
    return (
      <main className="placeholder-page shell content-shell">
        <div className="table-state">공고와 참가요건을 불러오고 있습니다.</div>
      </main>
    );
  if (query.isError)
    return (
      <main className="placeholder-page shell content-shell">
        <Link className="back-link" to="/notices">
          ← 공고 찾기
        </Link>
        <div className="table-state error">
          <strong>공고를 불러오지 못했습니다.</strong>
          <span>{query.error.message}</span>
        </div>
      </main>
    );
  const { notice, requirements, requirement_state } = query.data!;
  const requirementAssessment = (requirementId: string, localId?: string) =>
    assessment.data?.requirement_assessments.find((item) => {
      const candidate = String(item.requirement_id ?? item.bid_requirement_id ?? item.local_id ?? "");
      return candidate === requirementId || Boolean(localId && candidate === localId);
    });
  const statusMeta = (outcome: unknown) => {
    if (outcome === "satisfied") return { label: "충족", className: "satisfied", icon: <Check size={14} /> };
    if (outcome === "unsatisfied")
      return { label: "미충족", className: "unsatisfied", icon: <X size={14} /> };
    return { label: "확인 필요", className: "needs-review", icon: <AlertTriangle size={14} /> };
  };
  return (
    <main className="notice-detail-page shell content-shell">
      <Link className="back-link" to="/notices">
        ← 공고 찾기
      </Link>
      <div className="detail-header">
        <div>
          <span className="eyebrow">
            {notice.notice_number}-{notice.notice_order}
          </span>
          <h1>{notice.name}</h1>
          <p>{notice.organization}</p>
        </div>
        {notice.detail_url && (
          <a className="source-link" href={notice.detail_url} target="_blank" rel="noreferrer">
            나라장터 원문 <ExternalLink size={14} />
          </a>
        )}
      </div>
      <dl className="notice-facts">
        <div>
          <dt>추정가격</dt>
          <dd>{notice.estimated_price?.toLocaleString() ?? "-"}원</dd>
        </div>
        <div>
          <dt>계약방법</dt>
          <dd>{notice.contract_method ?? "-"}</dd>
        </div>
        <div>
          <dt>입찰방법</dt>
          <dd>{notice.bid_method ?? "-"}</dd>
        </div>
        <div>
          <dt>마감</dt>
          <dd>{notice.deadline_at ? new Date(notice.deadline_at).toLocaleString("ko-KR") : "-"}</dd>
        </div>
      </dl>
      {currentCompany && (
        <section className="assessment-panel">
          <div>
            <span className="eyebrow">COMPANY ASSESSMENT</span>
            <h2>{currentCompany.name} 기준 참가요건 검토</h2>
          </div>
          {assessment.isLoading && <p>공식 업체정보와 참가요건을 비교하고 있습니다.</p>}
          {assessment.isError && (
            <p className="assessment-error">평가를 완료하지 못했습니다. {assessment.error.message}</p>
          )}
          {assessment.data?.assessment && (
            <div className="assessment-summary">
              <span className="pass">
                <b>{String(assessment.data.assessment.satisfied_count ?? 0)}</b>충족
              </span>
              <span className="fail">
                <b>{String(assessment.data.assessment.unsatisfied_count ?? 0)}</b>미충족
              </span>
              <span className="review">
                <b>{String(assessment.data.assessment.needs_review_count ?? 0)}</b>확인 필요
              </span>
            </div>
          )}
          <small>자동 검토 결과는 최종 입찰 참가 판단을 대신하지 않습니다.</small>
        </section>
      )}
      <section className="requirements-section">
        <div className="requirements-title">
          <div>
            <span className="eyebrow">REQUIREMENTS</span>
            <h2>참가요건 {requirements.length}</h2>
          </div>
          {notice.requires_review && (
            <span className="review-badge">
              <AlertTriangle size={13} /> 원문 검토 필요
            </span>
          )}
        </div>
        {requirement_state !== "ready" ? (
          <div className="table-state">아직 추출된 참가요건이 없습니다. 나라장터 원문을 확인해 주세요.</div>
        ) : (
          <div className="requirement-list">
            {requirements.map((requirement) => {
              const result = currentCompany
                ? requirementAssessment(requirement.id, requirement.local_id)
                : undefined;
              const status = result ? statusMeta(result.outcome) : undefined;
              return (
                <article className={`requirement-card ${status?.className ?? ""}`} key={requirement.id}>
                  <div className="requirement-card-head">
                    <span>{requirement.type}</span>
                    <div>
                      {requirement.mandatory && <b>필수</b>}
                      {status && (
                        <strong className="requirement-status">
                          {status.icon}
                          {status.label}
                        </strong>
                      )}
                    </div>
                  </div>
                  <h3>{requirement.title}</h3>
                  <p>{requirement.proposition_text ?? requirement.original_text}</p>
                  {requirement.proof_summary && (
                    <div className="proof">
                      <small>제출·확인 자료</small>
                      <span>{requirement.proof_summary}</span>
                    </div>
                  )}
                  {result && (
                    <div className="assessment-reason">
                      <small>업체정보 기반 판정</small>
                      <strong>{status?.label}</strong>
                      <p>
                        {String(
                          result.judgment_summary ??
                            result.reason_summary ??
                            result.reason_code ??
                            "판정 근거를 상세 확인해 주세요.",
                        )}
                      </p>
                    </div>
                  )}
                  <details>
                    <summary>공고 근거 보기</summary>
                    <p>{requirement.original_text}</p>
                    <small>
                      Teoria ·{" "}
                      {requirement.observed_at
                        ? new Date(requirement.observed_at).toLocaleString("ko-KR")
                        : "기준시점 미상"}
                    </small>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
