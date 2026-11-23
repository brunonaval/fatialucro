import type { TariffCatalog } from '../engine';

/** An explicitly fee-free direct sale. Never a fallback for an unknown marketplace. */
export function directSaleCatalog(): TariffCatalog {
  return { marketplace: 'direct-sale-explicit', version: 'direct-v1', purpose: 'simulation',
    simulationFrom: '2000-01-01', simulationUntil: '2099-12-31', rules: [], pending: [] };
}
