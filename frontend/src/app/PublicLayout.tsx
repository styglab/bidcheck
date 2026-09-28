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
          <NavLink to="/" end>
            관계 탐색
          </NavLink>
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
