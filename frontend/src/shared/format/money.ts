const unit = (value: string, label: string) => `${value}\u00a0${label}`;

export function formatCompactMoney(value?: number) {
  if (value == null) return "금액 미상";
  if (value === 0) return unit("0", "원");
  if (Math.abs(value) >= 1_000_000_000) return unit((value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 0 }), "억원");
  if (Math.abs(value) >= 100_000_000) return unit((value / 100_000_000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), "억원");
  if (Math.abs(value) >= 10_000) return unit((value / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 }), "만원");
  return unit(value.toLocaleString("ko-KR"), "원");
}

export function formatExactMoney(value?: number, empty = "금액 미상") {
  return value == null ? empty : unit(value.toLocaleString("ko-KR"), "원");
}
