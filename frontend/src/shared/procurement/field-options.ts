export type ProcurementFieldOptionSource = {
  field_code?: string;
  field_name?: string;
  large_category?: string;
  middle_category?: string;
  work_types?: string[];
  classification_source?: string;
  attributed_contract_amount?: number;
  display_level?: string;
  display_code?: string;
  display_name?: string;
  has_children?: boolean;
  selection_filter?: {
    work_type?: string | null;
    large_category?: string | null;
    middle_category?: string | null;
    field_code?: string | null;
  };
};

export function procurementFieldIdentity(field: ProcurementFieldOptionSource) {
  const base =
    field.display_code ??
    field.field_code ??
    field.middle_category ??
    field.large_category ??
    field.display_name;
  if (!base) return undefined;
  const workType =
    field.selection_filter?.work_type ?? (field.work_types?.length === 1 ? field.work_types[0] : undefined);
  return `${field.display_level ?? "field"}:${base}${workType ? `:${workType}` : ""}`;
}

export function inferredFieldWorkType(field: ProcurementFieldOptionSource) {
  return field.work_types?.length === 1 ? field.work_types[0] : undefined;
}

export function isDirectFieldSelection(field: ProcurementFieldOptionSource) {
  if (field.selection_filter) return Boolean(field.selection_filter.field_code);
  return Boolean(
    field.field_code &&
    (field.classification_source === "purchase_item" ||
      field.large_category === "물품" ||
      inferredFieldWorkType(field) === "goods"),
  );
}

export function procurementFieldSelection(field: ProcurementFieldOptionSource) {
  if (field.selection_filter) return field.selection_filter;
  const workType = inferredFieldWorkType(field);
  if (isDirectFieldSelection(field) && field.field_code)
    return { work_type: workType, field_code: field.field_code };
  return {
    work_type: workType,
    large_category: field.large_category,
    middle_category: field.middle_category,
    field_code: field.field_code,
  };
}

export function isGenericWorkTypeCategory(field: ProcurementFieldOptionSource) {
  if (field.large_category !== "물품") return false;
  const hasSpecificName = Boolean(
    field.field_code ||
    (field.field_name && field.field_name !== "물품") ||
    (field.middle_category && field.middle_category !== "물품"),
  );
  return !hasSpecificName;
}

export function procurementFieldOptionLabel(
  field: ProcurementFieldOptionSource,
  money: (value?: number) => string,
  workTypeLabels: Record<string, string>,
) {
  const type = field.large_category === "미분류" ? inferredFieldWorkType(field) : undefined;
  const name =
    field.display_name ?? field.field_name ?? field.middle_category ?? field.large_category ?? "미분류";
  return `${type ? `${workTypeLabels[type] ?? type} ` : ""}${name} · ${money(field.attributed_contract_amount)}`;
}
