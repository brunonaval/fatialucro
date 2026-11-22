export interface Evidence {
  id: string;
  reference: string;
  urls: readonly string[];
  capturedAt: string | null;
  verification: 'documented' | 'custom' | 'historical' | 'undetermined';
}

export interface Pending {
  id: string;
  message: string;
}

export type SimpleFormula =
  | { kind: 'fixed'; amount: string }
  | { kind: 'percentage'; rate: string; cap?: string };

export type Formula = SimpleFormula | {
  kind: 'tiered';
  // Half-open unit-price bands. Gaps are allowed and generate a pending charge.
  bands: readonly { from: string; to: string | null; formula: SimpleFormula }[];
};

export interface Condition {
  key: string;
  equals: string | boolean;
}

export interface FeeRule {
  id: string;
  name: string;
  version: string;
  formula: Formula | null;
  base: 'gross-sales' | 'after-seller-discount';
  scope: 'item' | 'order';
  requirement: 'mandatory' | 'optional' | 'conditional';
  conditions: readonly Condition[];
  includes: readonly string[];
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  evidence: Evidence;
}

export interface TariffCatalog {
  marketplace: string;
  version: string;
  purpose: 'simulation' | 'historical';
  // This bounds the engine's permission to use the snapshot, not legal validity.
  simulationFrom: string;
  simulationUntil: string;
  rules: readonly FeeRule[];
  pending: readonly Pending[];
}

export interface ManufacturingInput {
  grams: string;
  filamentPerKg: string;
  printHours: string;
  machine: { mode: 'all-in'; perHour: string } | {
    mode: 'detailed'; watts: string; energyPerKwh: string; maintenancePerHour: string; depreciationPerHour: string;
  };
  laborMinutes: string;
  laborPerHour: string;
  consumablesPerUnit: string;
  failureReservePerUnit: string;
}

export interface CostLine {
  id: string;
  name: string;
  formula: string;
  rawPerUnit: string;
  perUnit: string;
  quantity: number;
  total: string;
}

export interface SaleInput {
  date: string;
  purpose: 'simulation' | 'historical';
  unitPrice: string;
  quantity: number;
  manufacturing: ManufacturingInput;
  packagingPerUnit: string;
  packagingPerOrder: string;
  sellerDiscount: string;
  sellerShipping: string;
  otherOperatingCosts: string;
  selections: Readonly<Record<string, boolean>>;
  facts: Readonly<Record<string, string | boolean>>;
}

export interface FeeAssessment {
  base: string;
  count: number;
  rawAmount: string;
  roundedPerOccurrence: string;
  total: string;
}

export interface FeeLine {
  rule: FeeRule;
  resolvedFormula: SimpleFormula;
  assessments: FeeAssessment[];
  amount: string;
}

export interface PricingResult {
  status: 'complete' | 'partial';
  catalog: { marketplace: string; version: string; purpose: 'simulation' | 'historical' };
  rounding: 'HALF_UP_PER_OCCURRENCE';
  grossSales: string;
  sellerDiscount: string;
  salesAfterDiscount: string;
  manufacturing: { lines: CostLine[]; perUnit: string; total: string };
  packaging: string;
  operatingCosts: string;
  sellerShipping: string;
  otherOperatingCosts: string;
  fees: FeeLine[];
  excluded: { id: string; reason: string }[];
  knownMarketplaceFees: string;
  pending: Pending[];
  warnings: string[];
  marketplaceNet: string | null;
  operatingProfit: string | null;
  // Profit / sales after seller-funded discount. Rates are decimal ratios.
  margin: string | null;
  // Profit / (manufacturing + packaging + other operating costs).
  markup: string | null;
}
