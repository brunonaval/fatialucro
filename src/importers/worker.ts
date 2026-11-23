import { importPrintFile } from './index';

self.onmessage = (event: MessageEvent<{ fileName: string; bytes: ArrayBuffer }>) => {
  try { self.postMessage({ result: importPrintFile(event.data.fileName, new Uint8Array(event.data.bytes)) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Falha ao importar o arquivo.' }); }
};
