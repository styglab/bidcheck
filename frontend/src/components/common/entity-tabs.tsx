type EntityTab = { id: string; label: string; count?: number };

export function EntityTabs({ items, value, onChange }: { items: EntityTab[]; value: string; onChange: (value: string) => void }) {
  return <div className="mt-9 overflow-x-auto border-b" role="tablist"><div className="flex min-w-max gap-1">{items.map((item) => <button key={item.id} type="button" role="tab" aria-selected={value === item.id} onClick={() => onChange(item.id)} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${value === item.id ? "border-blue-800 text-blue-800 dark:border-blue-300 dark:text-blue-300" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item.label}{item.count != null && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px]">{item.count.toLocaleString()}</span>}</button>)}</div></div>;
}
