import type { AssessmentEvidence } from "./api";
import { assessmentText } from "./assessment-presentation";

function sourceUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function AssessmentEvidenceList({ evidence }: { evidence: AssessmentEvidence[] }) {
  const kinds: Record<string, string> = {
    notice_document: "공고문 근거",
    structured_api: "공식 조회 근거",
    database_record: "저장된 사실",
    company_document: "회사 증빙",
    manual_confirmation: "수동 확인 근거",
  };
  return (
    <ul className="mt-3 space-y-3">
      {evidence.map((item) => {
        const observed = [
          ...new Set(
            [item.observed_at, ...(item.observed_at_values ?? [])].filter((value): value is string =>
              Boolean(value),
            ),
          ),
        ];
        const source = sourceUrl(item.source_url);
        return (
          <li key={item.id} className="space-y-1 text-sm">
            <p className="font-medium">
              {item.source_document ?? kinds[item.evidence_kind ?? ""] ?? item.source_type ?? "근거 자료"}
              {(item.page_number ?? item.source_page) != null
                ? ` · ${item.page_number ?? item.source_page}쪽`
                : ""}
              {(item.clause ?? item.source_clause) ? ` · ${item.clause ?? item.source_clause}` : ""}
            </p>
            <p className="text-muted-foreground">
              {item.excerpt ??
                item.observed_value_text ??
                item.source_excerpt ??
                assessmentText(item.observed_value) ??
                "근거 상세 확인 필요"}
            </p>
            <dl className="grid gap-1 text-xs text-muted-foreground">
              {item.source_id && (
                <div>
                  <dt className="inline">조회 원천: </dt>
                  <dd className="inline">{item.source_id}</dd>
                </div>
              )}
              {item.source_operation_id && (
                <div>
                  <dt className="inline">조회 항목: </dt>
                  <dd className="inline">{item.source_operation_id}</dd>
                </div>
              )}
              {item.document_id && (
                <div>
                  <dt className="inline">문서 식별자: </dt>
                  <dd className="inline break-all">{item.document_id}</dd>
                </div>
              )}
              {item.section && (
                <div>
                  <dt className="inline">문서 구역: </dt>
                  <dd className="inline">{item.section}</dd>
                </div>
              )}
              <div>
                <dt className="inline">관찰시각: </dt>
                <dd className="inline">{observed.join(" · ") || "확인 필요"}</dd>
              </div>
              <div>
                <dt className="inline">유효기간: </dt>
                <dd className="inline">
                  {item.valid_from || item.valid_until
                    ? `${item.valid_from ?? "시작일 확인 필요"} ~ ${item.valid_until ?? "종료일 확인 필요"}`
                    : "확인 필요"}
                </dd>
              </div>
            </dl>
            {source && (
              <a
                className="inline-block text-xs text-primary underline"
                href={source}
                target="_blank"
                rel="noopener noreferrer"
              >
                근거 출처 보기
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
