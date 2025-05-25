// src/utils/utils.js
export function formatCurrency(value) {
  const num = Number(value);
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}
