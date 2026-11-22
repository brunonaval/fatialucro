import type { FeeRule, SaleInput, TariffCatalog } from '../src/engine';

export function sale(overrides: Partial<SaleInput> = {}): SaleInput {
  return { date: '2026-11-22', purpose: 'simulation', unitPrice: '25.00', quantity: 1,
    manufacturing: { grams: '0', filamentPerKg: '0', printHours: '0', machine: { mode: 'all-in', perHour: '0' },
      laborMinutes: '0', laborPerHour: '0', consumablesPerUnit: '0', failureReservePerUnit: '0' },
    packagingPerUnit: '0', packagingPerOrder: '0', sellerDiscount: '0', sellerShipping: '0', otherOperatingCosts: '0',
    selections: {}, facts: {}, ...overrides };
}

export function rule(overrides: Partial<FeeRule> = {}): FeeRule {
  return { id: 'commission', name: 'Taxa sintética para testes', version: '1', formula: { kind: 'percentage', rate: '20' },
    base: 'gross-sales', scope: 'item', requirement: 'mandatory', conditions: [], includes: [],
    effectiveFrom: '2026-11-01', effectiveUntil: '2026-11-30',
    evidence: { id: 'test', reference: 'Cenário sintético; não é tarifa de marketplace.', urls: [], capturedAt: null, verification: 'custom' }, ...overrides };
}

export function catalog(rules: readonly FeeRule[] = []): TariffCatalog {
  return { marketplace: 'synthetic-test', version: '1', purpose: 'simulation', simulationFrom: '2026-11-01', simulationUntil: '2026-11-30', rules, pending: [] };
}
