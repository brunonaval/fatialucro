import { describe, expect, it } from 'vitest';
import { checkPublishedRelease, compareStableVersions } from '../src/app/app-updates';

const release = (tag_name: string, options: Record<string, unknown> = {}) => ({
  tag_name,
  html_url: `https://github.com/brunonaval/fatialucro/releases/tag/${tag_name}`,
  draft: false,
  prerelease: false,
  ...options,
});
const mock = (value: unknown, status = 200): typeof fetch =>
  (async () => new Response(status === 404 ? '' : JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

describe('Consulta manual de versões — sem executar instaladores desconhecidos', () => {
  it('compara números em vez de ordenar versões alfabeticamente', () => {
    expect(compareStableVersions('0.1.10', '0.1.9')).toBe(1);
    expect(compareStableVersions('v0.1.1', '0.1.1')).toBe(0);
    expect(compareStableVersions('0.1.0', '0.1.1')).toBe(-1);
    expect(compareStableVersions('0.1.1-preview', '0.1.0')).toBeNull();
    expect(compareStableVersions('1.2', '1.2.0')).toBeNull();
  });
  it('uma release inexistente ou igual não pede reinstalação', async () => {
    await expect(checkPublishedRelease('0.1.1', mock(null, 404))).resolves.toEqual({ status: 'not-published', installed: '0.1.1' });
    await expect(checkPublishedRelease('0.1.1', mock(release('v0.1.1')))).resolves.toEqual({ status: 'current', installed: '0.1.1' });
  });
  it('mostra uma página oficial somente quando há nova versão estável', async () => {
    await expect(checkPublishedRelease('0.1.1', mock(release('v0.1.2')))).resolves.toEqual({
      status: 'available', installed: '0.1.1',
      release: { version: '0.1.2', page: 'https://github.com/brunonaval/fatialucro/releases/tag/v0.1.2' },
    });
  });
  it('recusa URLs externas, pré-releases e códigos de resposta não autorizados', async () => {
    await expect(checkPublishedRelease('0.1.1', mock(release('v0.1.2', { html_url: 'https://example.net/installer.exe' })))).rejects.toThrow('critérios');
    await expect(checkPublishedRelease('0.1.1', mock(release('v0.1.2', { prerelease: true })))).rejects.toThrow('critérios');
    await expect(checkPublishedRelease('0.1.1', mock(null, 403))).rejects.toThrow('Não foi possível');
  });
});
