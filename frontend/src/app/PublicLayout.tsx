import { Menu } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "../features/theme/ThemeToggle";

export function PublicLayout() {
  return (
    <>
      <header className="site-header">
        <Link className="logo" to="/">
          <span>Bid</span>Check<i>beta</i>
        </Link>
        <nav>
          <NavLink to="/notices">공고</NavLink>
          <NavLink to="/companies">업체</NavLink>
          <NavLink to="/organizations">기관</NavLink>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
        </div>
        <button className="mobile-menu" type="button" aria-label="메뉴 열기">
          <Menu size={19} />
        </button>
      </header>
      <Outlet />
    </>
  );
}
