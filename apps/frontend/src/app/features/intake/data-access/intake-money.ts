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
  const [whole, fraction = ''] = item.unitNet.split('.');
  const minorUnits =
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * BigInt(item.quantity);

  return `${minorUnits / 100n}.${String(minorUnits % 100n).padStart(2, '0')}`;
}

export function formatVatRate(value: string | null): string {
  if (!value || !/^(?:0|1)(?:\.\d{1,4})?$/.test(value)) return '—';

  const [whole, fraction = ''] = value.split('.');
  const basisPoints = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  if (basisPoints > 10000n) return '—';

  const decimals = String(basisPoints % 100n)
    .padStart(2, '0')
    .replace(/0+$/, '');

  return `${basisPoints / 100n}${decimals ? `.${decimals}` : ''}%`;
}
