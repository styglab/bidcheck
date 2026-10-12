export function formatKoreanDate(
  value: string | undefined,
  options: Intl.DateTimeFormatOptions,
  empty: string,
) {
  if (!value) return empty;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return empty;
  return new Intl.DateTimeFormat("ko-KR", { ...options, timeZone: "Asia/Seoul" }).format(date);
}
