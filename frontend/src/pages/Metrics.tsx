import { ByTypeChartSection } from '@/metrics/ByTypeChartSection';
import { HeatmapSection } from '@/metrics/HeatmapSection';

export function Metrics() {
  return (
    <div className="space-y-6 p-4">
      <ByTypeChartSection />
      <HeatmapSection />
    </div>
  );
}
