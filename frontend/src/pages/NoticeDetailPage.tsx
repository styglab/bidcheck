import { AlertTriangle, ArrowLeft, Building2, CalendarClock, Check, ExternalLink, FileCheck2, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAssessment, useNotice } from "../features/notices/api";
import { useCompany } from "../features/company-context/useCompany";
import { CompanySelector } from "../features/company-context/CompanySelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";
import { StatusState } from "@/components/common/status-state";
import { ParticipationFindingsSection } from "../features/notices/ParticipationFindingsSection";

function formatMoney(value?: number) {
  return value == null ? "미정" : `${value.toLocaleString("ko-KR")}원`;
}

function formatKoreanDateTime(value?: string) {
  if (!value) return "미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미정";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

const requirementTypeLabels: Record<string, string> = {
  participation_region: "지역",
  industry_license: "면허·업종",
};

function isKeyRequirement(type: string) {
  return type === "participation_region" || type === "industry_license";
}

export function NoticeDetailPage() {
  const { noticeId } = useParams();
  const query = useNotice(noticeId);
  const { currentCompany } = useCompany();
  const assessment = useAssessment(noticeId, currentCompany?.businessNumber);
  if (query.isLoading)
    return (
      <PageContainer>
        <Skeleton className="h-8 w-32" /><Skeleton className="mt-8 h-12 w-3/4" /><Skeleton className="mt-8 h-48 rounded-xl" />
      </PageContainer>
    );
  if (query.isError)
    return (
      <main className="placeholder-page shell content-shell">
        <Link className="back-link" to="/notices">
          ← 입찰공고
        </Link>
        <div className="table-state error">
          <strong>공고를 불러오지 못했습니다.</strong>
          <span>{query.error.message}</span>
        </div>
      </main>
    );
  const { notice, requirements, requirement_state, participation_findings } = query.data!;
  const orderedRequirements = [...requirements].sort((left, right) => Number(isKeyRequirement(right.type)) - Number(isKeyRequirement(left.type)));
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
    <PageContainer>
      <Link className="mb-7 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-blue-800 dark:text-blue-300" to="/notices">
        <ArrowLeft size={16} /> 입찰공고
      </Link>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground">
            {notice.notice_number}-{notice.notice_order}
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">{notice.name}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 size={15} />{notice.organization}</p>
          <p className="mt-1 text-xs text-muted-foreground">게시 {formatKoreanDateTime(notice.published_at)} KST</p>
        </div>
        {notice.detail_url && (
          <Button variant="outline" size="lg" asChild><a href={notice.detail_url} target="_blank" rel="noreferrer">나라장터 원문 <ExternalLink size={14} /></a></Button>
        )}
      </div>
      <dl className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-background lg:grid-cols-4">
        {[
          ["예산", formatMoney(notice.allocated_budget)],
          ["계약방법", notice.contract_method ?? "-"],
          ["입찰방법", notice.bid_method ?? "-"],
          ["접수마감", notice.deadline_at ? `${formatKoreanDateTime(notice.deadline_at)} KST` : "미정"],
        ].map(([label, value]) => <div className="border-b border-r border-border p-4 last:border-r-0 lg:border-b-0" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-foreground">{value}</dd></div>)}
      </dl>
      {(notice.status === "unknown" || !notice.deadline_at) && (
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <div>
            <strong className="text-sm">입찰 일정을 원문에서 확인해 주세요.</strong>
            <p className="mt-1 text-xs leading-5">구조화된 접수 마감 시각이 제공되지 않은 공고입니다.{notice.opening_at ? ` 개찰 시각은 ${formatKoreanDateTime(notice.opening_at)} KST로 제공되었습니다.` : ""}</p>
          </div>
        </div>
      )}
      {!currentCompany && (
        <Card className="mt-7 border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><h2 className="text-base font-semibold text-foreground">우리 회사가 참여할 수 있는지 확인해 보세요</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">지역·업종·기업구분·인증·자격요건을 회사 정보와 자동으로 비교합니다.</p></div>
            <Button className="bg-blue-800 hover:bg-blue-700" size="lg" asChild><Link to={`/company/setup?returnTo=${encodeURIComponent(`/notices/${notice.id}`)}`}>회사 프로필 만들기</Link></Button>
          </CardContent>
        </Card>
      )}
      {currentCompany && (
        <Card className="mt-7 border-blue-200 shadow-none"><CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">우리 회사 기준</Badge><span className="text-xs text-muted-foreground">자동 분석</span></div><h2 className="mt-2 text-lg font-semibold text-foreground">{currentCompany.name} 참가요건 검토</h2></div><CompanySelector mode="change" /></div>
          {assessment.isLoading && <div className="mt-5 flex items-center gap-3 rounded-lg bg-muted/50 p-4"><Skeleton className="size-8 rounded-full" /><p className="text-sm text-muted-foreground">공식 회사정보와 참가요건을 비교하고 있습니다.</p></div>}
          {assessment.isError && (
            <div className="mt-5 flex flex-col gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
              <p>평가를 완료하지 못했습니다. {assessment.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => assessment.refetch()} disabled={assessment.isFetching}>다시 시도</Button>
            </div>
          )}
          {assessment.data?.assessment && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-800 dark:text-emerald-300"><b className="mr-1 text-xl">{String(assessment.data.assessment.satisfied_count ?? 0)}</b>충족</span>
              <span className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300"><b className="mr-1 text-xl">{String(assessment.data.assessment.needs_review_count ?? 0)}</b>확인 필요</span>
              <span className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300"><b className="mr-1 text-xl">{String(assessment.data.assessment.unsatisfied_count ?? 0)}</b>미충족</span>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock size={13} />자동 검토 결과는 최종 입찰 참가 판단을 대신하지 않습니다.</p>
        </CardContent></Card>
      )}
      <ParticipationFindingsSection findings={participation_findings ?? []} />
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-sm font-semibold text-blue-800 dark:text-blue-300">입찰 조건</p><h2 className="mt-1 text-xl font-bold text-foreground">참가요건 {requirements.length}개</h2></div>
          {notice.requires_review && (
            <Badge className="gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
              <AlertTriangle size={13} /> 원문 검토 필요
            </Badge>
          )}
        </div>
        {requirement_state !== "ready" || requirements.length === 0 ? (
          <StatusState icon={<FileCheck2 size={28} />} title="참가요건 분석 전입니다" description="구조화된 참가요건이 아직 없어 자동 판단하지 않습니다. 나라장터 원문에서 자격조건을 확인해 주세요." action={notice.detail_url ? <Button variant="outline" asChild><a href={notice.detail_url} target="_blank" rel="noreferrer">원문에서 확인 <ExternalLink size={14} /></a></Button> : undefined} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="hidden grid-cols-[140px_minmax(0,1fr)_minmax(180px,.7fr)_120px] gap-5 border-b bg-muted/50 px-5 py-3 text-xs font-medium text-muted-foreground md:grid"><span>조건</span><span>공고 요구사항</span><span>회사 정보</span><span className="text-right">판정</span></div>
            {orderedRequirements.map((requirement) => {
              const result = currentCompany
                ? requirementAssessment(requirement.id, requirement.local_id)
                : undefined;
              const status = result ? statusMeta(result.outcome) : undefined;
              const companyEvidence = result
                ? String(result.evaluated_value ?? result.company_value ?? result.evidence_summary ?? "회사 증빙을 상세 확인하세요.")
                : currentCompany ? "분석 결과 없음" : "회사 프로필 미적용";
              return <article className={`grid gap-3 border-b border-border px-5 py-4 last:border-0 md:grid-cols-[140px_minmax(0,1fr)_minmax(180px,.7fr)_120px] md:gap-5 ${isKeyRequirement(requirement.type) ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`} key={requirement.id}>
                <div><span className="text-sm font-semibold text-foreground">{requirement.title}</span><div className="mt-1 flex flex-wrap gap-1">{isKeyRequirement(requirement.type) && <Badge className="h-5 bg-blue-100 text-[10px] text-blue-800 dark:bg-blue-950 dark:text-blue-300">대표요건</Badge>}{requirement.mandatory && <Badge variant="outline" className="h-5 text-[10px]">필수</Badge>}<Badge variant="secondary" className="h-5 text-[10px]">{requirementTypeLabels[requirement.type] ?? requirement.type}</Badge></div></div>
                <div><span className="mb-1 block text-xs text-muted-foreground md:hidden">공고 요구사항</span><p className="text-sm leading-6 text-muted-foreground">{requirement.proposition_text ?? requirement.original_text ?? "요구사항 원문을 확인하세요."}</p>{requirement.proof_summary && <small className="mt-1 block text-xs text-muted-foreground">확인자료 · {requirement.proof_summary}</small>}</div>
                <div><span className="mb-1 block text-xs text-muted-foreground md:hidden">회사 정보</span><p className="text-sm leading-6 text-muted-foreground">{companyEvidence}</p></div>
                <div className="md:text-right">{status ? <Badge className={status.className === "satisfied" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : status.className === "unsatisfied" ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300" : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"}>{status.icon}{status.label}</Badge> : <Badge variant="secondary">분석 전</Badge>}</div>
                <details className="md:col-start-2 md:col-end-5"><summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-blue-800 dark:text-blue-300">판정 및 원문 근거 보기</summary><div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">{result && <p className="mb-2">{String(result.judgment_summary ?? result.reason_summary ?? result.reason_code ?? "판정 근거를 확인해 주세요.")}</p>}{requirement.evidence?.length > 0 ? <div className="space-y-3">{requirement.evidence.map((evidence) => <div className="border-l-2 border-border pl-3" key={evidence.id}><p className="font-medium text-foreground">{evidence.source_document ?? "첨부 문서"}{evidence.source_page != null ? ` · ${evidence.source_page}페이지` : ""}{evidence.source_clause ? ` · ${evidence.source_clause}` : ""}</p>{evidence.source_excerpt && <p className="mt-1">{evidence.source_excerpt}</p>}{evidence.source_url && <a className="mt-1 inline-flex items-center gap-1 font-medium text-blue-800 hover:underline dark:text-blue-300" href={evidence.source_url} target="_blank" rel="noreferrer">원문 열기 <ExternalLink size={12} /></a>}</div>)}</div> : <p>{requirement.original_text ?? "연결된 문서 근거가 없습니다."}</p>}<small className="mt-2 block text-muted-foreground">기준시점 · {requirement.observed_at ? `${formatKoreanDateTime(requirement.observed_at)} KST` : "미상"}</small></div></details>
              </article>;
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
