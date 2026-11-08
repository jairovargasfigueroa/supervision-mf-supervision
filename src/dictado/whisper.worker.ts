import { env, pipeline, type ProgressInfo } from '@huggingface/transformers';

// Worker del dictado (302, diseño «Flujo»): carga Whisper una sola vez y transcribe en español el audio que le
// manda la pantalla (Float32Array mono de 16 kHz). Se compila aparte en build.mjs (dist/whisper.worker.js) con
// transformers.js dentro, así la pantalla no se congela mientras se descarga el modelo o se transcribe.
// El audio llega solo en memoria; de aquí sale únicamente el texto.

/** Modelo por defecto (decisión del equipo): multilingüe, pesos cuantizados `q8` (≈ 77 MB). */
export const MODELO_POR_DEFECTO = 'onnx-community/whisper-base';

/** Mensajes que recibe el worker. */
export type MensajeAlWorker = { tipo: 'cargar' } | { tipo: 'transcribir'; id: number; audio: Float32Array };

/** Mensajes que manda el worker. */
export type MensajeDelWorker =
  | { tipo: 'progreso'; porcentaje: number }
  | { tipo: 'listo'; dispositivo: Dispositivo }
  | { tipo: 'error-carga'; mensaje: string }
  | { tipo: 'texto'; id: number; texto: string }
  | { tipo: 'error-transcripcion'; id: number; mensaje: string };

export type Dispositivo = 'webgpu' | 'wasm';

type Transcriptor = (
  audio: Float32Array,
  opciones: Record<string, unknown>,
) => Promise<{ text: string } | { text: string }[]>;

// Variables de compilación (build.mjs): ruta propia de los modelos y modelo elegido.
const MODELO_URL = process.env.DICTADO_MODELO_URL ?? '';
const MODELO = process.env.DICTADO_MODELO || MODELO_POR_DEFECTO;

/** `"webgpu"` si el navegador tiene WebGPU y entrega un adaptador; si no, `"wasm"`. */
export async function elegirDispositivo(nav: { gpu?: { requestAdapter(): Promise<unknown> } } = navigator as never) {
  try {
    if (nav.gpu && (await nav.gpu.requestAdapter())) return 'webgpu' as const;
  } catch {
    // Sin adaptador: se usa WebAssembly
  }
  return 'wasm' as const;
}

/** Porcentaje entero de la descarga a partir de los avisos de transformers.js (`progress_total` suma todos los archivos). */
export function porcentajeDescarga(info: ProgressInfo): number | undefined {
  if (info.status !== 'progress_total') return undefined;
  return Math.max(0, Math.min(100, Math.floor(info.progress)));
}

/**
 * Texto de la salida de Whisper, sin espacios de más. Se quitan las anotaciones entre corchetes que Whisper pone
 * cuando no reconoce habla («[Música]», «[BLANK_AUDIO]»): así un audio sin voz queda vacío (criterio 9).
 */
export function textoTranscrito(salida: { text: string } | { text: string }[]): string {
  const partes = Array.isArray(salida) ? salida.map((s) => s.text) : [salida.text];
  return partes
    .join(' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let transcriptor: Promise<Transcriptor> | undefined;

function cargar(responder: (m: MensajeDelWorker) => void): Promise<Transcriptor> {
  transcriptor ??= (async () => {
    env.useBrowserCache = true;
    if (MODELO_URL) {
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = MODELO_URL;
    } else {
      env.allowRemoteModels = true;
    }
    const dispositivo = await elegirDispositivo();
    let ultimo = -1;
    const asr = await pipeline('automatic-speech-recognition', MODELO, {
      dtype: 'q8',
      device: dispositivo,
      progress_callback: (info: ProgressInfo) => {
        const porcentaje = porcentajeDescarga(info);
        if (porcentaje !== undefined && porcentaje !== ultimo) {
          ultimo = porcentaje;
          responder({ tipo: 'progreso', porcentaje });
        }
      },
    });
    responder({ tipo: 'listo', dispositivo });
    return asr as unknown as Transcriptor;
  })();
  // Si falla, el próximo «cargar» vuelve a intentar
  transcriptor.catch(() => (transcriptor = undefined));
  return transcriptor;
}

/** Atiende un mensaje de la pantalla. */
export async function manejarMensaje(mensaje: MensajeAlWorker, responder: (m: MensajeDelWorker) => void) {
  if (mensaje.tipo === 'cargar') {
    try {
      const yaCargado = transcriptor !== undefined;
      await cargar(responder);
      if (yaCargado) responder({ tipo: 'listo', dispositivo: await elegirDispositivo() });
    } catch (error) {
      responder({ tipo: 'error-carga', mensaje: String(error) });
    }
    return;
  }
  try {
    const asr = await cargar(responder);
    const salida = await asr(mensaje.audio, {
      language: 'spanish',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    responder({ tipo: 'texto', id: mensaje.id, texto: textoTranscrito(salida) });
  } catch (error) {
    responder({ tipo: 'error-transcripcion', id: mensaje.id, mensaje: String(error) });
  }
}

/** Solo en las pruebas: olvida el modelo cargado. */
export function reiniciarWorker() {
  transcriptor = undefined;
}

// Dentro de un worker de verdad (no en las pruebas) se escuchan los mensajes
declare const WorkerGlobalScope: { new (): unknown } | undefined;
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const ambito = self as unknown as {
    postMessage(m: MensajeDelWorker): void;
    addEventListener(tipo: 'message', f: (e: MessageEvent<MensajeAlWorker>) => void): void;
  };
  ambito.addEventListener('message', (evento) => void manejarMensaje(evento.data, (m) => ambito.postMessage(m)));
}
