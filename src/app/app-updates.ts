export const UPDATE_RELEASES_URL = 'https://github.com/brunonaval/fatialucro/releases';
const API_URL = 'https://api.github.com/repos/brunonaval/fatialucro/releases/latest';

export interface PublishedRelease {
  version: string;
  page: string;
}
export type VersionCheck =
  | { status: 'current'; installed: string }
  | { status: 'available'; installed: string; release: PublishedRelease }
  | { status: 'not-published'; installed: string };

/** Strict numeric stable SemVer, no downgrades or arbitrary download links. */
function versionParts(value: string): [number, number, number] | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) return null;
  return [parts[0]!, parts[1]!, parts[2]!];
}
export function compareStableVersions(a: string, b: string): number | null {
  const left = versionParts(a);
  const right = versionParts(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    if (left[i]! > right[i]!) return 1;
    if (left[i]! < right[i]!) return -1;
  }
  return 0;
}

export async function checkPublishedRelease(installed: string, requester: typeof fetch = fetch): Promise<VersionCheck> {
  if (!versionParts(installed)) throw new Error('A versão instalada não é reconhecida.');
  const response = await requester(API_URL, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (response.status === 404) return { status: 'not-published', installed };
  if (!response.ok) throw new Error('Não foi possível consultar as versões no GitHub. Verifique sua conexão e tente novamente.');
  const release: unknown = await response.json();
  if (!release || typeof release !== 'object') throw new Error('O GitHub respondeu com dados incompletos.');
  const record = release as Record<string, unknown>;
  const tag = typeof record.tag_name === 'string' ? record.tag_name : '';
  const url = typeof record.html_url === 'string' ? record.html_url : '';
  if (record.draft || record.prerelease || !versionParts(tag) || !/^https:\/\/github\.com\/brunonaval\/fatialucro\/releases\/tag\/v?[0-9]+\.[0-9]+\.[0-9]+$/.test(url)) {
    throw new Error('A versão publicada não atende aos critérios de distribuição estável.');
  }
  const result = compareStableVersions(tag, installed);
  if (result === null) throw new Error('Não foi possível comparar as versões.');
  if (result <= 0) return { status: 'current', installed };
  return { status: 'available', installed, release: { version: tag.replace(/^v/, ''), page: url } };
}
