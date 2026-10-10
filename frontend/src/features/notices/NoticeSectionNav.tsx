import { useEffect, useState } from "react";

export type NoticeSectionNavItem = {
  id: string;
  label: string;
};

export function NoticeSectionNav({ items }: { items: NoticeSectionNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const updateActiveSection = () => {
      const headerHeight = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--site-header-height"),
      );
      const threshold = (Number.isFinite(headerHeight) ? headerHeight : 70) + 76;
      const active = items.reduce((current, item) => {
        const element = document.getElementById(item.id);
        return element && element.getBoundingClientRect().top <= threshold ? item.id : current;
      }, items[0]?.id ?? "");
      setActiveId(active);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [items]);

  return (
    <nav
      aria-label="공고 상세 영역"
      className="sticky top-[var(--site-header-height,70px)] z-20 -mx-5 mt-6 overflow-x-auto border-y bg-card/95 px-3 backdrop-blur-sm sm:-mx-7 sm:px-5"
    >
      <div className="flex min-h-14 min-w-max items-stretch gap-1">
        {items.map((item) => (
          <button
            aria-current={activeId === item.id ? "location" : undefined}
            className={`border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4 ${
              activeId === item.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            key={item.id}
            onClick={() => {
              setActiveId(item.id);
              document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
