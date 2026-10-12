export function integerParam(value: string | null, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (value == null || value.trim() === "") return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
}

export function yearRange(params: URLSearchParams, currentYear: number, earliestYear = 2022, years = 5) {
  const from = integerParam(
    params.get("fromYear"),
    Math.max(earliestYear, currentYear - years + 1),
    earliestYear,
    currentYear,
  );
  const to = Math.max(from, integerParam(params.get("toYear"), currentYear, earliestYear, currentYear));
  return { from, to };
}
