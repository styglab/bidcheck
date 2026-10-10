import { describe, expect, it } from "vitest";
import {
  selectPrimaryAward,
  sortAwardsByLatest,
  sortContractsByLatest,
} from "./procurement-result-presentation";

describe("procurement result presentation", () => {
  it("sorts contract and award records by their latest confirmed date", () => {
    expect(
      sortContractsByLatest([
        { id: "old", concluded_date: "2025-01-01" },
        { id: "new", contract_date: "2026-01-01" },
      ])[0]?.id,
    ).toBe("new");
    expect(
      sortAwardsByLatest([
        { id: "old", award_date: "2025-01-01" },
        { id: "new", opening_at: "2026-01-01" },
      ])[0]?.id,
    ).toBe("new");
  });

  it("uses the first-ranked participant as the primary award when available", () => {
    const award = selectPrimaryAward(
      [
        { id: "later", company_number: "222", award_date: "2026-02-01" },
        { id: "winner", company_number: "111", award_date: "2026-01-01" },
      ],
      [{ id: "rank-one", company_number: "111", rank: 1 }],
    );

    expect(award?.id).toBe("winner");
  });
});
