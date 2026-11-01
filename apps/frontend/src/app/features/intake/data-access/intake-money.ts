import type { DraftItem } from '../../../core/api/schema';

export function lineNet(item: DraftItem): string {
  if (
    !Number.isSafeInteger(item.quantity) ||
    !item.quantity ||
    item.quantity < 1 ||
    !item.unitNet ||
    !/^\d+(?:\.\d{1,2})?$/.test(item.unitNet)
  ) {
    return '—';
  }
  const [whole = '0', fraction = ''] = item.unitNet.split('.');
  const minorUnits =
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * BigInt(item.quantity);

  return `${minorUnits / 100n}.${String(minorUnits % 100n).padStart(2, '0')}`;
}

export function formatVatRate(value: string | null): string {
  if (!value || !/^(?:0|1)(?:\.\d{1,4})?$/.test(value)) return '—';

  const [whole = '0', fraction = ''] = value.split('.');
  const basisPoints = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  if (basisPoints > 10000n) return '—';

  const decimals = String(basisPoints % 100n)
    .padStart(2, '0')
    .replace(/0+$/, '');

  return `${basisPoints / 100n}${decimals ? `.${decimals}` : ''}%`;
}

export function canonicalAmount(value: string | null): string | null {
  if (value === null || !value.trim()) return null;
  const trimmed = value.trim();
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(trimmed))
    throw new Error('Enter amounts with at most two decimal places.');
  const [whole = '0', fraction = ''] = trimmed.split('.');

  return `${whole}.${fraction.padEnd(2, '0')}`;
}
