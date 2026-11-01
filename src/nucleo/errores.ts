import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';

// Texto que ve el usuario para cada `extensions.codigo` que puede recibir este microfrontend
// (docs/mensajes.md de la carpeta general, columna «Se ve en»: ERP · Supervisión y genéricos).

const MENSAJES: Record<string, string> = {
  DATOS_INVALIDOS: 'Algunos datos no son válidos. Revisa los campos marcados.',
  NO_AUTENTICADO: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  SIN_PERMISO: 'No tienes permiso para hacer esta acción.',
  RUTA_NO_ENCONTRADA: 'No encontramos lo que buscas. Puede que ya no exista o que no tengas acceso.',
  DEMASIADAS_PETICIONES: 'Hiciste muchas solicitudes seguidas. Espera un momento e intenta de nuevo.',
  ERROR_INTERNO: 'Ocurrió un error inesperado. Intenta de nuevo; si se repite, avisa a soporte.',
  SERVICIO_NO_DISPONIBLE: 'Este servicio no está disponible por el momento. Intenta de nuevo en unos minutos.',
  TIEMPO_AGOTADO: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  // 402
  MODELO_NO_DISPONIBLE: 'El modelo de riesgo no está disponible por el momento.',
  // 502
  AGENTE_INVALIDO: 'Ese agente no existe.',
  EJECUCION_EN_CURSO: 'El agente ya se está ejecutando',
  EJECUCION_NO_ENCONTRADA: 'No encontramos esa ejecución.',
  SUGERENCIA_NO_ENCONTRADA: 'No encontramos esa sugerencia o no tienes acceso a ella.',
  SUGERENCIA_YA_DECIDIDA: 'Esta sugerencia ya fue aprobada o rechazada. Recarga la lista.',
  COMENTARIO_INVALIDO: 'Revisa el comentario.',
  MOTIVO_INVALIDO: 'El motivo debe tener entre 10 y 500 caracteres.',
};

/** Panel «Sobre el modelo» sin modelo cargado en IA (MODELO_NO_DISPONIBLE, 402). */
export const MENSAJE_MODELO_NO_DISPONIBLE = MENSAJES['MODELO_NO_DISPONIBLE'];

const SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.';

/** Nombre que ve el usuario de cada servicio (`extensions.servicio`) en el aviso del tablero. */
export const NOMBRE_SERVICIO = {
  obras: 'Obras',
  materiales: 'Materiales',
  finanzas: 'Finanzas',
  ia: 'IA',
} as const;

export type Servicio = keyof typeof NOMBRE_SERVICIO;

/**
 * Aviso del tablero cuando un servicio no responde (009, criterio 5): «Datos de Obras no disponibles»; para el
 * servicio de IA, «Datos de IA no disponibles» (402 y 403, criterio 12).
 */
export function avisoNoDisponible(servicio: Servicio): string {
  return `Datos de ${NOMBRE_SERVICIO[servicio]} no disponibles`;
}

type ErrorConExtensiones = { extensions?: Record<string, unknown> | null };

function primerCodigo(errores: readonly ErrorConExtensiones[] | undefined): string | undefined {
  for (const e of errores ?? []) {
    const codigo = e.extensions?.['codigo'];
    if (typeof codigo === 'string') return codigo;
  }
  return undefined;
}

/**
 * Primer `extensions.codigo` del error de Apollo, si lo trae. El gateway responde con estado HTTP de error
 * cuando rechaza la petición entera (token, límite de peticiones): Apollo lo entrega como ServerError con el cuerpo.
 */
export function codigoDeError(error: unknown): string | undefined {
  if (CombinedGraphQLErrors.is(error)) return primerCodigo(error.errors);
  if (ServerError.is(error)) {
    try {
      return primerCodigo((JSON.parse(error.bodyText) as { errors?: ErrorConExtensiones[] }).errors);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Mensaje para el usuario de un error que impide mostrar la pantalla. */
export function mensajeDeError(error: unknown): string {
  const codigo = codigoDeError(error);
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;
  if (CombinedGraphQLErrors.is(error) || ServerError.is(error)) return MENSAJES['ERROR_INTERNO'];
  return SIN_CONEXION;
}

// 503: textos de la pantalla «Reportes» (docs/mensajes.md, «IA»). En reportes, SERVICIO_NO_DISPONIBLE y
// TIEMPO_AGOTADO tienen su texto propio.

/** INTENCION_NO_RECONOCIDA y RECETA_INVALIDA (503, criterios 6 y 7). */
export const MENSAJE_NO_ENCONTRE_REPORTE = 'No encontré un reporte para tu pedido';
const REPORTES_NO_DISPONIBLES = 'El servicio de reportes no está disponible; intenta de nuevo';

const MENSAJES_REPORTES: Record<string, string> = {
  TEXTO_INVALIDO: 'El pedido debe tener entre 3 y 500 caracteres.',
  INTENCION_NO_RECONOCIDA: MENSAJE_NO_ENCONTRE_REPORTE,
  RECETA_INVALIDA: MENSAJE_NO_ENCONTRE_REPORTE,
  DEMASIADAS_CONSULTAS: 'Demasiadas consultas; espera un momento',
  LLM_NO_DISPONIBLE: REPORTES_NO_DISPONIBLES,
  REPORTES_NO_DISPONIBLES: REPORTES_NO_DISPONIBLES,
  SERVICIO_NO_DISPONIBLE: REPORTES_NO_DISPONIBLES,
  TIEMPO_AGOTADO: 'El reporte tardó demasiado; intenta de nuevo',
};

/** El pedido no corresponde al catálogo: se muestran los conjuntos, ejemplos y reportes comunes. */
export function esPedidoNoReconocido(codigo: string | undefined): boolean {
  return codigo === 'INTENCION_NO_RECONOCIDA' || codigo === 'RECETA_INVALIDA';
}

/** Mensaje de un error al pedir un reporte; los códigos que no son de reportes, como en el resto del área. */
export function mensajeErrorReporte(error: unknown, codigo: string | undefined = codigoDeError(error)): string {
  return (codigo && MENSAJES_REPORTES[codigo]) || mensajeDeError(error);
}

// 502: errores de una ejecución de agente (`error.codigo` de una ejecución FALLIDA o `error` de un paso). No son
// respuestas HTTP: se ven en el historial y el detalle de ejecuciones (docs/mensajes.md). ERROR_INTERNO tiene un
// texto en la ejecución y otro en el paso.
const MENSAJE_PASO_FALLIDO = 'La consulta falló en el servicio.';
const MENSAJE_EJECUCION_FALLIDA = 'La ejecución falló por un error inesperado.';

const MENSAJES_EJECUCION: Record<string, string> = {
  SIN_HERRAMIENTAS: 'Sin herramientas disponibles',
  REPORTE_INVALIDO: 'El agente no logró armar un reporte válido.',
  EJECUCION_TIEMPO_AGOTADO: 'El agente superó el tiempo máximo de 3 minutos.',
  INTERRUMPIDA: 'La ejecución se interrumpió porque el servicio se reinició.',
  LLM_NO_DISPONIBLE: 'El modelo de lenguaje no respondió.',
  ERROR_INTERNO: MENSAJE_EJECUCION_FALLIDA,
};

const MENSAJES_PASO: Record<string, string> = {
  HERRAMIENTA_NO_PERMITIDA: 'El agente pidió una herramienta que no le corresponde; se ignoró.',
  ARGUMENTO_INVALIDO: 'El agente pidió datos con parámetros no válidos; se ignoró.',
  OBRA_NO_ENCONTRADA: 'La obra pedida no existe.',
  ERROR_INTERNO: MENSAJE_PASO_FALLIDO,
};

/** Texto del error de una ejecución `FALLIDA`; si el código no se conoce, el que vino del servicio de IA. */
export function mensajeErrorEjecucion(codigo: string, mensaje?: string): string {
  return MENSAJES_EJECUCION[codigo] ?? (mensaje || MENSAJE_EJECUCION_FALLIDA);
}

/** Texto del error de un paso; nunca el código: si no se conoce, el de una consulta que falló en el servicio. */
export function mensajeErrorPaso(codigo: string): string {
  return MENSAJES_PASO[codigo] ?? MENSAJE_PASO_FALLIDO;
}

/** Errores por campo de una respuesta `400` o `422` (`extensions.errores[]`, docs/mensajes.md). */
export function erroresDeCampo(error: unknown): { campo: string; mensaje: string }[] {
  if (!CombinedGraphQLErrors.is(error)) return [];
  for (const e of error.errors) {
    const errores = e.extensions?.['errores'];
    if (Array.isArray(errores)) {
      return errores.filter(
        (x): x is { campo: string; mensaje: string } => typeof x?.campo === 'string' && typeof x?.mensaje === 'string',
      );
    }
  }
  return [];
}
