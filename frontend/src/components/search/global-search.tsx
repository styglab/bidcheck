import { Building2, FileText, Landmark, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalSuggestions } from "@/features/search/api";

type Result = { key: string; type: "기관" | "업체" | "공고"; title: string; detail: string; to: string };

export function GlobalSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(input.trim()), 250); return () => window.clearTimeout(timer); }, [input]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const suggestions = useGlobalSuggestions(query);
  const results = useMemo<Result[]>(() => {
    const data = suggestions.data;
    if (!data) return [];
    return [
      ...data.organizations.map((item) => ({ key: `o-${item.organization_code}`, type: "기관" as const, title: item.name, detail: `${item.jurisdiction_type ?? "공공기관"} · ${item.organization_code}`, to: `/organizations/${encodeURIComponent(item.organization_code)}` })),
      ...data.companies.map((item) => ({ key: `c-${item.business_registration_number}`, type: "업체" as const, title: item.name, detail: `사업자등록번호 ${item.business_registration_number}`, to: `/companies/${encodeURIComponent(item.business_registration_number)}?name=${encodeURIComponent(item.name)}` })),
      ...data.notices.map((item) => ({ key: `n-${item.id}`, type: "공고" as const, title: item.name, detail: [item.organization, item.published_at?.slice(0, 10)].filter(Boolean).join(" · "), to: `/notices/${encodeURIComponent(item.id)}` })),
    ];
  }, [suggestions.data]);
  useEffect(() => setActiveIndex(-1), [query, results.length]);
  const choose = (result: Result) => { setOpen(false); setInput(""); navigate(result.to); };
  const groups = ["기관", "업체", "공고"] as const;
  return <div className="relative order-4 w-full min-w-0 md:order-none md:w-[min(34vw,28rem)]" ref={rootRef}>
    <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="공고·기관·업체 검색" className="h-10 w-full rounded-xl border bg-background pl-9 pr-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-blue-400 focus:ring-3 focus:ring-blue-100 dark:focus:ring-blue-950" onChange={(event) => { setInput(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((value) => Math.min(value + 1, results.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((value) => Math.max(value - 1, 0)); } else if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); choose(results[activeIndex]); } else if (event.key === "Escape") setOpen(false); }} placeholder="공고·기관·업체 검색" value={input} />{suggestions.isFetching && query.length >= 2 ? <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-blue-800" /> : input ? <button aria-label="검색어 지우기" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setInput(""); setQuery(""); setOpen(false); }} type="button"><X className="size-4" /></button> : null}</div>
    {open && input.trim().length >= 2 && <div className="absolute left-0 right-0 top-[calc(100%+.5rem)] z-50 max-h-[min(70vh,34rem)] overflow-y-auto rounded-2xl border bg-popover p-2 text-popover-foreground shadow-2xl">
      {groups.map((group) => { const items = results.filter((item) => item.type === group); if (!items.length) return null; const Icon = group === "기관" ? Landmark : group === "업체" ? Building2 : FileText; return <section key={group}><p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">{group}</p>{items.map((item) => { const index = results.indexOf(item); return <button className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ${index === activeIndex ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-muted/60"}`} key={item.key} onClick={() => choose(item)} onMouseEnter={() => setActiveIndex(index)} type="button"><Icon className="mt-0.5 size-4 shrink-0 text-blue-800 dark:text-blue-300" /><span className="min-w-0"><strong className="block truncate text-sm">{item.title}</strong><small className="mt-0.5 block truncate text-muted-foreground">{item.detail}</small></span></button>; })}</section>; })}
      {!suggestions.isFetching && results.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
    </div>}
  </div>;
}
