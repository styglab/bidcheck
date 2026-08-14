import { CompanySelector } from "../features/company-context/CompanySelector";
export function CompaniesPage() {
  return (
    <main className="placeholder-page shell content-shell">
      <span className="eyebrow">COMPANY SEARCH</span>
      <h1>업체 조회</h1>
      <p>회사명 또는 사업자등록번호로 업체의 조달·자격 정보를 확인하세요.</p>
      <div className="standalone-selector">
        <CompanySelector />
      </div>
    </main>
  );
}
