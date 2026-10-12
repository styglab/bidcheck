import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { api } from "./client";
import { useCompanyProcurementProfile } from "@/features/company-context/api";
import {
  useOrganizationCompanyRelationship,
  useOrganizationProcurementProfile,
} from "@/features/organizations/api";

vi.mock("./client", () => ({ api: vi.fn() }));

function CompanyView({ id, page }: { id: string; page: number }) {
  const query = useCompanyProcurementProfile(id, { page });
  return <p>{query.data?.company.name ?? "불러오는 중"}</p>;
}
function OrganizationView({ id, page }: { id: string; page: number }) {
  const query = useOrganizationProcurementProfile(id, 5, {}, true, undefined, { page });
  return <p>{query.data?.organization.name ?? "불러오는 중"}</p>;
}
function RelationshipCompanyView({ id, page }: { id: string; page: number }) {
  const query = useOrganizationCompanyRelationship("ORG-A", id, page);
  return <p>{query.data?.company?.name ?? "불러오는 중"}</p>;
}
function RelationshipOrganizationView({ id, page }: { id: string; page: number }) {
  const query = useOrganizationCompanyRelationship(id, "1234567890", page);
  return <p>{query.data?.company?.name ?? "불러오는 중"}</p>;
}

const payload = (name: string) => ({ company: { name }, organization: { name } });

describe("조회 대상별 이전 결과 유지", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it.each([
    ["회사", CompanyView, "1234567890", "0987654321"],
    ["기관", OrganizationView, "ORG-A", "ORG-B"],
    ["관계의 회사", RelationshipCompanyView, "1234567890", "0987654321"],
    ["관계의 기관", RelationshipOrganizationView, "ORG-A", "ORG-B"],
  ] as const)("%s 전환 때 이전 대상 결과를 표시하지 않는다", async (_name, View, first, second) => {
    const pending: Array<(value: unknown) => void> = [];
    (api as Mock).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (id: string, page: number) => (
      <QueryClientProvider client={client}>
        <View id={id} page={page} />
      </QueryClientProvider>
    );
    const view = render(tree(first, 1));
    await act(async () => pending[0](payload("이전 대상")));
    await screen.findByText("이전 대상");

    view.rerender(tree(first, 2));
    expect(screen.getByText("이전 대상")).toBeInTheDocument();
    view.rerender(tree(second, 1));
    expect(screen.getByText("불러오는 중")).toBeInTheDocument();
    expect(screen.queryByText("이전 대상")).not.toBeInTheDocument();

    await act(async () => pending[1](payload("늦게 도착한 이전 대상")));
    expect(screen.queryByText("늦게 도착한 이전 대상")).not.toBeInTheDocument();
    await act(async () => pending[2](payload("현재 대상")));
    await screen.findByText("현재 대상");
    expect(screen.queryByText("이전 대상")).not.toBeInTheDocument();
  });
});
