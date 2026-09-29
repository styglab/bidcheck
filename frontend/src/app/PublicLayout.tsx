import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "../features/theme/ThemeToggle";

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const closeMenu = () => setMenuOpen(false);
  return (
    <>
      <header className="site-header">
        <Link className="logo" to="/" onClick={closeMenu}>
          <span>입찰</span>체크<i>beta</i>
        </Link>
        <nav className={menuOpen ? "is-open" : ""}>
          <NavLink className={location.pathname.startsWith("/explore") ? "active" : ""} to="/explore" onClick={closeMenu}>탐색</NavLink>
          <NavLink className={location.pathname.startsWith("/relations") ? "active" : ""} to="/relations" onClick={closeMenu}>관계 지도</NavLink>
          <NavLink to="/mcp" onClick={closeMenu}>MCP</NavLink>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <NavLink className="header-contact" to="/contact" onClick={closeMenu}>문의하기</NavLink>
        </div>
        <button className="mobile-menu" type="button" aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </header>
      <Outlet />
    </>
  );
}
