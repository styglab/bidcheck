import { AlertTriangle, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipationFinding } from "./api";

const groups = [
  { category: "participation_note", title: "참가 준비사항", description: "입찰 절차, 제출서류, 기한과 무효 주의사항" },
  { category: "performance_obligation", title: "계약·수행 의무", description: "낙찰 또는 계약 후 지켜야 할 수행 조건" },
  { category: "competition_risk_signal", title: "경쟁 제한 가능 조건", description: "제조사, 브랜드, 호환성 등 추가 검토가 필요한 조건" },
] as const;

const importanceLabels: Record<string, string> = { high: "중요", medium: "보통", low: "참고" };
const reviewLabels: Record<string, string> = { needs_review: "확인 필요", extracted: "추출됨", reviewed: "검토됨" };

function value(value?: string) {
  return value?.trim() || "명시 없음";
}

function FindingCard({ finding }: { finding: ParticipationFinding }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="font-semibold text-foreground">{finding.title || "제목 없음"}</h4>
          <div className="flex gap-1.5">
            {finding.importance && <Badge variant="secondary">{importanceLabels[finding.importance] ?? finding.importance}</Badge>}
            {finding.review_status === "needs_review" ? (
              <Badge className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle size={12} />확인 필요</Badge>
            ) : finding.review_status ? <Badge variant="outline">{reviewLabels[finding.review_status] ?? finding.review_status}</Badge> : null}
          </div>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{value(finding.description)}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <div><dt className="text-muted-foreground">기한</dt><dd className="mt-0.5 text-foreground">{value(finding.deadline_text)}</dd></div>
          <div><dt className="text-muted-foreground">미이행 영향</dt><dd className="mt-0.5 text-foreground">{value(finding.failure_effect)}</dd></div>
          <div><dt className="text-muted-foreground">경쟁 영향</dt><dd className="mt-0.5 text-foreground">{value(finding.competitive_effect)}</dd></div>
          <div><dt className="text-muted-foreground">정당한 사유</dt><dd className="mt-0.5 text-foreground">{value(finding.legitimate_justification)}</dd></div>
        </dl>
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-blue-800 dark:hover:text-blue-300">원문 근거 보기</summary>
          <div className="mt-3 space-y-3">
            {finding.evidence.length ? finding.evidence.map((evidence) => (
              <div className="border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground" key={evidence.id}>
                <p className="font-medium text-foreground">{evidence.source_document ?? "첨부 문서"}{evidence.source_page != null ? ` · ${evidence.source_page}페이지` : ""}{evidence.source_clause ? ` · ${evidence.source_clause}` : ""}</p>
                {evidence.source_excerpt && <p className="mt-1">{evidence.source_excerpt}</p>}
                {evidence.source_url && <a className="mt-1 inline-flex items-center gap-1 font-medium text-blue-800 hover:underline dark:text-blue-300" href={evidence.source_url} target="_blank" rel="noreferrer">원문 열기 <ExternalLink size={12} /></a>}
              </div>
            )) : <p className="text-xs text-muted-foreground">연결된 원문 근거가 없습니다.</p>}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function ParticipationFindingsSection({ findings }: { findings: ParticipationFinding[] }) {
  return (
    <section className="mt-10">
      <div className="mb-4"><p className="text-sm font-semibold text-blue-800 dark:text-blue-300">입찰 참가정보</p><h2 className="mt-1 text-xl font-bold text-foreground">놓치기 쉬운 절차와 조건</h2></div>
      {findings.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground"><FileText size={18} />추출된 참가정보 없음</div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const items = findings.filter((finding) => finding.category === group.category);
            return (
              <div key={group.category}>
                <div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="font-semibold text-foreground">{group.title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p></div><Badge variant="secondary">{items.length}건</Badge></div>
                {group.category === "competition_risk_signal" && <div className="mb-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 shrink-0" size={14} />위법·특혜 확정이 아니라 검토가 필요한 객관적 신호입니다.</div>}
                {items.length ? <div className="grid gap-3 lg:grid-cols-2">{items.map((finding) => <FindingCard finding={finding} key={finding.id} />)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">추출된 항목 없음</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
