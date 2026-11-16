export const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
export const cents = (value: number) => Math.round((Number(value) || 0) * 100);

export function formatMoney(value: number): string {
  return `LKR ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
}

export function quoteFigures(subtotal: number, discountPercent: number) {
  const price = round2(subtotal);
  const percent = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
  const discount = price > 0 ? round2((price * percent) / 100) : 0;
  const total = Math.max(0, round2(price - discount));
  return { subtotal: price, discount, discountPercent: percent, total };
}
