import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ErrorGrabacion, type Grabacion } from './grabador';
import { dictadoSoportado } from './soporte';
import {
  crearMotorDictado,
  crearWorkerWhisper,
  urlWorkerDictado,
  useDictado,
  type DependenciasDictado,
  type MotorDictado,
} from './useDictado';
import type { MensajeAlWorker, MensajeDelWorker } from './whisper.worker';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Audio de 16 kHz de los segundos dados. */
const audio = (segundos: number) => new Float32Array(Math.round(segundos * 16000));

/** Motor simulado: el worker y el modelo nunca se cargan de verdad. */
function motorFalso(texto = 'faltan doce bolsas de cemento'): MotorDictado & {
  preparar: ReturnType<typeof vi.fn>;
  transcribir: ReturnType<typeof vi.fn>;
} {
  return {
    preparar: vi.fn(async (alAvance: (p: number) => void) => {
      alAvance(45);
      alAvance(100);
    }),
    transcribir: vi.fn(async () => texto),
  };
}

function grabacionFalsa() {
  const grabacion = { detener: vi.fn(async () => new Blob(['x'])), cancelar: vi.fn(() => undefined) };
  return grabacion satisfies Grabacion;
}

function dibujar(dependencias: Partial<DependenciasDictado>, maxSegundos?: number) {
  const alTexto = vi.fn();
  const hook = renderHook(() =>
    useDictado({
      alTexto,
      maxSegundos,
      dependencias: { soportado: () => true, convertir: async () => audio(3), ...dependencias },
    }),
  );
  return { ...hook, alTexto };
}

describe('useDictado (302)', () => {
  it('la primera vez prepara el modelo con su avance, luego graba y transcribe', async () => {
    const motor = motorFalso();
    const grabacion = grabacionFalsa();
    const avances: number[] = [];
    motor.preparar.mockImplementation(async (alAvance: (p: number) => void) => {
      alAvance(45);
      avances.push(45);
    });
    const { result, alTexto } = dibujar({ motor, grabar: async () => grabacion });
    expect(result.current.estado).toBe('INACTIVO');

    await act(async () => result.current.iniciar());
    expect(motor.preparar).toHaveBeenCalledTimes(1);
    expect(result.current.progreso).toBe(45);
    expect(result.current.estado).toBe('GRABANDO');

    await act(async () => result.current.detener());
    expect(grabacion.detener).toHaveBeenCalled();
    expect(motor.transcribir).toHaveBeenCalledWith(expect.any(Float32Array));
    expect(alTexto).toHaveBeenCalledWith('faltan doce bolsas de cemento');
    expect(result.current.estado).toBe('LISTO');
    expect(result.current.error).toBeUndefined();

    // La segunda vez no vuelve a preparar el modelo
    await act(async () => result.current.iniciar());
    expect(motor.preparar).toHaveBeenCalledTimes(1);
    expect(result.current.estado).toBe('GRABANDO');
  });

  it('muestra PREPARANDO mientras se descarga el modelo y TRANSCRIBIENDO mientras transcribe', async () => {
    let terminarCarga!: () => void;
    let terminarTexto!: (t: string) => void;
    const motor: MotorDictado = {
      preparar: () => new Promise<void>((r) => (terminarCarga = r)),
      transcribir: () => new Promise<string>((r) => (terminarTexto = r)),
    };
    const { result } = dibujar({ motor, grabar: async () => grabacionFalsa() });

    act(() => result.current.iniciar());
    expect(result.current.estado).toBe('PREPARANDO');
    await act(async () => terminarCarga());
    expect(result.current.estado).toBe('GRABANDO');

    act(() => result.current.detener());
    await act(async () => undefined);
    expect(result.current.estado).toBe('TRANSCRIBIENDO');
    await act(async () => terminarTexto('listo'));
    expect(result.current.estado).toBe('LISTO');
  });

  it('con el permiso del micrófono negado queda en ERROR con SIN_PERMISO y deja reintentar', async () => {
    const grabar = vi.fn().mockRejectedValueOnce(new ErrorGrabacion('SIN_PERMISO')).mockResolvedValue(grabacionFalsa());
    const { result } = dibujar({ motor: motorFalso(), grabar });

    await act(async () => result.current.iniciar());
    expect(result.current.estado).toBe('ERROR');
    expect(result.current.error).toBe('SIN_PERMISO');

    await act(async () => result.current.iniciar());
    expect(result.current.estado).toBe('GRABANDO');
    expect(result.current.error).toBeUndefined();
  });

  it('sin micrófono en el equipo queda NO_DISPONIBLE', async () => {
    const { result } = dibujar({
      motor: motorFalso(),
      grabar: vi.fn().mockRejectedValue(new ErrorGrabacion('SIN_MICROFONO')),
    });
    await act(async () => result.current.iniciar());
    expect(result.current.estado).toBe('NO_DISPONIBLE');
    expect(result.current.error).toBe('SIN_SOPORTE');
  });

  it('una grabación de menos de 1 segundo no se transcribe: NO_ENTENDIDO', async () => {
    const motor = motorFalso();
    const { result, alTexto } = dibujar({ motor, grabar: async () => grabacionFalsa(), convertir: async () => audio(0.6) });
    await act(async () => result.current.iniciar());
    await act(async () => result.current.detener());
    expect(motor.transcribir).not.toHaveBeenCalled();
    expect(alTexto).not.toHaveBeenCalled();
    expect(result.current.estado).toBe('ERROR');
    expect(result.current.error).toBe('NO_ENTENDIDO');
  });

  it('si Whisper no reconoce texto: NO_ENTENDIDO', async () => {
    const { result, alTexto } = dibujar({ motor: motorFalso('  '), grabar: async () => grabacionFalsa() });
    await act(async () => result.current.iniciar());
    await act(async () => result.current.detener());
    expect(alTexto).not.toHaveBeenCalled();
    expect(result.current.error).toBe('NO_ENTENDIDO');
  });

  it('si el modelo no se puede descargar queda NO_DISPONIBLE con MODELO y no graba', async () => {
    const motor = motorFalso();
    motor.preparar.mockRejectedValue(new Error('Failed to fetch'));
    const grabar = vi.fn();
    const { result } = dibujar({ motor, grabar });
    await act(async () => result.current.iniciar());
    expect(result.current.estado).toBe('NO_DISPONIBLE');
    expect(result.current.error).toBe('MODELO');
    expect(grabar).not.toHaveBeenCalled();

    await act(async () => result.current.iniciar());
    expect(motor.preparar).toHaveBeenCalledTimes(1);
  });

  it('sin soporte del navegador empieza NO_DISPONIBLE', () => {
    const { result } = dibujar({ motor: motorFalso(), soportado: () => false });
    expect(result.current.estado).toBe('NO_DISPONIBLE');
    expect(result.current.error).toBe('SIN_SOPORTE');
  });

  it('a los 60 segundos la grabación se detiene sola', async () => {
    vi.useFakeTimers();
    const motor = motorFalso();
    const grabacion = grabacionFalsa();
    const { result, alTexto } = dibujar({ motor, grabar: async () => grabacion });
    await act(async () => result.current.iniciar());
    expect(result.current.estado).toBe('GRABANDO');

    await act(async () => vi.advanceTimersByTime(12_000));
    expect(result.current.segundos).toBe(12);
    expect(grabacion.detener).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(48_000));
    expect(grabacion.detener).toHaveBeenCalledTimes(1);
    expect(alTexto).toHaveBeenCalledTimes(1);
    expect(result.current.estado).toBe('LISTO');
  });

  it('al desmontar suelta el micrófono', async () => {
    const grabacion = grabacionFalsa();
    const { result, unmount } = dibujar({ motor: motorFalso(), grabar: async () => grabacion });
    await act(async () => result.current.iniciar());
    unmount();
    expect(grabacion.cancelar).toHaveBeenCalled();
  });
});

/** Worker simulado que responde como whisper.worker.ts. */
class WorkerSimulado extends EventTarget {
  enviados: MensajeAlWorker[] = [];
  terminado = false;
  constructor(private responder: (m: MensajeAlWorker, w: WorkerSimulado) => void) {
    super();
  }
  postMessage(m: MensajeAlWorker) {
    this.enviados.push(m);
    queueMicrotask(() => this.responder(m, this));
  }
  emitir(m: MensajeDelWorker) {
    this.dispatchEvent(new MessageEvent('message', { data: m }));
  }
  terminate() {
    this.terminado = true;
  }
}

describe('crearMotorDictado (302)', () => {
  it('no crea el worker hasta preparar; prepara una sola vez y transcribe por id', async () => {
    const crear = vi.fn(
      () =>
        new WorkerSimulado((m, w) => {
          if (m.tipo === 'cargar') {
            w.emitir({ tipo: 'progreso', porcentaje: 45 });
            w.emitir({ tipo: 'listo', dispositivo: 'wasm' });
          } else w.emitir({ tipo: 'texto', id: m.id, texto: 'vaciado de losa' });
        }) as unknown as Worker,
    );
    const motor = crearMotorDictado(crear);
    expect(crear).not.toHaveBeenCalled();

    const avances: number[] = [];
    await Promise.all([motor.preparar((p) => avances.push(p)), motor.preparar(() => undefined)]);
    expect(crear).toHaveBeenCalledTimes(1);
    expect(avances).toEqual([45]);
    expect(await motor.transcribir(audio(2))).toBe('vaciado de losa');
  });

  it('si el modelo no carga rechaza la preparación', async () => {
    const motor = crearMotorDictado(
      () => new WorkerSimulado((_m, w) => w.emitir({ tipo: 'error-carga', mensaje: 'x' })) as unknown as Worker,
    );
    await expect(motor.preparar(() => undefined)).rejects.toThrow('x');
  });

  it('si el archivo del worker no carga rechaza la preparación', async () => {
    const motor = crearMotorDictado(
      () => new WorkerSimulado((_m, w) => w.dispatchEvent(new Event('error'))) as unknown as Worker,
    );
    await expect(motor.preparar(() => undefined)).rejects.toThrow('No se pudo cargar el worker del dictado');
  });
});

class WorkerFalso {
  constructor(
    public url: string | URL,
    public opciones?: WorkerOptions,
  ) {}
}

describe('worker del dictado dentro del shell', () => {
  it('se busca junto al código del microfrontend', () => {
    expect(urlWorkerDictado('http://localhost:4203/bootstrap-ABC123.js').href).toBe(
      'http://localhost:4203/whisper.worker.js',
    );
  });

  it('abierto en su propio origen se crea directo como módulo', () => {
    vi.stubGlobal('Worker', WorkerFalso);
    const worker = crearWorkerWhisper(new URL('http://localhost:4203/whisper.worker.js'), 'http://localhost:4203');
    expect(String((worker as unknown as WorkerFalso).url)).toBe('http://localhost:4203/whisper.worker.js');
    expect((worker as unknown as WorkerFalso).opciones).toEqual({ type: 'module' });
  });

  it('dentro del shell (otro origen) se crea un worker local que importa el del microfrontend', async () => {
    vi.stubGlobal('Worker', WorkerFalso);
    let puente: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => ((puente = b as Blob), 'blob:http://localhost:4200/1'));

    const worker = crearWorkerWhisper(new URL('http://localhost:4203/whisper.worker.js'), 'http://localhost:4200');
    expect((worker as unknown as WorkerFalso).url).toBe('blob:http://localhost:4200/1');
    expect((worker as unknown as WorkerFalso).opciones).toEqual({ type: 'module' });
    expect(await puente?.text()).toBe('import "http://localhost:4203/whisper.worker.js";\n');
  });
});

describe('soporte del navegador (302, criterio 8)', () => {
  const completo = {
    navigator: { mediaDevices: { getUserMedia: () => undefined } },
    MediaRecorder: class {},
    AudioContext: class {},
    WebAssembly: {},
    Worker: class {},
  };
  it('con micrófono, MediaRecorder, AudioContext, WebAssembly y Workers se puede dictar', () => {
    expect(dictadoSoportado(completo)).toBe(true);
  });
  it.each(['MediaRecorder', 'AudioContext', 'WebAssembly', 'Worker'] as const)('sin %s no se puede', (falta) => {
    expect(dictadoSoportado({ ...completo, [falta]: undefined })).toBe(false);
  });
  it('sin mediaDevices (contexto no seguro) no se puede', () => {
    expect(dictadoSoportado({ ...completo, navigator: {} })).toBe(false);
  });
});
