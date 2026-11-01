import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearWorkerWhisper, urlWorkerDictado } from './useDictado';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

class WorkerFalso {
  constructor(
    public url: string | URL,
    public opciones?: WorkerOptions,
  ) {}
}

describe('worker del dictado', () => {
  it('se busca junto al código del microfrontend', () => {
    expect(urlWorkerDictado('http://localhost:4203/bootstrap-ABC123.js').href).toBe(
      'http://localhost:4203/whisper.worker.js',
    );
  });

  it('abierto en su propio origen se crea directo como módulo', () => {
    vi.stubGlobal('Worker', WorkerFalso);
    const worker = crearWorkerWhisper(new URL('http://localhost:4203/whisper.worker.js'), 'http://localhost:4203');
    expect(worker).toBeInstanceOf(WorkerFalso);
    expect(String((worker as unknown as WorkerFalso).url)).toBe('http://localhost:4203/whisper.worker.js');
    expect((worker as unknown as WorkerFalso).opciones).toEqual({ type: 'module' });
  });

  it('dentro del shell (otro origen) se crea un worker local que importa el del microfrontend', async () => {
    vi.stubGlobal('Worker', WorkerFalso);
    let puente: Blob | undefined;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => ((puente = b), 'blob:http://localhost:4200/1') }));

    const worker = crearWorkerWhisper(new URL('http://localhost:4203/whisper.worker.js'), 'http://localhost:4200');
    expect((worker as unknown as WorkerFalso).url).toBe('blob:http://localhost:4200/1');
    expect((worker as unknown as WorkerFalso).opciones).toEqual({ type: 'module' });
    expect(await puente?.text()).toBe('import "http://localhost:4203/whisper.worker.js";\n');
  });
});
