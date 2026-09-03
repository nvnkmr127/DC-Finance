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
