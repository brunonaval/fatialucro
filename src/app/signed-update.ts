import type { Update } from '@tauri-apps/plugin-updater';

/**
 * Only bundles compiled by the signed release workflow have this enabled.
 * Development/QA builds cannot silently acquire installation permissions.
 */
export const SIGNED_UPDATER_ENABLED = import.meta.env.VITE_FATIALUCRO_SIGNED_UPDATER === 'true';

export type SignedUpdateInfo = { version: string; notes: string; update: Update };

export async function checkSignedUpdate(
  importer: () => Promise<typeof import('@tauri-apps/plugin-updater')> =
    () => import('@tauri-apps/plugin-updater'),
): Promise<SignedUpdateInfo | null> {
  const { check } = await importer();
  const update = await check({ timeout: 20000 });
  if (!update) return null;
  return { version: update.version, notes: update.body ?? '', update };
}

/** Windows' installer takes over the process and restarts the application. */
export async function installSignedUpdate(
  update: Update,
  progress: (percent: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall(event => {
    if (event.event === 'Started') {
      downloaded = 0;
      total = event.data.contentLength ?? 0;
      progress(total > 0 ? 0 : null);
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      progress(total > 0 ? Math.min(100, Math.floor(downloaded / total * 100)) : null);
    } else if (event.event === 'Finished') {
      progress(100);
    }
  }, { timeout: 120000 });
}
