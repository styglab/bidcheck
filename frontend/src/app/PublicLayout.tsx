import { Menu } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { CompanySelector } from "../features/company-context/CompanySelector";
import { ThemeToggle } from "../features/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

export function PublicLayout() {
  return (
    <>
      <header className="site-header">
        <Link className="logo" to="/">
          <span>Bid</span>Check<i>beta</i>
        </Link>
        <nav>
          <NavLink to="/notices">입찰공고</NavLink>
        </nav>
        <div className="header-actions">
          <CompanySelector compact />
          <ThemeToggle />
          <Button className="header-login" variant="outline" type="button">로그인</Button>
        </div>
        <button className="mobile-menu" type="button" aria-label="메뉴 열기">
          <Menu size={19} />
        </button>
      </header>
      <Outlet />
    </>
  );
}
