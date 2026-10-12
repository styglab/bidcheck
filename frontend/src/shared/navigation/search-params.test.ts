import { describe, expect, it } from "vitest";
import { integerParam, yearRange } from "./search-params";

describe("URL 조회 범위", () => {
  it.each(["abc", "NaN", "Infinity", "1.5", "-1", "", "9007199254740992"])(
    "잘못된 페이지 %s를 기본값으로 처리한다",
    (value) => {
      expect(integerParam(value, 1)).toBe(1);
    },
  );
  it("연도 범위를 현재 연도까지의 정수로 제한한다", () => {
    expect(yearRange(new URLSearchParams("fromYear=abc&toYear=Infinity"), 2026)).toEqual({
      from: 2022,
      to: 2026,
    });
    expect(yearRange(new URLSearchParams("fromYear=2025&toYear=2023"), 2026)).toEqual({
      from: 2025,
      to: 2025,
    });
    expect(yearRange(new URLSearchParams("fromYear=2027&toYear=2024.5"), 2026)).toEqual({
      from: 2022,
      to: 2026,
    });
  });
});
