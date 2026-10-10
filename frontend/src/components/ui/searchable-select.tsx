import * as Popover from "@radix-ui/react-popover";
import { cn } from "cn";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export type SearchableSelectOption = {
  value?: string;
  label: string;
};

type Props = {
  value?: string;
  options: SearchableSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, "");
}

export function SearchableSelect({
  value,
  options,
  onValueChange,
  placeholder = "선택",
  searchPlaceholder = "검색",
  emptyMessage = "검색 결과가 없습니다.",
  ariaLabel,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    return options.filter(
      (option): option is SearchableSelectOption & { value: string } =>
        Boolean(option.value) &&
        (!normalizedQuery || normalizeSearchText(option.label).includes(normalizedQuery)),
    );
  }, [options, query]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <Popover.Trigger asChild>
        <button
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
          disabled={disabled}
          role="combobox"
          type="button"
        >
          <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          collisionPadding={12}
          sideOffset={4}
        >
          <div className="relative m-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              aria-label={`${ariaLabel} 검색`}
              className="h-9 pl-8 text-sm"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder={searchPlaceholder}
              value={query}
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label={`${ariaLabel} 목록`}>
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  aria-selected={option.value === value}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                  key={option.value}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {option.value === value && <Check className="size-4 shrink-0" aria-hidden="true" />}
                </button>
              ))
            ) : (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
