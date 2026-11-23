import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { Update } from '@tauri-apps/plugin-updater';
import { checkSignedUpdate, installSignedUpdate } from '../src/app/signed-update';
import { UpdatePanel } from '../src/ui/UpdatePanel';

describe('Atualizador assinado — versões do FatiaLucro', () => {
  it('pede metadados ao plugin oficial e só oferece versão mais nova', async () => {
    const release = { version: '0.2.1', body: 'Melhorias de preço' } as Update;
    const check = vi.fn().mockResolvedValue(release);
    const found = await checkSignedUpdate(async () =>
      ({ check })
    );
    expect(check).toHaveBeenCalledWith({ timeout: 20000 });
    expect(found?.version).toBe('0.2.1');
    expect(found?.notes).toBe('Melhorias de preço');
    expect(found?.update).toBe(release);
  });

  it('não instala nada quando não existe nova versão', async () => {
    const check = vi.fn().mockResolvedValue(null);
    const found = await checkSignedUpdate(async () =>
      ({ check })
    );
    expect(found).toBeNull();
  });

  it('download, integridade e instalação são delegados ao plugin, com progresso', async () => {
    const progress = vi.fn();
    const downloadAndInstall = vi.fn(async (callback: (event: unknown) => void) => {
      callback({ event: 'Started', data: { contentLength: 100 } });
      callback({ event: 'Progress', data: { chunkLength: 12 } });
      callback({ event: 'Progress', data: { chunkLength: 88 } });
      callback({ event: 'Finished' });
    });
    await installSignedUpdate({ downloadAndInstall } as unknown as Update, progress);
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls.map(call => call[0])).toEqual([0, 12, 100, 100]);
  });

  it('o painel conserva verificação manual e explica a primeira instalação de transição', () => {
    const html = renderToStaticMarkup(<UpdatePanel beforeInstall={async () => {}} />);
    expect(html).toContain('Buscar atualizações');
    expect(html).toContain('Versão instalada:');
    expect(html).toContain('0.2.3');
    expect(html).toContain('Histórico de versões publicadas');
  });

  it('nenhuma chave privada ou URL de instalador não assinado entra no app', () => {
    const rust = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
    const release = readFileSync(new URL('../.github/workflows/publish-signed.yml', import.meta.url), 'utf8');
    expect(rust).toContain('feature = "signed-updater"');
    expect(release).toContain('TAURI_SIGNING_PRIVATE_KEY');
    expect(release).toContain('createUpdaterArtifacts');
    expect(release).toContain('requireSignedVersion');
    expect(release).toContain('updater:allow-download-and-install');
    expect(release).toContain('latest.json');
    expect(release).toContain('releaseDraft: false');
    expect(release).not.toContain('dangerousInsecureTransportProtocol');
    expect(release).not.toContain('shell:cmd');
  });
});
