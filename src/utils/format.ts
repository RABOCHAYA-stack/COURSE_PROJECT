export function formatRub(amount: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amount))} ₽`;
}

export function formatDateRu(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getStockState(stock: number, minStock: number): {
  label: string;
  tone: 'ok' | 'low' | 'out';
} {
  if (stock <= 0) {
    return { label: 'Нет в наличии', tone: 'out' };
  }
  if (stock <= minStock) {
    return { label: 'Мало на складе', tone: 'low' };
  }
  return { label: 'В наличии', tone: 'ok' };
}
