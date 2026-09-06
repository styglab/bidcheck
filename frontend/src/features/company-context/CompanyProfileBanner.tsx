import { Building2, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompanySelector } from "./CompanySelector";
import { useCompany } from "./useCompany";

export function CompanyProfileBanner() {
  const { currentCompany } = useCompany();

  if (!currentCompany) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60 py-0 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800"><Sparkles size={17} /></div>
          <div className="min-w-0 flex-1">
            <strong className="text-sm text-slate-950">우리 회사 기준으로 공고를 검토해 보세요</strong>
            <p className="mt-0.5 text-xs leading-5 text-slate-600">사업자등록번호만 입력하면 주요 참가요건을 비교합니다. 로그인은 필요하지 않습니다.</p>
          </div>
          <CompanySelector mode="apply" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/60 py-0 shadow-none">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800"><Building2 size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm text-slate-950">{currentCompany.name} 기준</strong>
            <Badge className="gap-1 border-0 bg-emerald-100 text-emerald-800"><CheckCircle2 size={12} /> 적용 중</Badge>
            <Badge variant="secondary">임시 프로필</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-600">{currentCompany.businessNumber} · {currentCompany.location} · 정보 없음은 ‘확인 필요’ 처리</p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="outline" size="lg">프로필 보완</Button>
          <CompanySelector mode="change" />
        </div>
      </CardContent>
    </Card>
  );
}
