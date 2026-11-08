import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aMono16k,
  duracionSegundos,
  ErrorGrabacion,
  FRECUENCIA_WHISPER,
  iniciarGrabacion,
  mezclarMono,
  remuestrear,
} from './grabador';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** AudioContext de prueba: «decodifica» a un buffer estéreo del largo y la frecuencia dados. */
function contextoFalso(canales: Float32Array[], frecuencia: number) {
  const creados: { sampleRate?: number; cerrado: boolean }[] = [];
  class AudioContextFalso {
    registro = { sampleRate: undefined as number | undefined, cerrado: false };
    constructor(opciones?: { sampleRate?: number }) {
      this.registro.sampleRate = opciones?.sampleRate;
      creados.push(this.registro);
    }
    decodeAudioData = vi.fn(async () => ({
      numberOfChannels: canales.length,
      sampleRate: frecuencia,
      getChannelData: (i: number) => canales[i],
    }));
    close = vi.fn(async () => {
      this.registro.cerrado = true;
    });
  }
  vi.stubGlobal('AudioContext', AudioContextFalso);
  return creados;
}

const audioPrueba = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });

describe('grabador (302)', () => {
  it('convierte un audio corto estéreo de 16 kHz a mono de 16 kHz', async () => {
    const izquierdo = Float32Array.from({ length: 1600 }, () => 0.5);
    const derecho = Float32Array.from({ length: 1600 }, () => -0.1);
    const creados = contextoFalso([izquierdo, derecho], FRECUENCIA_WHISPER);

    const mono = await aMono16k(audioPrueba());

    expect(creados[0].sampleRate).toBe(16000);
    expect(mono).toHaveLength(1600);
    expect(mono[0]).toBeCloseTo(0.2);
    expect(duracionSegundos(mono)).toBeCloseTo(0.1);
    expect(creados[0].cerrado).toBe(true);
  });

  it('si el navegador decodificó a 48 kHz, remuestrea a 16 kHz', async () => {
    const canal = Float32Array.from({ length: 48000 }, (_, i) => i / 48000);
    contextoFalso([canal], 48000);

    const mono = await aMono16k(audioPrueba());

    expect(mono).toHaveLength(16000);
    expect(duracionSegundos(mono)).toBe(1);
    expect(mono[8000]).toBeCloseTo(0.5, 3);
  });

  it('mezcla los canales promediando y remuestrea de forma lineal', () => {
    expect(Array.from(mezclarMono([Float32Array.from([1, 0]), Float32Array.from([0, 1])]))).toEqual([0.5, 0.5]);
    expect(Array.from(remuestrear(Float32Array.from([0, 1, 2, 3]), 32000))).toEqual([0, 2]);
  });

  it('el permiso negado del micrófono se informa como SIN_PERMISO', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })) },
    });
    await expect(iniciarGrabacion()).rejects.toEqual(new ErrorGrabacion('SIN_PERMISO'));
  });

  it('sin micrófono se informa como SIN_MICROFONO', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotFoundError' })) },
    });
    await expect(iniciarGrabacion()).rejects.toMatchObject({ motivo: 'SIN_MICROFONO' });
  });

  it('graba con MediaRecorder y al detener entrega el audio y suelta el micrófono', async () => {
    const pista = { stop: vi.fn() };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [pista] }) } });
    class MediaRecorderFalso extends EventTarget {
      static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus';
      state: RecordingState = 'inactive';
      constructor(
        _flujo: unknown,
        public opciones?: { mimeType?: string },
      ) {
        super();
      }
      get mimeType() {
        return this.opciones?.mimeType ?? '';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        const evento = Object.assign(new Event('dataavailable'), { data: new Blob(['abc']) });
        this.dispatchEvent(evento);
        this.dispatchEvent(new Event('stop'));
      }
    }
    vi.stubGlobal('MediaRecorder', MediaRecorderFalso);

    const grabacion = await iniciarGrabacion();
    const audio = await grabacion.detener();

    expect(audio.type).toBe('audio/webm;codecs=opus');
    expect(audio.size).toBe(3);
    expect(pista.stop).toHaveBeenCalled();
  });
});
