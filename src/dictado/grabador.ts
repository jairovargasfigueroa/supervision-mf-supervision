// Grabación del micrófono y conversión del audio al formato de Whisper (302, diseño «Flujo»):
// MediaRecorder (webm/opus) → Blob → AudioContext de 16 kHz → Float32Array mono. El audio vive solo en memoria:
// no se guarda en el navegador ni se envía.

/** Frecuencia que espera Whisper. */
export const FRECUENCIA_WHISPER = 16000;

/** Por qué no se pudo empezar a grabar. */
export type FalloGrabacion = 'SIN_PERMISO' | 'SIN_MICROFONO';

export class ErrorGrabacion extends Error {
  constructor(public readonly motivo: FalloGrabacion) {
    super(motivo);
    this.name = 'ErrorGrabacion';
  }
}

export interface Grabacion {
  /** Detiene la grabación, suelta el micrófono y entrega el audio. */
  detener(): Promise<Blob>;
  /** Detiene sin entregar nada (al salir de la pantalla). */
  cancelar(): void;
}

const TIPOS_PREFERIDOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

function tipoAudio(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return TIPOS_PREFERIDOS.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Pide el micrófono (el navegador pregunta solo la primera vez) y empieza a grabar. */
export async function iniciarGrabacion(): Promise<Grabacion> {
  let flujo: MediaStream;
  try {
    flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    const nombre = (error as { name?: string } | null)?.name;
    if (nombre === 'NotAllowedError' || nombre === 'SecurityError') throw new ErrorGrabacion('SIN_PERMISO');
    throw new ErrorGrabacion('SIN_MICROFONO');
  }

  const tipo = tipoAudio();
  const grabador = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined);
  const partes: Blob[] = [];
  grabador.addEventListener('dataavailable', (e) => {
    if (e.data.size > 0) partes.push(e.data);
  });
  const soltar = () => flujo.getTracks().forEach((pista) => pista.stop());
  grabador.start();

  return {
    detener: () =>
      new Promise<Blob>((resolver) => {
        grabador.addEventListener(
          'stop',
          () => {
            soltar();
            resolver(new Blob(partes, { type: grabador.mimeType || tipo || 'audio/webm' }));
          },
          { once: true },
        );
        if (grabador.state === 'inactive') {
          soltar();
          resolver(new Blob(partes, { type: tipo ?? 'audio/webm' }));
        } else {
          grabador.stop();
        }
      }),
    cancelar: () => {
      if (grabador.state !== 'inactive') grabador.stop();
      soltar();
    },
  };
}

/** Promedio de los canales (estéreo → mono). */
export function mezclarMono(canales: Float32Array[]): Float32Array {
  if (canales.length === 1) return canales[0];
  const largo = Math.min(...canales.map((c) => c.length));
  const mono = new Float32Array(largo);
  for (const canal of canales) {
    for (let i = 0; i < largo; i++) mono[i] += canal[i] / canales.length;
  }
  return mono;
}

/** Remuestreo lineal, por si el navegador decodificó a otra frecuencia que la pedida. */
export function remuestrear(datos: Float32Array, origen: number, destino: number = FRECUENCIA_WHISPER): Float32Array {
  if (origen === destino) return datos;
  const largo = Math.round((datos.length * destino) / origen);
  const salida = new Float32Array(largo);
  const paso = origen / destino;
  for (let i = 0; i < largo; i++) {
    const posicion = i * paso;
    const izquierda = Math.floor(posicion);
    const derecha = Math.min(izquierda + 1, datos.length - 1);
    const fraccion = posicion - izquierda;
    salida[i] = datos[izquierda] * (1 - fraccion) + datos[derecha] * fraccion;
  }
  return salida;
}

/** Decodifica la grabación a un Float32Array mono de 16 kHz. */
export async function aMono16k(audio: Blob): Promise<Float32Array> {
  const contexto = new AudioContext({ sampleRate: FRECUENCIA_WHISPER });
  try {
    const buffer = await contexto.decodeAudioData(await audio.arrayBuffer());
    const canales = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return remuestrear(mezclarMono(canales), buffer.sampleRate);
  } finally {
    void contexto.close().catch(() => undefined);
  }
}

/** Segundos de un audio de 16 kHz. */
export function duracionSegundos(audio: Float32Array): number {
  return audio.length / FRECUENCIA_WHISPER;
}
