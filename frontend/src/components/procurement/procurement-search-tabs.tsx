import { NavLink } from "react-router-dom";

const items = [
  { to: "/notices", label: "공고" },
  { to: "/organizations", label: "기관" },
  { to: "/companies", label: "업체" },
];

export function ProcurementSearchTabs() {
  return (
    <nav className="mb-7 flex w-fit gap-1 rounded-xl bg-muted/60 p-1" aria-label="조달 검색 대상">
      {items.map((item) => (
        <NavLink
          className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
