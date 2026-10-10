import { describe, expect, it } from "vitest";
import type { ProcurementActivityGroup, SupplierEntryCompany } from "./api";
import {
  filterAndSortCompanyRelationships,
  getProcurementActivityView,
  supplierEntryToRelationship,
} from "./procurement-presentation";

describe("organization procurement presentation", () => {
  it("normalizes a grouped procurement activity for the UI", () => {
    const activity: ProcurementActivityGroup = {
      activity_group_id: "contract-1",
      notice_linkage: "linked",
      latest_stage: "contract",
      latest_activity_date: "2026-04-10",
      notice: {
        project_amount: 120_000_000,
        project_amount_basis_name: "추정가격",
      },
      awards: [],
      contracts: [],
      result_summary: { award_count: 0, contract_event_count: 0, contract_version_count: 0 },
    };

    const view = getProcurementActivityView(activity);

    expect(view.status.label).toBe("계약");
    expect(view.projectAmount).toBe(120_000_000);
    expect(view.projectAmountBasis).toBe("추정가격");
    expect(view.resultDate).toBe("2026-04-10");
    expect(view.resultDateLabel).toBe("계약일");
  });

  it("uses the actual deadline for an open notice instead of its latest activity date", () => {
    const activity: ProcurementActivityGroup = {
      activity_group_id: "open-1",
      notice_linkage: "linked",
      latest_stage: "open",
      latest_activity_date: "2026-10-07",
      notice: {
        published_at: "2026-10-07",
        deadline_at: "2026-10-20T01:00:00Z",
      },
      awards: [],
      contracts: [],
      result_summary: { award_count: 0, contract_event_count: 0, contract_version_count: 0 },
    };

    const view = getProcurementActivityView(activity);

    expect(view.resultDate).toBe("2026-10-20T01:00:00Z");
    expect(view.resultDateLabel).toBe("마감");
  });

  it("converts a supplier entry without inventing participation data", () => {
    const supplier: SupplierEntryCompany = {
      company_number: "1234567890",
      company_name: "신규업체",
      entry_status: "first_observed",
      entry_status_name: "신규 관측",
      target_year_contract_count: 2,
      target_year_attributed_contract_amount: 50_000_000,
      target_year_first_contract_date: "2026-02-01",
      target_year_latest_contract_date: "2026-06-01",
    };

    expect(supplierEntryToRelationship(supplier)).toMatchObject({
      company_number: "1234567890",
      participation_count: 0,
      award_event_count: 0,
      contract_event_count: 2,
      active_years: [2026],
    });
  });

  it("filters and sorts locally loaded contract companies", () => {
    const companies = [
      {
        company_number: "1",
        company_name: "한빛정보",
        participation_count: 0,
        award_event_count: 0,
        contract_event_count: 2,
        total_attributed_contract_amount: 30_000_000,
        amount_completeness: "complete" as const,
        latest_contract_date: "2025-01-01",
        active_years: [2025],
        active_year_count: 1,
        yearly_activity: [],
        major_fields: [],
        representative_notices: [],
      },
      {
        company_number: "2",
        company_name: "한빛건설",
        participation_count: 0,
        award_event_count: 0,
        contract_event_count: 5,
        total_attributed_contract_amount: 10_000_000,
        amount_completeness: "complete" as const,
        latest_contract_date: "2026-01-01",
        active_years: [2026],
        active_year_count: 1,
        yearly_activity: [],
        major_fields: [],
        representative_notices: [],
      },
      {
        company_number: "3",
        company_name: "다른업체",
        participation_count: 0,
        award_event_count: 0,
        contract_event_count: 9,
        total_attributed_contract_amount: 90_000_000,
        amount_completeness: "complete" as const,
        latest_contract_date: "2026-02-01",
        active_years: [2026],
        active_year_count: 1,
        yearly_activity: [],
        major_fields: [],
        representative_notices: [],
      },
    ];

    expect(filterAndSortCompanyRelationships(companies, "한빛", "contract_count_desc")).toEqual([
      expect.objectContaining({ company_number: "2" }),
      expect.objectContaining({ company_number: "1" }),
    ]);
  });
});
