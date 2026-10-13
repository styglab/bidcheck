import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, TreemapChart } from "echarts/charts";
import { AriaComponent, GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([BarChart, TreemapChart, AriaComponent, GridComponent, TooltipComponent, SVGRenderer]);

export function CompanyAnalysisChart({
  option,
  label,
  onSelect,
  height = 320,
}: {
  option: EChartsCoreOption;
  label: string;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null);
  useEffect(() => {
    if (!element.current) return;
    const instance = echarts.init(element.current, undefined, { renderer: "svg" });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      chart.current = null;
      instance.dispose();
    };
  }, []);
  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
    chart.current?.resize();
  }, [option]);
  useEffect(() => {
    const instance = chart.current;
    if (!instance || !onSelect) return;
    const select = (params: unknown) => {
      const id = (params as { data?: { id?: string } }).data?.id;
      if (id) onSelect(id);
    };
    instance.on("click", select);
    return () => {
      instance.off("click", select);
    };
  }, [onSelect]);
  return <div ref={element} role="img" aria-label={label} style={{ height }} className="w-full min-w-0" />;
}
