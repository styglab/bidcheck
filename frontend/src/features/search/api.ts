import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

export type GlobalSuggestion = {
  organizations: Array<{ organization_code: string; name: string; jurisdiction_type?: string }>;
  companies: Array<{ business_registration_number: string; name: string }>;
  notices: Array<{ id: string; name: string; organization?: string; status?: string; published_at?: string }>;
  total_counts: { organizations: number; companies: number; notices: number };
};

export function useGlobalSuggestions(query: string) {
  return useQuery({
    queryKey: ["global-suggestions", query],
    queryFn: ({ signal }) =>
      api<GlobalSuggestion>(`/search/suggest?q=${encodeURIComponent(query)}&limit=3`, { signal }),
    enabled: query.trim().length >= 2,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    placeholderData: (previous) => previous,
  });
}
