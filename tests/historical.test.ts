import { describe, expect, it } from 'vitest';
import { calculatePricing, reconcileFees } from '../src/engine';
import { D } from '../src/engine/decimal';
import type { FeeRule, TariffCatalog } from '../src/engine';
import fixtures from './fixtures/historical-june-2026.json';
import { rule, sale } from './helpers';

// Only test scenarios, never exported in the production Shopee adapter.
// The 3.5% is unnamed: the audit does not establish which service generated it.
function historicalRule(overrides: Partial<FeeRule>): FeeRule {
  return rule({ effectiveFrom: null, effectiveUntil: null,
    evidence: { id: 'audit-june-fixtures', reference: fixtures.provenance, urls: [], capturedAt: '2026-11-22', verification: 'historical' }, ...overrides });
}
const historical: TariffCatalog = { marketplace: 'shopee-historical-fixture', version: 'june-audit-v04', purpose: 'historical',
  simulationFrom: '2026-06-01', simulationUntil: '2026-06-30', pending: [{ id: 'primary-statements', message: 'Extratos primários ausentes; somente reprodução matemática da auditoria.' }],
  rules: [historicalRule({ id: 'commission', scope: 'order' }), historicalRule({ id: 'fixed', formula: { kind: 'fixed', amount: '4' } }),
    historicalRule({ id: 'unidentified-3.5', scope: 'order', formula: { kind: 'percentage', rate: '3.5' } }),
    historicalRule({ id: 'returns', scope: 'order', formula: { kind: 'fixed', amount: '0.49' } })] };

describe('regressão histórica: cinco coincidências e uma divergência preservada', () => {
  it.each(fixtures.cases)('$id', fixture => {
    const result = calculatePricing(sale({ date: '2026-06-15', purpose: 'historical', unitPrice: fixture.unitPrice, quantity: fixture.quantity }), historical);
    expect(result.grossSales).toBe(fixture.orderGross);
    expect(result.knownMarketplaceFees).toBe(fixture.calculated);
    const comparison = reconcileFees(result.knownMarketplaceFees, fixture.observed);
    expect(comparison.difference).toBe(fixture.difference);
    expect(comparison.status).toBe(fixture.difference === '0.00' ? 'matched' : 'divergent');
    expect(result.marketplaceNet).toBeNull(); // Primary evidence and actual dates were not provided.
    if (fixture.id === 'june-25') expect(new D(result.grossSales).minus(result.knownMarketplaceFees).toFixed(2)).toBe('14.63');
    if (fixture.difference === '0.05') expect(comparison.explanation).toContain('não explicada');
  });
  it('nunca usa a composição de junho numa simulação de novembro', () => {
    const result = calculatePricing(sale(), historical);
    expect(result.fees).toHaveLength(0);
    expect(result.status).toBe('partial');
  });
});
