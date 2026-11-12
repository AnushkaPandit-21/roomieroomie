export function formatRupees(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}
