import { ByTypeChartSection } from '@/metrics/ByTypeChartSection';
import { HeatmapSection } from '@/metrics/HeatmapSection';
import { ExportSection } from '@/export/ExportSection';

export function Metrics() {
  return (
    <div className="space-y-6 p-4">
      <ExportSection />
      <ByTypeChartSection />
      <HeatmapSection />
    </div>
  );
}
