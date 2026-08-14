import { Menu } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { CompanySelector } from "../features/company-context/CompanySelector";

export function PublicLayout() {
  return (
    <>
      <header className="site-header">
        <Link className="logo" to="/">
          <span>Bid</span>Check<i>beta</i>
        </Link>
        <nav>
          <NavLink to="/notices">공고 찾기</NavLink>
          <NavLink to="/companies">업체 조회</NavLink>
          <Link to="/#features">서비스 소개</Link>
        </nav>
        <div className="header-actions">
          <span className="header-context">검토 업체</span>
          <CompanySelector compact />
          <a href="mailto:feedback@bidcheck.kr">의견 보내기</a>
          <button type="button">로그인</button>
        </div>
        <button className="mobile-menu" type="button" aria-label="메뉴 열기">
          <Menu size={19} />
        </button>
      </header>
      <Outlet />
    </>
  );
}
