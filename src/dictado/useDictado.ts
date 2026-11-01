import { useCallback, useEffect, useRef, useState } from 'react';
import { aMono16k, duracionSegundos, ErrorGrabacion, iniciarGrabacion, type Grabacion } from './grabador';
import { dictadoSoportado } from './soporte';
import type { MensajeAlWorker, MensajeDelWorker } from './whisper.worker';

// Dictado por voz en el navegador (302, diseño «mf-supervision»). Máquina de estados:
// INACTIVO → PREPARANDO → LISTO → GRABANDO → TRANSCRIBIENDO → LISTO, más ERROR y NO_DISPONIBLE.
// El worker y transformers.js se cargan recién al pulsar el micrófono por primera vez (carga diferida); el modelo
// queda cargado para toda la página y guardado en el navegador para las próximas veces.

export type EstadoDictado = 'INACTIVO' | 'PREPARANDO' | 'LISTO' | 'GRABANDO' | 'TRANSCRIBIENDO' | 'ERROR' | 'NO_DISPONIBLE';

/**
 * - `SIN_PERMISO`: el usuario negó el micrófono (criterio 7).
 * - `NO_ENTENDIDO`: grabación de menos de 1 s, sin texto o que no se pudo transcribir (criterio 9).
 * - `SIN_SOPORTE`: el navegador no tiene micrófono, WebAssembly o Web Workers (criterio 8).
 * - `MODELO`: el modelo no se pudo descargar (criterio 8).
 */
export type ErrorDictado = 'SIN_PERMISO' | 'NO_ENTENDIDO' | 'SIN_SOPORTE' | 'MODELO';

/** Grabación mínima para transcribir (criterio 9). */
export const SEGUNDOS_MINIMOS = 1;

/** Límite de una grabación (criterio 2, decisión del equipo). */
export const SEGUNDOS_MAXIMOS = 60;

/** URL del worker del dictado, junto al código del propio microfrontend (no del shell que lo carga). */
export function urlWorkerDictado(base: string = import.meta.url): URL {
  return new URL('./whisper.worker.js', base);
}

/**
 * Crea el worker de Whisper. Dentro del shell el microfrontend viene de otro origen (4203 dentro de 4200) y el
 * navegador no deja crear un worker con una URL de otro origen: se crea entonces un worker local (`blob:`) que
 * importa el del microfrontend, lo que sí se permite porque el servidor del microfrontend tiene CORS abierto.
 */
export function crearWorkerWhisper(url: URL = urlWorkerDictado(), origen: string = window.location.origin): Worker {
  if (url.origin === origen) return new Worker(url, { type: 'module' });
  const puente = new Blob([`import ${JSON.stringify(url.href)};\n`], { type: 'text/javascript' });
  return new Worker(URL.createObjectURL(puente), { type: 'module' });
}

/** Lo que el hook necesita del worker: preparar el modelo (con su avance) y transcribir. */
export interface MotorDictado {
  preparar(alAvance: (porcentaje: number) => void): Promise<void>;
  transcribir(audio: Float32Array): Promise<string>;
}

/** Motor que habla con el worker de Whisper; lo crea al primer uso. */
export function crearMotorDictado(crearWorker: () => Worker = crearWorkerWhisper): MotorDictado {
  let worker: Worker | undefined;
  let preparado: Promise<void> | undefined;
  let siguienteId = 1;
  const avances = new Set<(porcentaje: number) => void>();
  const pendientes = new Map<number, { resolver(texto: string): void; rechazar(error: Error): void }>();
  let alCargar: { resolver(): void; rechazar(error: Error): void } | undefined;

  const enviar = (mensaje: MensajeAlWorker) =>
    mensaje.tipo === 'transcribir' ? worker?.postMessage(mensaje, [mensaje.audio.buffer]) : worker?.postMessage(mensaje);

  const fallar = (error: Error) => {
    alCargar?.rechazar(error);
    alCargar = undefined;
    for (const p of pendientes.values()) p.rechazar(error);
    pendientes.clear();
    worker?.terminate();
    worker = undefined;
    preparado = undefined;
  };

  const abrir = () => {
    const nuevo = crearWorker();
    nuevo.addEventListener('message', (evento: MessageEvent<MensajeDelWorker>) => {
      const m = evento.data;
      if (m.tipo === 'progreso') avances.forEach((f) => f(m.porcentaje));
      else if (m.tipo === 'listo') {
        alCargar?.resolver();
        alCargar = undefined;
      } else if (m.tipo === 'error-carga') fallar(new Error(m.mensaje));
      else {
        const pedido = pendientes.get(m.id);
        pendientes.delete(m.id);
        if (m.tipo === 'texto') pedido?.resolver(m.texto);
        else pedido?.rechazar(new Error(m.mensaje));
      }
    });
    // El archivo del worker no se pudo cargar (sin red, sin CORS)
    nuevo.addEventListener('error', () => fallar(new Error('No se pudo cargar el worker del dictado')));
    return nuevo;
  };

  return {
    preparar(alAvance) {
      avances.add(alAvance);
      preparado ??= new Promise<void>((resolver, rechazar) => {
        alCargar = { resolver, rechazar };
        worker = abrir();
        enviar({ tipo: 'cargar' });
      });
      return preparado.finally(() => avances.delete(alAvance));
    },
    transcribir(audio) {
      if (!worker) return Promise.reject(new Error('El dictado no está preparado'));
      const id = siguienteId++;
      return new Promise<string>((resolver, rechazar) => {
        pendientes.set(id, { resolver, rechazar });
        enviar({ tipo: 'transcribir', id, audio });
      });
    },
  };
}

let motorCompartido: MotorDictado | undefined;

/** Motor único de la página: el modelo se carga una sola vez aunque haya varios campos de dictado. */
export function motorDictado(): MotorDictado {
  motorCompartido ??= crearMotorDictado();
  return motorCompartido;
}

export interface DependenciasDictado {
  motor: MotorDictado;
  grabar: () => Promise<Grabacion>;
  convertir: (audio: Blob) => Promise<Float32Array>;
  soportado: () => boolean;
}

export interface OpcionesDictado {
  /** Recibe el texto reconocido (nunca el audio). */
  alTexto: (texto: string) => void;
  maxSegundos?: number;
  /** Solo en las pruebas: worker, grabador y soporte simulados. */
  dependencias?: Partial<DependenciasDictado>;
}

export interface Dictado {
  estado: EstadoDictado;
  /** Avance de la descarga del modelo (0 a 100) mientras está `PREPARANDO`. */
  progreso: number;
  error?: ErrorDictado;
  /** Segundos grabados. */
  segundos: number;
  iniciar(): void;
  detener(): void;
}

export function useDictado({ alTexto, maxSegundos = SEGUNDOS_MAXIMOS, dependencias }: OpcionesDictado): Dictado {
  const deps = useRef<DependenciasDictado>(undefined as never);
  deps.current = {
    motor: dependencias?.motor ?? motorDictado(),
    grabar: dependencias?.grabar ?? iniciarGrabacion,
    convertir: dependencias?.convertir ?? aMono16k,
    soportado: dependencias?.soportado ?? dictadoSoportado,
  };
  const textoRef = useRef(alTexto);
  textoRef.current = alTexto;

  const [soportado] = useState(() => deps.current.soportado());
  const [estado, setEstadoVisible] = useState<EstadoDictado>(soportado ? 'INACTIVO' : 'NO_DISPONIBLE');
  const [error, setError] = useState<ErrorDictado | undefined>(soportado ? undefined : 'SIN_SOPORTE');
  const [progreso, setProgreso] = useState(0);
  const [segundos, setSegundos] = useState(0);

  const estadoRef = useRef(estado);
  const modeloListo = useRef(false);
  const grabacion = useRef<Grabacion | undefined>(undefined);
  const relojes = useRef<ReturnType<typeof setInterval>[]>([]);
  const montado = useRef(true);

  const cambiar = useCallback((nuevo: EstadoDictado, nuevoError?: ErrorDictado) => {
    if (!montado.current) return;
    estadoRef.current = nuevo;
    setEstadoVisible(nuevo);
    setError(nuevoError);
  }, []);

  const pararRelojes = () => {
    relojes.current.forEach((r) => clearInterval(r));
    relojes.current = [];
  };

  const detener = useCallback(async () => {
    const actual = grabacion.current;
    if (estadoRef.current !== 'GRABANDO' || !actual) return;
    pararRelojes();
    grabacion.current = undefined;
    cambiar('TRANSCRIBIENDO');
    try {
      const audio = await deps.current.convertir(await actual.detener());
      if (duracionSegundos(audio) < SEGUNDOS_MINIMOS) {
        cambiar('ERROR', 'NO_ENTENDIDO');
        return;
      }
      const texto = (await deps.current.motor.transcribir(audio)).trim();
      if (!montado.current) return;
      if (!texto) {
        cambiar('ERROR', 'NO_ENTENDIDO');
        return;
      }
      textoRef.current(texto);
      cambiar('LISTO');
    } catch {
      cambiar('ERROR', 'NO_ENTENDIDO');
    }
  }, [cambiar]);

  const grabar = useCallback(async () => {
    try {
      const nueva = await deps.current.grabar();
      if (!montado.current) {
        nueva.cancelar();
        return;
      }
      grabacion.current = nueva;
      setSegundos(0);
      cambiar('GRABANDO');
      const inicio = Date.now();
      relojes.current.push(
        setInterval(() => {
          const transcurridos = Math.floor((Date.now() - inicio) / 1000);
          setSegundos(transcurridos);
          if (transcurridos >= maxSegundos) void detener();
        }, 250),
      );
    } catch (e) {
      if (e instanceof ErrorGrabacion && e.motivo === 'SIN_PERMISO') cambiar('ERROR', 'SIN_PERMISO');
      else cambiar('NO_DISPONIBLE', 'SIN_SOPORTE');
    }
  }, [cambiar, detener, maxSegundos]);

  const iniciar = useCallback(async () => {
    const actual = estadoRef.current;
    if (actual === 'PREPARANDO' || actual === 'GRABANDO' || actual === 'TRANSCRIBIENDO' || actual === 'NO_DISPONIBLE') return;
    if (!modeloListo.current) {
      setProgreso(0);
      cambiar('PREPARANDO');
      try {
        await deps.current.motor.preparar((p) => montado.current && setProgreso(p));
      } catch {
        cambiar('NO_DISPONIBLE', 'MODELO');
        return;
      }
      modeloListo.current = true;
      cambiar('LISTO');
    }
    // La pulsación era para dictar: con el modelo listo empieza a grabar
    await grabar();
  }, [cambiar, grabar]);

  // Al salir de la pantalla se suelta el micrófono y se descarta lo grabado
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      pararRelojes();
      grabacion.current?.cancelar();
      grabacion.current = undefined;
    };
  }, []);

  return {
    estado,
    progreso,
    error,
    segundos,
    iniciar: () => void iniciar(),
    detener: () => void detener(),
  };
}
