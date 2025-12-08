// Category color mapping - Soft Pastel Professional Theme (No Red/Green/Yellow)
export const CATEGORY_COLORS: Record<string, string> = {
  machine: "#4169E1",
  electrical: "#9B4DFF",
  hvac: "#0894C7",
  furniture: "#9B4DFF",
  cleaning: "#0277BD", // Changed from orange to deep blue
  transfer: "#00ACC1", // Changed from teal-green to pure cyan
  paint: "#C74AFF",
  "telephone & camera": "#4169E1",
  "water & air": "#0894C7",
  // Fallback colors
  plumbing: "#0894C7",
  other: "#00A38C",
  others: "#00A38C",
};

export const getCategoryColor = (categoryName: string): string => {
  const normalizedName = categoryName.toLowerCase().trim();
  return CATEGORY_COLORS[normalizedName] || "#7A6F88";
};

export const getCategoryColorWithAlpha = (categoryName: string, alpha: number = 0.1): string => {
  const color = getCategoryColor(categoryName);
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
