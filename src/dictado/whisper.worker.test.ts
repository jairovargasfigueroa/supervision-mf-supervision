import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MensajeDelWorker } from './whisper.worker';

// La librería y el modelo se simulan: las pruebas nunca descargan Whisper.
const libreria = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  pipeline: vi.fn(),
}));
vi.mock('@huggingface/transformers', () => libreria);

const { elegirDispositivo, manejarMensaje, porcentajeDescarga, reiniciarWorker, textoTranscrito } = await import(
  './whisper.worker'
);

beforeEach(() => {
  reiniciarWorker();
  libreria.pipeline.mockReset();
});

function recolector() {
  const mensajes: MensajeDelWorker[] = [];
  return { mensajes, responder: (m: MensajeDelWorker) => mensajes.push(m) };
}

describe('whisper.worker (302)', () => {
  it('carga Whisper base q8 una sola vez e informa el avance de la descarga', async () => {
    const asr = vi.fn().mockResolvedValue({ text: ' Vaciado de losa del tercer piso. ' });
    libreria.pipeline.mockImplementation(async (_tarea, _modelo, opciones) => {
      opciones.progress_callback({ status: 'progress', file: 'a', progress: 10, loaded: 1, total: 10 });
      opciones.progress_callback({ status: 'progress_total', progress: 45.6, loaded: 45, total: 100, files: {} });
      opciones.progress_callback({ status: 'progress_total', progress: 100, loaded: 100, total: 100, files: {} });
      return asr;
    });
    const { mensajes, responder } = recolector();

    await manejarMensaje({ tipo: 'cargar' }, responder);
    await manejarMensaje({ tipo: 'transcribir', id: 1, audio: new Float32Array(16000) }, responder);

    expect(libreria.pipeline).toHaveBeenCalledTimes(1);
    expect(libreria.pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'onnx-community/whisper-base',
      expect.objectContaining({ dtype: 'q8', device: 'wasm' }),
    );
    expect(libreria.env.useBrowserCache).toBe(true);
    expect(asr).toHaveBeenCalledWith(expect.any(Float32Array), {
      language: 'spanish',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    expect(mensajes).toEqual([
      { tipo: 'progreso', porcentaje: 45 },
      { tipo: 'progreso', porcentaje: 100 },
      { tipo: 'listo', dispositivo: 'wasm' },
      { tipo: 'texto', id: 1, texto: 'Vaciado de losa del tercer piso.' },
    ]);
  });

  it('si el modelo no se puede descargar avisa el error y deja reintentar', async () => {
    libreria.pipeline.mockRejectedValueOnce(new Error('Failed to fetch'));
    const { mensajes, responder } = recolector();

    await manejarMensaje({ tipo: 'cargar' }, responder);
    expect(mensajes).toEqual([{ tipo: 'error-carga', mensaje: 'Error: Failed to fetch' }]);

    libreria.pipeline.mockResolvedValueOnce(vi.fn());
    await manejarMensaje({ tipo: 'cargar' }, responder);
    expect(libreria.pipeline).toHaveBeenCalledTimes(2);
    expect(mensajes.at(-1)).toEqual({ tipo: 'listo', dispositivo: 'wasm' });
  });

  it('un fallo al transcribir responde con el id del pedido', async () => {
    libreria.pipeline.mockResolvedValue(vi.fn().mockRejectedValue(new Error('memoria')));
    const { mensajes, responder } = recolector();
    await manejarMensaje({ tipo: 'transcribir', id: 7, audio: new Float32Array(10) }, responder);
    expect(mensajes.at(-1)).toEqual({ tipo: 'error-transcripcion', id: 7, mensaje: 'Error: memoria' });
  });

  it('usa WebGPU si el navegador entrega un adaptador; si no, WebAssembly', async () => {
    expect(await elegirDispositivo({ gpu: { requestAdapter: async () => ({}) } })).toBe('webgpu');
    expect(await elegirDispositivo({ gpu: { requestAdapter: async () => null } })).toBe('wasm');
    expect(await elegirDispositivo({})).toBe('wasm');
  });

  it('arma el texto y el porcentaje', () => {
    expect(textoTranscrito([{ text: ' faltan doce ' }, { text: 'bolsas de cemento ' }])).toBe(
      'faltan doce bolsas de cemento',
    );
    expect(porcentajeDescarga({ status: 'done', name: 'm', file: 'f' })).toBeUndefined();
  });
});
