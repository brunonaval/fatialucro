export interface CatalogSource { id: string; url: string; htmlSha256: string; checkedAt: string }
export interface PriceBand { from: string; includeFrom: boolean; to: string | null; includeTo: boolean; percent: string; fixed: string }
export interface ShopeeTable {
  schemaVersion: 1; adapter: 'shopee-v1'; id: string; marketplace: 'shopee-br'; version: string; revision: number;
  effectiveFrom: string | null; effectiveUntil: string | null;
  confirmation: 'documentary' | 'confirmed' | 'withdrawn'; observedAt: string; lastVerified: string;
  review: { status: 'reviewed'; reference: string }; supersedes: string[]; sources: CatalogSource[];
  bands: PriceBand[];
  cnpjLow: { below: string; fixedPercent: string };
  cpf: { regressiveBelow: string; volumeThreshold: number; extra: string; thresholdInclusive: boolean | null; fixedConflict: boolean };
  programs: { returnsPerOrder: string; highlightPercent: string };
  boundaryReview: { price: string; status: 'confirmed' | 'unresolved'; note: string; sourceIds: string[] }[];
}
export interface CatalogManifest {
  schemaVersion: 1; releaseSequence: number; publishedAt: string;
  review: { status: 'reviewed'; reference: string };
  files: { id: string; version: string; revision: number; path: string; sha256: string; bytes: number }[];
}
export interface CatalogPackage { manifestText: string; tableTexts: Record<string, string>; downloadedAt: string }
export interface ValidatedPackage { manifest: CatalogManifest; tables: ShopeeTable[]; package: CatalogPackage }
