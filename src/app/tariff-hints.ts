import { D, money } from '../engine/decimal';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
export function tariffHints(table: ShopeeTable, unitPrice: string): string[] {
  const price = money(unitPrice);
  return table.bands.slice(1).flatMap((band, index) => {
    const previous = table.bands[index]!;
    if (band.percent === previous.percent && band.fixed === previous.fixed || price.minus(band.from).abs().gt(1)) return [];
    const unresolved = table.boundaryReview.find(item => new D(item.price).eq(band.from) && item.status === 'unresolved');
    return [`Preço próximo de uma mudança entre faixas documentadas em R$ ${band.from.replace('.', ',')}. ${unresolved ? 'O valor exatamente nessa fronteira continua pendente.' : 'Cada preço da comparação usa sua própria faixa.'} Nenhuma mudança de demanda ou preço de concorrentes foi presumida.`];
  });
}
