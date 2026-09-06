// Current financial year range from an "MM-DD" start (e.g. "04-01" = Apr 1).
// Returns ISO date bounds [start, end) and a label like "FY 2025–26".
export function financialYear(fyStart: string, ref: Date = new Date()) {
  const [mm, dd] = fyStart.split("-").map(Number);
  const y = ref.getFullYear();
  const startThisYear = new Date(y, (mm || 4) - 1, dd || 1);
  const startYear = ref >= startThisYear ? y : y - 1;
  const start = new Date(startYear, (mm || 4) - 1, dd || 1);
  const end = new Date(startYear + 1, (mm || 4) - 1, dd || 1); // exclusive
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    start: iso(start),
    end: iso(end),
    label: `FY ${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`,
  };
}

// Indian-style formatting helpers (₹1,25,000 grouping via en-IN locale).

export function formatINR(amount: number, withPaise = false): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: withPaise ? 2 : 0,
  }).format(amount);
}

export function formatNumberIN(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Service pricing units → the suffix shown after a price (e.g. ₹6,000/day).
// Single source of truth for both display and the create <select>. Unknown or
// missing units fall back to no suffix so legacy/uncached rows never show a
// wrong "/mo". `scoped` shows no figure at all — the price is "Quoted".
export const SERVICE_UNIT_SUFFIX: Record<string, string> = {
  month: "/mo",
  "one-time": " one-time",
  day: "/day",
  "half-day": "/half-day",
  project: "/project",
  session: "/session",
  each: " each",
  page: "/page",
  set: "/set",
  email: "/email",
  "per-1000-words": "/1,000 words",
  minute: "/min",
  video: "/video",
  reel: "/reel",
  episode: "/episode",
  image: "/image",
  product: "/product",
  property: "/property",
  sku: "/SKU",
  scoped: "",
};

export const SERVICE_UNITS = Object.keys(SERVICE_UNIT_SUFFIX);

export function unitSuffix(unit?: string | null): string {
  return SERVICE_UNIT_SUFFIX[unit ?? "month"] ?? "";
}

// Compact ₹ for chart axes: ₹1.25L, ₹2Cr.
export function formatINRCompact(amount: number): string {
  if (Math.abs(amount) >= 1_00_00_000)
    return `₹${(amount / 1_00_00_000).toFixed(2).replace(/\.00$/, "")}Cr`;
  if (Math.abs(amount) >= 1_00_000)
    return `₹${(amount / 1_00_000).toFixed(2).replace(/\.00$/, "")}L`;
  if (Math.abs(amount) >= 1_000)
    return `₹${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${amount}`;
}
