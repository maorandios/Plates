/**
 * Static defaults for the Quote Insights UI. Live data still comes from
 * `PricingSummary` / `ManufacturingParameters`; these tune interaction only.
 */
export const INSIGHTS_MARGIN_MIN = 0;
export const INSIGHTS_MARGIN_MAX = 40;
export const INSIGHTS_SLIDER_STEP = 1;
/** X-axis resolution for the price-impact curve (0 … max by this step). */
export const INSIGHTS_CHART_MARGIN_STEP = 2;

/** Default margin % when `ManufacturingParameters.profitMarginPct` is invalid. */
export const INSIGHTS_DEFAULT_MARGIN_FALLBACK = 12;
