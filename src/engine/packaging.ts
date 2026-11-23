import { cash, D, money, quantity } from './decimal';
import type { SaleInput } from './types';
export function calculatePackaging(input: Pick<SaleInput, 'quantity' | 'packagingPerUnit' | 'packagingPerOrder' | 'packagingPurchase'>): string {
  quantity(input.quantity);
  let total = money(input.packagingPerUnit).mul(input.quantity);
  if (input.packagingPurchase) {
    quantity(input.packagingPurchase.units);
    total = new D(cash(money(input.packagingPurchase.amount).mul(input.quantity).div(input.packagingPurchase.units)));
  }
  return cash(total.plus(money(input.packagingPerOrder)));
}
