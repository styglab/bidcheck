import { Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "../features/theme/ThemeToggle";
import { GlobalSearch } from "@/components/search/global-search";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const primaryNavigation = [
  { label: "공고 탐색", to: "/notices" },
  { label: "기관 분석", to: "/organizations" },
  { label: "업체 분석", to: "/companies" },
] as const;

const desktopNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative flex h-16 items-center whitespace-nowrap px-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isActive &&
      "text-primary after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
  );

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    isActive && "bg-primary/8 text-primary",
  );

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeOverlays = () => {
    setMenuOpen(false);
    setSearchOpen(false);
  };

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const updateHeight = () =>
      document.documentElement.style.setProperty("--site-header-height", `${header.offsetHeight}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--site-header-height");
    };
  }, []);
  return (
    <>
      <header
        className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90"
        ref={headerRef}
      >
        <div className="relative mx-auto flex h-full w-full max-w-[1160px] items-center gap-4 px-4 sm:px-6">
          <Link
            aria-label="입찰체크 홈"
            className="shrink-0 text-[21px] font-bold tracking-[-0.05em]"
            to="/"
            onClick={closeOverlays}
          >
            <span className="text-primary">입찰</span>체크
            <span className="ml-1.5 align-top text-[9px] font-semibold tracking-normal text-muted-foreground">
              BETA
            </span>
          </Link>

          <nav aria-label="주요 메뉴" className="hidden h-full items-center gap-6 lg:flex">
            {primaryNavigation.map((item) => (
              <NavLink className={desktopNavLinkClass} key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <GlobalSearch className="ml-auto hidden w-full max-w-[26rem] flex-1 md:block" />

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <Button
              aria-expanded={searchOpen}
              aria-label={searchOpen ? "통합검색 닫기" : "통합검색 열기"}
              className="md:hidden"
              onClick={() => {
                setSearchOpen((open) => !open);
                setMenuOpen(false);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              {searchOpen ? <X /> : <Search />}
            </Button>

            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <NavLink
              className="hidden rounded-lg px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block"
              to="/contact"
            >
              문의
            </NavLink>

            <Button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              className="lg:hidden"
              onClick={() => {
                setMenuOpen((open) => !open);
                setSearchOpen(false);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>

          {searchOpen && (
            <div className="absolute inset-x-4 top-[calc(100%+.5rem)] rounded-xl border bg-popover p-2 shadow-xl md:hidden">
              <GlobalSearch autoFocus className="w-full" onSelect={() => setSearchOpen(false)} />
            </div>
          )}

          {menuOpen && (
            <nav
              aria-label="모바일 메뉴"
              className="absolute inset-x-4 top-[calc(100%+.5rem)] flex flex-col rounded-xl border bg-popover p-2 shadow-xl lg:hidden"
            >
              {primaryNavigation.map((item) => (
                <NavLink className={mobileNavLinkClass} key={item.to} onClick={closeOverlays} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-1 flex items-center justify-between border-t px-3 pt-2">
                <span className="text-xs font-medium text-muted-foreground">화면 설정</span>
                <ThemeToggle />
              </div>
              <NavLink className={mobileNavLinkClass} onClick={closeOverlays} to="/contact">
                문의
              </NavLink>
            </nav>
          )}
        </div>
      </header>
      <Outlet />
    </>
  );
}
