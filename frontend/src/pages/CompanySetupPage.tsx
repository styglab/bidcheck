import { Building2, CheckCircle2, LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCompanySearch } from "../features/company-context/api";
import { useCompany } from "../features/company-context/useCompany";
import { PageContainer } from "@/components/layout/page-container";

export function CompanySetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { selectCompany } = useCompany();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const digits = input.replace(/\D/g, "");
  const query = useCompanySearch(search);
  const company = query.data?.items[0];
  const returnTo = params.get("returnTo");
  const destination = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/notices";

  const applyCompany = () => {
    if (!company?.business_registration_number) return;
    const name = company.name ?? String(company.properties.company_name ?? company.properties.business_name ?? "이름 미상 회사");
    selectCompany({
      id: company.id,
      name,
      legalName: name,
      businessNumber: company.business_registration_number,
      location: String(company.properties.full_address ?? company.properties.address ?? "소재지 정보 없음"),
    });
    navigate(destination, { replace: true });
  };

  return (
    <PageContainer className="max-w-3xl">
      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">회사 프로필</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">우리 회사 적용하기</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">사업자등록번호로 공개 회사정보를 불러옵니다. 로그인 없이 바로 공고 검토에 사용할 수 있습니다.</p>

      <Card className="mt-8 shadow-sm">
        <CardHeader><CardTitle className="text-base">사업자등록번호</CardTitle></CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (digits.length === 10) setSearch(digits); }}>
            <Input className="h-11 flex-1" inputMode="numeric" value={input} onChange={(event) => setInput(event.target.value)} placeholder="숫자 10자리" aria-label="사업자등록번호" />
            <Button className="h-11 bg-blue-800 px-5 hover:bg-blue-700" disabled={digits.length !== 10 || query.isFetching}>
              {query.isFetching ? <LoaderCircle className="animate-spin" /> : <Search />} 정보 불러오기
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">이 정보는 공고별 지역·업종·기업구분·자격요건을 확인하는 데 사용됩니다.</p>
          {query.isError && <p className="mt-5 rounded-lg bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">{query.error.message}</p>}
        </CardContent>
      </Card>

      {company && <Card className="mt-5 border-blue-200 py-0 shadow-none"><CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"><Building2 size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-foreground">{company.name ?? "회사명 확인 필요"}</h2><Badge className="gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300"><CheckCircle2 size={12} />조회 완료</Badge></div><p className="mt-1 text-sm text-muted-foreground">{company.business_registration_number}</p><p className="mt-1 text-sm text-muted-foreground">{String(company.properties.full_address ?? company.properties.address ?? "소재지 정보 없음")}</p></div></div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => { setSearch(""); setInput(""); }}>다시 조회</Button><Button className="bg-blue-800 hover:bg-blue-700" onClick={applyCompany}>이 회사 적용</Button></div>
      </CardContent></Card>}
    </PageContainer>
  );
}
