import { ByTypeChartSection } from '@/metrics/ByTypeChartSection';
import { HeatmapSection } from '@/metrics/HeatmapSection';
import { SummaryCards } from '@/metrics/SummaryCards';
import { ExportSection } from '@/export/ExportSection';

export function Metrics() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 py-8 rise">
      <header className="space-y-3">
        <p className="eyebrow">the long view</p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          Metrics<span className="text-moss">.</span>
        </h1>
        <p className="max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
          Patterns emerge slowly. Read them without judgement.
        </p>
      </header>
      <ExportSection />
      <SummaryCards />
      <ByTypeChartSection />
      <HeatmapSection />
    </div>
  );
}
