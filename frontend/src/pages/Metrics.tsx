import { ByTypeChartSection } from '@/metrics/ByTypeChartSection';
import { HeatmapSection } from '@/metrics/HeatmapSection';
import { SummaryCards } from '@/metrics/SummaryCards';
import { ExportSection } from '@/export/ExportSection';

export function Metrics() {
  return (
    <div className="space-y-6 p-4">
      <ExportSection />
      <SummaryCards />
      <ByTypeChartSection />
      <HeatmapSection />
    </div>
  );
}
