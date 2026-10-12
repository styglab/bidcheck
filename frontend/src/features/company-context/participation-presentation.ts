import type { CompanyParticipationMetrics } from "./api";

export function participationCollectionLabel(metrics?: CompanyParticipationMetrics) {
  if (metrics?.collection_status_label?.trim()) return metrics.collection_status_label;
  switch (metrics?.collection_status) {
    case "collecting":
      return "수집 중";
    case "complete":
      return "수집 완료";
    case "failed":
      return "수집 확인 필요";
    default:
      return "수집 상태 미확인";
  }
}

export function participationSuccessRate(metrics?: CompanyParticipationMetrics) {
  const rate = metrics?.observed_success_rate;
  return rate != null && Number.isFinite(rate) && rate >= 0 && rate <= 1
    ? `${(rate * 100).toFixed(1)}%`
    : undefined;
}
