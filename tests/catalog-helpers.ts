import { bundledManifest, bundledPackage, bundledTables } from '../src/marketplaces/catalogs/bundled';
import { sha256 } from '../src/marketplaces/catalogs/update';
import type { CatalogPackage, ShopeeTable } from '../src/marketplaces/catalogs/types';

export function syntheticTable(revision = 3): ShopeeTable {
  return { ...structuredClone(bundledTables[0]!), id: `synthetic-r${revision}`, version: `synthetic-${revision}`, revision,
    confirmation: 'confirmed', observedAt: '2026-11-23', lastVerified: '2026-11-23', effectiveFrom: '2027-01-01', effectiveUntil: '2027-01-31',
    supersedes: [bundledTables[0]!.id], review: { status: 'reviewed', reference: 'Cenário sintético de teste; não é tarifa oficial.' },
    bands: [{ from: '0', includeFrom: true, to: null, includeTo: false, percent: '10', fixed: '1' }],
  };
}
export async function packageWith(tables: ShopeeTable[], releaseSequence = 2): Promise<CatalogPackage> {
  const tableTexts = { ...bundledPackage.tableTexts };
  const files = structuredClone(bundledManifest.files);
  for (const table of tables) {
    const text = JSON.stringify(table); const bytes = new TextEncoder().encode(text); tableTexts[table.id] = text;
    files.push({ id: table.id, version: table.version, revision: table.revision, path: `catalogs/shopee-br/synthetic-r${table.revision}.json`, sha256: await sha256(bytes), bytes: bytes.length });
  }
  return { manifestText: JSON.stringify({ ...bundledManifest, releaseSequence, publishedAt: '2026-11-23', files }), tableTexts, downloadedAt: '2026-11-23T12:00:00Z' };
}
