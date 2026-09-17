import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
import type { ProcurementAward } from "../notices/api";

export function useRecentAwards() {
  return useQuery({
    queryKey: ["home-recent-awards"],
    queryFn: ({ signal }) => api<{ items: ProcurementAward[] }>("/home/recent-awards", { signal }),
    staleTime: 5 * 60_000,
  });
}
