export type EntityLinkSource = "relationship" | "global-search" | "notice" | "discovery";

const procurementKeys = ["fromYear", "toYear", "workType", "large", "middle", "field"] as const;

export function procurementContext(params: URLSearchParams) {
  const context = new URLSearchParams();
  procurementKeys.forEach((key) => {
    const value = params.get(key);
    if (value) context.set(key, value);
  });
  return context;
}

export function entityDetailPath(
  type: "organization" | "company",
  id: string,
  options: { source: EntityLinkSource; params?: URLSearchParams; name?: string; company?: string } = {
    source: "global-search",
  },
) {
  const base =
    type === "organization"
      ? `/organizations/${encodeURIComponent(id)}`
      : `/companies/${encodeURIComponent(id)}`;
  const query =
    options.source === "relationship" && options.params
      ? procurementContext(options.params)
      : new URLSearchParams();
  if (type === "company" && options.name) query.set("name", options.name);
  if (type === "organization" && options.company) query.set("company", options.company);
  const suffix = query.toString();
  return suffix ? `${base}?${suffix}` : base;
}
