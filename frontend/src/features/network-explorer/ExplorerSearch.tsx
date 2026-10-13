import { useEffect, useId, useRef, useState } from "react";
import { Search, X, FileText, Building2, Landmark, Tags, LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useExplorerAutocomplete, useFieldSearch, type ClassificationCatalogItem, type ExplorerCandidate } from "./api";
import type { ExplorerEntity } from "./useNetworkExplorer";
type Choice = {
  kind: "notice" | "entity" | "field";
  label: string;
  meta?: string;
  entity?: ExplorerEntity;
  noticeId?: string;
  notice?: ExplorerCandidate;
  field?: ClassificationCatalogItem;
};
export function ExplorerSearch({
  initialQuery,
  fromYear,
  toYear,
  onChoose,
  onNotice,
  onField,
  selectedLabel,
  onSearch,
  onInputChange,
}: {
  onInputChange?: (text: string) => void;
  initialQuery: string;
  fromYear: number;
  toYear: number;
  onChoose: (entity: ExplorerEntity, query: string) => void;
  onNotice: (notice: ExplorerCandidate, query: string) => void;
  selectedLabel?: string;
  onSearch: () => void;
  onField: (field: ClassificationCatalogItem, query: string) => void;
}) {
  const [input, setInput] = useState(selectedLabel ?? initialQuery);
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const container = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const trimmed = input.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(trimmed), 250);
    return () => window.clearTimeout(timer);
  }, [trimmed]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const query =
    open && trimmed !== selectedLabel && debounced === trimmed && trimmed.length >= 2 ? debounced : "";
  const autocomplete = useExplorerAutocomplete(query);
  const fields = useFieldSearch(query, fromYear, toYear);
  const candidates = autocomplete.data?.pages.flatMap((page) => page.candidates) ?? [];
  const organizationItems = candidates.filter((item) => item.type === "organization");
  const duplicateOrganizationNames = new Set(
    organizationItems
      .filter((item) => organizationItems.some((other) => other !== item && other.name === item.name))
      .map((item) => item.name),
  );
  const choices: Choice[] = query
    ? [
        ...(fields.data?.items.slice(0, 5) ?? []).map((f) => ({
          kind: "field" as const,
          label: f.field_name,
          meta: [f.large_category, f.middle_category].filter(Boolean).join(" · ") || f.field_code,
          field: f,
        })),
        ...candidates.filter((item) => item.type === "bid_notice").map((n) => ({
          kind: "notice" as const,
          label: n.name,
          meta: `${n.context?.demand_organization_name ?? n.context?.notice_organization_name ?? "기관 확인 필요"} · ${n.id.replace(":", "-")}`,
          noticeId: n.id,
          notice: n,
        })),
        ...organizationItems.map(
          (o) => ({
            kind: "entity" as const,
            label: o.name,
            meta: `기관 코드 ${o.id}`,
            entity: { type: "organization" as const, id: o.id, name: o.name },
          }),
        ),
        ...candidates.filter((item) => item.type === "company")
          .map((c) => ({
            kind: "entity" as const,
            label: c.name,
            meta: `업체 번호 ${c.id}`,
            entity: {
              type: "company" as const,
              id: c.id,
              name: c.name,
            },
          })),
      ]
    : [];
  const pendingSources = [autocomplete.isFetching && "검색 결과", fields.isFetching && "분야"].filter(
    (source): source is string => Boolean(source),
  );
  const loading = debounced !== trimmed || pendingSources.length > 0;
  const loadingLabel =
    debounced !== trimmed
      ? "검색 준비 중"
      : pendingSources.length > 0
        ? `${pendingSources.join("·")} 찾는 중`
        : "검색 중";
  const error = autocomplete.isError || fields.isError;
  const choose = (choice: Choice) => {
    setOpen(false);
    setActive(-1);
    setInput(choice.label);
    if (choice.kind === "notice" && choice.notice) onNotice(choice.notice, trimmed);
    else if (choice.kind === "field" && choice.field) onField(choice.field, trimmed);
    else if (choice.entity) onChoose(choice.entity, trimmed);
  };
  return (
    <div ref={container} className="flex min-w-0 w-full items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          className="h-9 w-full rounded-lg pl-9 pr-9 text-sm"
          role="combobox"
          aria-label="공고·기관·업체·분야 실시간 검색"
          aria-autocomplete="list"
          aria-expanded={open && trimmed.length >= 2}
          aria-controls={listId}
          aria-activedescendant={active >= 0 && active < choices.length ? `${listId}-${active}` : undefined}
          placeholder="공고명, 기관, 업체, 분야·품목 검색"
          value={input}
          onFocus={() => {
            if (trimmed !== selectedLabel) setOpen(true);
          }}
          onChange={(e) => {
            setInput(e.target.value);
            onInputChange?.(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              if (choices.length)
                setActive((i) =>
                  i < 0
                    ? e.key === "ArrowDown"
                      ? 0
                      : choices.length - 1
                    : (i + (e.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length,
                );
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (trimmed === selectedLabel) onSearch();
              else if (choices[active >= 0 ? active : 0]) choose(choices[active >= 0 ? active : 0]);
              else setOpen(true);
            } else if (e.key === "Tab") setOpen(false);
          }}
        />
        {input && (
          <button
            className="absolute right-2 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="검색어 지우기"
            onClick={() => {
              setInput("");
              onInputChange?.("");
              setActive(-1);
              inputRef.current?.focus();
            }}
          >
            <X className="size-4" />
          </button>
        )}
        {open && trimmed !== selectedLabel && trimmed.length >= 2 && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs">
              <span className="font-semibold text-foreground">검색 결과</span>
              {loading ? (
                <span role="status" className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                  <span className="truncate">{loadingLabel}</span>
                </span>
              ) : choices.length > 0 ? (
                <span className="tabular-nums text-muted-foreground">{choices.length}개 표시</span>
              ) : null}
            </div>
            {duplicateOrganizationNames.size > 0 && (
              <p className="border-b bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
                같은 이름의 기관 코드가 여러 개입니다. 코드를 확인해 선택하세요.
              </p>
            )}
            <div
              id={listId}
              role="listbox"
              aria-label="실시간 검색 결과"
              className="max-h-[min(480px,55dvh)] overflow-y-auto p-2"
            >
              {choices.map((choice, index) => {
                const Icon =
                  choice.kind === "notice"
                    ? FileText
                    : choice.kind === "field"
                      ? Tags
                      : choice.entity?.type === "organization"
                        ? Landmark
                        : Building2;
                const type =
                  choice.kind === "notice"
                    ? "공고"
                    : choice.kind === "field"
                      ? "분야"
                      : choice.entity?.type === "organization"
                        ? "기관"
                        : "업체";
                return (
                  <button
                    key={`${choice.kind}-${choice.noticeId ?? choice.field?.field_code ?? choice.entity?.id}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={active === index}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${active === index ? "bg-accent" : "hover:bg-muted"}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(choice)}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${choice.kind === "notice" ? "bg-amber-50 text-amber-700" : choice.entity?.type === "company" ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{choice.label}</span>
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                        {choice.meta}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{type}</span>
                  </button>
                );
              })}
              {!choices.length && loading && (
                <div className="space-y-2 p-2" aria-hidden="true">
                  {[0, 1].map((index) => (
                    <div key={index} className="flex animate-pulse items-center gap-3 rounded-xl px-1 py-2">
                      <span className="size-9 shrink-0 rounded-lg bg-muted" />
                      <span className="flex flex-1 flex-col gap-2">
                        <span className="h-3 w-2/3 rounded bg-muted" />
                        <span className="h-2.5 w-1/3 rounded bg-muted" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!choices.length && !loading && !error && query && (
                <p className="p-4 text-xs text-muted-foreground">
                  검색 결과가 없습니다. 다른 검색어를 입력하세요.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="border-t p-3 text-xs text-muted-foreground">
                일부 검색 결과를 불러오지 못했습니다.{" "}
                <button
                  className="text-primary underline"
                  onClick={() => {
                    void autocomplete.refetch();
                    void fields.refetch();
                  }}
                >
                  다시 시도
                </button>
              </p>
            )}
            <div className="flex flex-wrap gap-3 border-t px-4 py-2 text-xs">
              {autocomplete.hasNextPage && (
                <button className="text-primary hover:underline" onClick={() => void autocomplete.fetchNextPage()}>
                  {autocomplete.isFetchingNextPage ? "더 찾는 중" : "검색 결과 더 보기"}
                </button>
              )}
            </div>
            <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">
              ↑↓ 이동 · Enter 선택 · Esc 닫기 ·{" "}
              공고·기관·업체·분야
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
