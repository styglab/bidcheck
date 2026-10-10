import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export const ENTITY_RELATIONSHIP_PAGE_SIZE = 10;

export type EntityRelationshipListItem = {
  key: string;
  name: string;
  amount?: number;
  contractCount: number;
  latestContractDate?: string;
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "outline" }>;
};

type Props = {
  items: EntityRelationshipListItem[];
  entityLabel: string;
  amountLabel?: string;
  startRank?: number;
  money: (value?: number) => string;
  onSelect: (item: EntityRelationshipListItem) => void;
  renderName?: (item: EntityRelationshipListItem) => ReactNode;
};

function RelationshipBadges({ item }: { item: EntityRelationshipListItem }) {
  if (!item.badges?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {item.badges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant ?? "outline"}>
          {badge.label}
        </Badge>
      ))}
    </span>
  );
}

export function EntityRelationshipList({
  items,
  entityLabel,
  amountLabel = "귀속 계약금액",
  startRank = 1,
  money,
  onSelect,
  renderName,
}: Props) {
  return (
    <>
      <div className="divide-y overflow-hidden rounded-xl border bg-card lg:hidden">
        {items.map((item, index) => (
          <button
            className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 p-4 text-left text-sm transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[1.25rem_minmax(0,1fr)_auto]"
            key={item.key}
            onClick={() => onSelect(item)}
            type="button"
          >
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {startRank + index}
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{renderName?.(item) ?? item.name}</span>
                <RelationshipBadges item={item} />
              </span>
              <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                계약 {item.contractCount.toLocaleString("ko-KR")}건
                {item.latestContractDate ? ` · 최근 ${item.latestContractDate.slice(0, 10)}` : ""}
              </span>
            </span>
            <strong className="col-start-2 text-left tabular-nums sm:col-start-auto sm:min-w-24 sm:text-right">
              {item.amount == null ? "금액 미확인" : money(item.amount)}
            </strong>
          </button>
        ))}
      </div>

      <DataTable className="hidden lg:block" minWidth={720}>
        <thead>
          <tr>
            <th className="w-14">순위</th>
            <th>{entityLabel}</th>
            <th className="text-right">계약 건수</th>
            <th className="text-right">최근 계약</th>
            <th className="text-right">{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.key}>
              <td className="text-muted-foreground">{startRank + index}</td>
              <td>
                <button
                  className="inline-flex max-w-full items-center gap-2 text-left font-medium transition-colors hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onSelect(item)}
                  type="button"
                >
                  <span className="truncate">{renderName?.(item) ?? item.name}</span>
                  <RelationshipBadges item={item} />
                </button>
              </td>
              <td className="text-right">{item.contractCount.toLocaleString("ko-KR")}건</td>
              <td className="text-right text-muted-foreground">
                {item.latestContractDate?.slice(0, 10) ?? "-"}
              </td>
              <td className="text-right font-semibold">
                {item.amount == null ? "금액 미확인" : money(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
