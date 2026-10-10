export const procurementChartSeries = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"] as const;

export const procurementWorkTypeColor: Record<string, string> = {
  goods: "bg-chart-1",
  service: "bg-chart-2",
  construction: "bg-chart-3",
  foreign: "bg-chart-4",
  other: "bg-chart-4",
  unknown: "bg-chart-5",
};

export const procurementDistributionColor = {
  leading: "bg-chart-1",
  middle: "bg-chart-2",
  remainder: "bg-chart-5",
} as const;
