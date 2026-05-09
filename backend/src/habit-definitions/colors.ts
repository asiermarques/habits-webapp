// Color palette for habit definitions.
// Red is reserved for negative habits (used by heatmaps to signal "less is better").
// Positive habits rotate through the palette below in order of creation.

export const POSITIVE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#a855f7', // purple
  '#f97316', // orange
  '#14b8a6', // teal
  '#ec4899', // pink
  '#6366f1', // indigo
  '#eab308', // yellow
];

export const NEGATIVE_COLOR = '#ef4444'; // red

export function pickColor(positive: boolean, existingPositiveCount: number): string {
  if (!positive) return NEGATIVE_COLOR;
  return POSITIVE_COLORS[existingPositiveCount % POSITIVE_COLORS.length];
}
