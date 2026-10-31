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
};

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
