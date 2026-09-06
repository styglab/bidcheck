import { AlertTriangle, ArrowLeft, Building2, CalendarClock, Check, ExternalLink, FileCheck2, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAssessment, useNotice } from "../features/notices/api";
import { useCompany } from "../features/company-context/useCompany";
import { CompanySelector } from "../features/company-context/CompanySelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function NoticeDetailPage() {
  const { noticeId } = useParams();
  const query = useNotice(noticeId);
  const { currentCompany } = useCompany();
  const assessment = useAssessment(noticeId, currentCompany?.businessNumber);
  if (query.isLoading)
    return (
      <main className="mx-auto w-[min(1080px,calc(100%-32px))] py-12">
        <Skeleton className="h-8 w-32" /><Skeleton className="mt-8 h-12 w-3/4" /><Skeleton className="mt-8 h-48 rounded-xl" />
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
    <main className="mx-auto min-h-[calc(100vh-70px)] w-[min(1080px,calc(100%-32px))] py-10 sm:py-14">
      <Link className="mb-7 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-800" to="/notices">
        <ArrowLeft size={16} /> 공고 찾기
      </Link>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <span className="text-xs font-medium text-slate-500">
            {notice.notice_number}-{notice.notice_order}
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">{notice.name}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600"><Building2 size={15} />{notice.organization}</p>
        </div>
        {notice.detail_url && (
          <Button variant="outline" size="lg" asChild><a href={notice.detail_url} target="_blank" rel="noreferrer">나라장터 원문 <ExternalLink size={14} /></a></Button>
        )}
      </div>
      <dl className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-4">
        {[
          ["추정가격", `${notice.estimated_price?.toLocaleString() ?? "-"}원`],
          ["계약방법", notice.contract_method ?? "-"],
          ["입찰방법", notice.bid_method ?? "-"],
          ["접수마감", notice.deadline_at ? new Date(notice.deadline_at).toLocaleString("ko-KR") : "-"],
        ].map(([label, value]) => <div className="border-b border-r border-slate-100 p-4 last:border-r-0 lg:border-b-0" key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-slate-900">{value}</dd></div>)}
      </dl>
      {!currentCompany && (
        <Card className="mt-7 border-emerald-200 bg-emerald-50/60 shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><h2 className="text-base font-semibold text-slate-950">우리 회사가 참여할 수 있는지 확인해 보세요</h2><p className="mt-1 text-sm leading-6 text-slate-600">지역·업종·기업구분·인증·자격요건을 회사 정보와 자동으로 비교합니다.</p></div>
            <CompanySelector mode="apply" />
          </CardContent>
        </Card>
      )}
      {currentCompany && (
        <Card className="mt-7 border-emerald-200 shadow-none"><CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge className="bg-emerald-100 text-emerald-800">우리 회사 기준</Badge><span className="text-xs text-slate-500">자동 분석</span></div><h2 className="mt-2 text-lg font-semibold text-slate-950">{currentCompany.name} 참가요건 검토</h2></div><CompanySelector mode="change" /></div>
          {assessment.isLoading && <div className="mt-5 flex items-center gap-3 rounded-lg bg-slate-50 p-4"><Skeleton className="size-8 rounded-full" /><p className="text-sm text-slate-600">공식 회사정보와 참가요건을 비교하고 있습니다.</p></div>}
          {assessment.isError && (
            <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">평가를 완료하지 못했습니다. {assessment.error.message}</p>
          )}
          {assessment.data?.assessment && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <span className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><b className="mr-1 text-xl">{String(assessment.data.assessment.satisfied_count ?? 0)}</b>충족</span>
              <span className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><b className="mr-1 text-xl">{String(assessment.data.assessment.needs_review_count ?? 0)}</b>확인 필요</span>
              <span className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><b className="mr-1 text-xl">{String(assessment.data.assessment.unsatisfied_count ?? 0)}</b>미충족</span>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={13} />자동 검토 결과는 최종 입찰 참가 판단을 대신하지 않습니다.</p>
        </CardContent></Card>
      )}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-sm font-semibold text-emerald-800">입찰 조건</p><h2 className="mt-1 text-xl font-bold text-slate-950">참가요건 {requirements.length}개</h2></div>
          {notice.requires_review && (
            <Badge className="gap-1 bg-amber-50 text-amber-800">
              <AlertTriangle size={13} /> 원문 검토 필요
            </Badge>
          )}
        </div>
        {requirement_state !== "ready" || requirements.length === 0 ? (
          <Card className="border-dashed py-0 shadow-none"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><FileCheck2 className="mb-3 text-slate-400" size={28} /><strong className="text-sm text-slate-800">참가요건 분석 전입니다</strong><p className="mt-1 max-w-md text-sm leading-6 text-slate-500">구조화된 참가요건이 아직 없어 자동 판단하지 않습니다. 나라장터 원문에서 자격조건을 확인해 주세요.</p>{notice.detail_url && <Button className="mt-4" variant="outline" asChild><a href={notice.detail_url} target="_blank" rel="noreferrer">원문에서 확인 <ExternalLink size={14} /></a></Button>}</CardContent></Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="hidden grid-cols-[140px_minmax(0,1fr)_minmax(180px,.7fr)_120px] gap-5 border-b bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 md:grid"><span>조건</span><span>공고 요구사항</span><span>회사 정보</span><span className="text-right">판정</span></div>
            {requirements.map((requirement) => {
              const result = currentCompany
                ? requirementAssessment(requirement.id, requirement.local_id)
                : undefined;
              const status = result ? statusMeta(result.outcome) : undefined;
              const companyEvidence = result
                ? String(result.evaluated_value ?? result.company_value ?? result.evidence_summary ?? "회사 증빙을 상세 확인하세요.")
                : currentCompany ? "분석 결과 없음" : "회사 프로필 미적용";
              return <article className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-0 md:grid-cols-[140px_minmax(0,1fr)_minmax(180px,.7fr)_120px] md:gap-5" key={requirement.id}>
                <div><span className="text-sm font-semibold text-slate-900">{requirement.title}</span><div className="mt-1 flex gap-1">{requirement.mandatory && <Badge variant="outline" className="h-5 text-[10px]">필수</Badge>}<Badge variant="secondary" className="h-5 text-[10px]">{requirement.type}</Badge></div></div>
                <div><span className="mb-1 block text-xs text-slate-400 md:hidden">공고 요구사항</span><p className="text-sm leading-6 text-slate-700">{requirement.proposition_text ?? requirement.original_text ?? "요구사항 원문을 확인하세요."}</p>{requirement.proof_summary && <small className="mt-1 block text-xs text-slate-500">확인자료 · {requirement.proof_summary}</small>}</div>
                <div><span className="mb-1 block text-xs text-slate-400 md:hidden">회사 정보</span><p className="text-sm leading-6 text-slate-600">{companyEvidence}</p></div>
                <div className="md:text-right">{status ? <Badge className={status.className === "satisfied" ? "bg-emerald-50 text-emerald-800" : status.className === "unsatisfied" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}>{status.icon}{status.label}</Badge> : <Badge variant="secondary">분석 전</Badge>}</div>
                <details className="md:col-start-2 md:col-end-5"><summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-emerald-800">판정 및 원문 근거 보기</summary><div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{result && <p className="mb-2">{String(result.judgment_summary ?? result.reason_summary ?? result.reason_code ?? "판정 근거를 확인해 주세요.")}</p>}<p>{requirement.original_text}</p><small className="mt-2 block text-slate-400">기준시점 · {requirement.observed_at ? new Date(requirement.observed_at).toLocaleString("ko-KR") : "미상"}</small></div></details>
              </article>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}
