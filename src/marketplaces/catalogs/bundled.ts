import manifestText from '../../../public/catalogs/manifest.json?raw';
import tableText from '../../../public/catalogs/shopee-br/2026-11-22-r2.json?raw';
import archiveText from '../../../public/catalogs/shopee-br/2026-11-22-r1.json?raw';
import { parseManifest, parseTable, validateTables } from './validation';
import type { CatalogPackage } from './types';
export const bundledManifest = parseManifest(manifestText);
export const bundledTables = [parseTable(tableText), parseTable(archiveText)];
validateTables(bundledTables);
export const bundledPackage: CatalogPackage = { manifestText, tableTexts: { [bundledTables[0]!.id]: tableText, [bundledTables[1]!.id]: archiveText }, downloadedAt: '2026-11-22T00:00:00.000Z' };
