import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { networkProfileQueryOptions, useExplorerNoticeContext } from "./api";
import { type ExplorerEntity, type useNetworkExplorer } from "./useNetworkExplorer";
import type { ExplorerCandidate } from "./api";
import {
  procurementFieldIdentity,
  procurementFieldSelection,
  type ProcurementFieldOptionSource,
} from "@/shared/procurement/field-options";
import { procurementWorkTypeLabels } from "@/shared/procurement/presentation";
import type { AppliedFilter } from "@/components/procurement/procurement-filter-panel";

const filterKeys = [
  "center_type",
  "center_id",
  "center_name",
  "q",
  "searchLabel",
  "fromYear",
  "toYear",
  "workType",
  "large",
  "middle",
  "field",
  "fieldName",
  "fieldOption",
  "region",
  "regionName",
  "sourceNotice",
  "sourceNoticeName",
  "contextMissing",
];
type Values = Record<string, string | undefined>;
export function useExplorerFilters(view: ReturnType<typeof useNetworkExplorer>, open: boolean) {
  const base = useMemo<Values>(
    () => ({
      ...Object.fromEntries(
        filterKeys.map((key) => [
          key,
          view.params.get(key) ??
            (key === "center_type"
              ? view.root?.type
              : key === "center_id"
                ? view.root?.id
                : key === "center_name"
                  ? view.root?.name
                  : undefined),
        ]),
      ),
      searchLabel: view.params.get("searchLabel") ?? view.root?.name,
      q: view.params.get("searchLabel") ?? view.root?.name ?? view.params.get("q") ?? undefined,
      fromYear: String(view.fromYear),
      toYear: String(view.toYear),
    }),
    [view.params, view.root?.type, view.root?.id, view.root?.name, view.fromYear, view.toYear],
  );
  const basis = JSON.stringify(base);
  const [store, setStore] = useState<{ basis: string; values: Values }>({ basis, values: base });
  const values = store.basis === basis ? store.values : base;
  const edit = (changes: Values) =>
    setStore((previous) => ({
      basis,
      values: { ...(previous.basis === basis ? previous.values : base), ...changes },
    }));
  const fromYear = Number(values.fromYear ?? view.fromYear);
  const toYear = Number(values.toYear ?? view.toYear);
  const root: ExplorerEntity | undefined =
    values.center_id && ["company", "organization", "field"].includes(values.center_type ?? "")
      ? {
          type: values.center_type as ExplorerEntity["type"],
          id: values.center_id,
          name: values.center_name ?? values.center_id,
        }
      : view.root;
  const [noticeId, setNoticeId] = useState<string>();
  const noticeContext = useExplorerNoticeContext(noticeId);
  const appliedNotice = useRef<string | undefined>(undefined);
  useEffect(() => {
    const result = noticeContext.data;
    if (
      !noticeId ||
      !result ||
      result.truncated ||
      appliedNotice.current === noticeId ||
      values.sourceNotice !== noticeId ||
      !result.notice.organization_code
    )
      return;
    appliedNotice.current = noticeId;
    const notice = result.notice;
    // Fill only missing fields; a later manual category selection wins.
    setStore((previous) => {
      const current = previous.basis === basis ? previous.values : base;
      if (current.sourceNotice !== noticeId) return previous;
      const hasField = current.field || current.large || current.middle;
      return {
        basis,
        values: {
          ...current,
          center_type: "organization",
          center_id: notice.organization_code,
          center_name: notice.organization,
          workType: current.workType ?? notice.work_type,
          ...(!hasField
            ? {
                field: notice.field_code,
                large: notice.large_category,
                middle: notice.middle_category,
                fieldName: notice.field_name ?? notice.middle_category ?? notice.large_category,
              }
            : {}),
          region: result.region_code,
          regionName: result.region_name,
          contextMissing:
            hasField || notice.field_code || notice.large_category || notice.middle_category
              ? undefined
              : "field",
        },
      };
    });
  }, [noticeId, noticeContext.data, basis, values.sourceNotice, values.contextMissing, base]);
  const filters = {
    workType: values.workType,
    largeCategory: values.large,
    middleCategory: values.middle,
    fieldCode: values.field,
  };
  const catalogOptions = networkProfileQueryOptions(
    root ?? { type: "organization", id: "", name: "" },
    fromYear,
    toYear,
    filters,
    view.nodeLimit,
  );
  const catalog = useQuery({
    ...catalogOptions,
    enabled: Boolean(
      root && root.type !== "field" && (open || root.id !== view.root?.id || root.type !== view.root?.type),
    ),
  });
  const baseCatalog = useQuery({
    ...networkProfileQueryOptions(
      root ?? { type: "organization", id: "", name: "" },
      fromYear,
      toYear,
      {
        workType: values.workType,
      },
      view.nodeLimit,
    ),
    enabled: false,
  });
  const fields: ProcurementFieldOptionSource[] = [
    ...(catalog.isError || catalog.isPlaceholderData ? [] : (catalog.data?.field_distribution ?? [])),
    ...(baseCatalog.data?.field_distribution ?? []),
    ...view.categoryFields,
    ...(view.companyData?.field_distribution ?? view.organizationData?.field_distribution ?? []),
  ]
    .filter(
      (field, index, all) =>
        all.findIndex((other) => procurementFieldIdentity(other) === procurementFieldIdentity(field)) ===
        index,
    )
    .filter(
      (field) => !values.workType || !field.work_types?.length || field.work_types.includes(values.workType),
    );
  const chooseRoot = (entity: ExplorerEntity, extra: Values = {}) => {
    setNoticeId(undefined);
    edit({
      center_type: entity.type,
      center_id: entity.id,
      center_name: entity.name,
      searchLabel: entity.name,
      q: entity.name,
      sourceNotice: undefined,
      sourceNoticeName: undefined,
      contextMissing: undefined,
      ...extra,
    });
  };
  const chooseNotice = (notice: ExplorerCandidate) => {
    const context = notice.context ?? {};
    const applicable = new Set(notice.applicable_filters ?? []);
    const organizationCode = context.demand_organization_code ?? context.notice_organization_code ?? undefined;
    const organizationName = context.demand_organization_name ?? context.notice_organization_name ?? undefined;
    const fieldCode = applicable.has("field_code") ? (context.field_code ?? undefined) : undefined;
    appliedNotice.current = undefined;
    setNoticeId(!organizationCode || !fieldCode ? notice.id : undefined);
    edit({
      q: notice.name,
      searchLabel: notice.name,
      sourceNotice: notice.id,
      sourceNoticeName: notice.name,
      center_type: organizationCode ? "organization" : undefined,
      center_id: organizationCode,
      center_name: organizationName,
      workType: applicable.has("work_type") ? (context.work_type ?? undefined) : undefined,
      field: fieldCode,
      large: fieldCode ? (context.large_category ?? undefined) : undefined,
      middle: fieldCode ? (context.middle_category ?? undefined) : undefined,
      fieldName: fieldCode ? (context.field_name ?? undefined) : undefined,
      fieldOption: undefined,
      region: undefined,
      regionName: undefined,
      contextMissing: fieldCode ? undefined : "field",
    });
  };
  const clearField = (level: "large" | "middle" | "field") =>
    edit({
      ...(level === "large" ? { large: undefined } : {}),
      ...(level !== "field" ? { middle: undefined } : {}),
      field: undefined,
      fieldName: undefined,
      fieldOption: undefined,
    });
  const selectField = (identity: string) => {
    if (identity === "all") return clearField("large");
    const field = fields.find((item) => procurementFieldIdentity(item) === identity);
    if (!field) return;
    const selection = procurementFieldSelection(field);
    edit({
      workType: selection.work_type ?? values.workType,
      large: selection.large_category ?? undefined,
      middle: selection.middle_category ?? undefined,
      field: selection.field_code ?? undefined,
      fieldName: field.display_name ?? field.field_name ?? field.middle_category ?? field.large_category,
      fieldOption: identity,
    });
  };
  const hasField = Boolean(values.field || values.large || values.middle);
  const matching = fields.find((field) => {
    const selection = procurementFieldSelection(field);
    return values.field
      ? selection.field_code === values.field
      : values.middle
        ? selection.middle_category === values.middle
        : Boolean(values.large) && selection.large_category === values.large;
  });
  const selectedName =
    values.fieldName ??
    matching?.display_name ??
    matching?.field_name ??
    values.middle ??
    values.large ??
    values.field;
  const fieldValue =
    values.fieldOption ??
    (matching ? procurementFieldIdentity(matching) : undefined) ??
    (hasField ? "selected-field" : "all");
  const chips: AppliedFilter[] = [
    ...(values.workType
      ? [
          {
            key: "workType",
            label: procurementWorkTypeLabels[values.workType] ?? values.workType,
            onRemove: () =>
              edit({
                workType: undefined,
                large: undefined,
                middle: undefined,
                field: undefined,
                fieldName: undefined,
                fieldOption: undefined,
              }),
          },
        ]
      : []),
    ...(values.large ? [{ key: "large", label: values.large, onRemove: () => clearField("large") }] : []),
    ...(values.middle ? [{ key: "middle", label: values.middle, onRemove: () => clearField("middle") }] : []),
    ...(values.field
      ? [{ key: "field", label: selectedName ?? values.field, onRemove: () => clearField("field") }]
      : []),
  ].filter((chip, index, all) => all.findIndex((other) => other.label === chip.label) === index);
  const [error, setError] = useState<string>();
  const apply = () => {
    if (values.q?.trim() !== (values.searchLabel ?? root?.name)) {
      setError("검색 결과에서 원하는 항목을 선택해 주세요.");
      return false;
    }
    if (!root || !values.center_id) {
      setError("검색 결과에서 기관·업체·공고를 선택해 주세요.");
      return false;
    }
    if (!hasField) {
      setError("분야를 선택해 주세요.");
      return false;
    }
    if (
      !Number.isInteger(fromYear) ||
      !Number.isInteger(toYear) ||
      fromYear > toYear ||
      toYear - fromYear > 4 ||
      toYear > new Date().getUTCFullYear()
    ) {
      setError("조회 기간은 최대 5년까지 선택할 수 있습니다.");
      return false;
    }
    setError(undefined);
    const entity =
      root.type === "field"
        ? { ...root, id: values.field ?? values.middle ?? values.large!, name: selectedName ?? root.name }
        : root;
    view.chooseRoot(entity, { ...values, fromYear: String(fromYear), toYear: String(toYear) });
    return true;
  };
  return {
    values,
    hasChanges: JSON.stringify(values) !== basis,
    basis,
    root,
    fromYear,
    toYear,
    fields,
    fieldValue,
    selectedName,
    chips,
    hasField,
    catalog,
    noticeContext,
    noticeId,
    error,
    edit,
    chooseRoot,
    chooseNotice,
    selectField,
    clearField,
    apply,
    reset: () =>
      edit({
        workType: undefined,
        large: undefined,
        middle: undefined,
        field: undefined,
        fieldName: undefined,
        fieldOption: undefined,
        fromYear: String(Math.max(2022, new Date().getUTCFullYear() - 4)),
        toYear: String(new Date().getUTCFullYear()),
      }),
  };
}
