import { useEffect, useRef, useState } from 'react';
import type { DocumentNode, ErrorLike, OperationVariables, TypedDocumentNode } from '@apollo/client';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { useQuery } from '@apollo/client/react';
import { obtenerAlmacen, reportarFalloConexion, useEnLinea } from './conexion';

// Consultas con respaldo en el equipo (104, diseño «Patrón común en los microfrontends»):
// - En línea: la consulta va a la red (`network-only`); si responde completa, se guarda en el almacén del shell.
// - Si falla por la red: se avisa al shell (`reportarFallo()`) y se muestra lo guardado.
// - Sin conexión: no se pide a la red; se muestra lo guardado, o se avisa que no hay datos guardados.
// - Sin almacén del shell (microfrontend abierto solo para desarrollar): igual que `useQuery`, sin guardar nada.

/** Nombre de la operación del documento GraphQL (`query Materiales(...)` → `Materiales`). */
export function nombreOperacion(documento: DocumentNode): string {
  for (const definicion of documento.definitions) {
    if (definicion.kind === 'OperationDefinition' && definicion.name) return definicion.name.value;
  }
  return 'SinNombre';
}

/** Clave de la consulta en el almacén: `"{nombreOperacion}:{JSON.stringify(variables)}"`. */
export function claveConsulta(documento: DocumentNode, variables?: OperationVariables): string {
  return `${nombreOperacion(documento)}:${JSON.stringify(variables ?? {})}`;
}

/**
 * Si el error es de red (sin respuesta del gateway, tiempo agotado o pedido cortado) y no un rechazo
 * del gateway: los errores GraphQL y las respuestas HTTP con cuerpo los muestra la pantalla como antes.
 * Un 502, 503 o 504 sin código propio lo devuelve un intermediario cuando el gateway no responde.
 */
export function esFalloDeRed(error: unknown): boolean {
  if (CombinedGraphQLErrors.is(error)) return false;
  if (ServerError.is(error)) {
    if (![502, 503, 504].includes(error.statusCode)) return false;
    try {
      const cuerpo = JSON.parse(error.bodyText) as { errors?: unknown[] };
      return !Array.isArray(cuerpo.errors);
    } catch {
      return true;
    }
  }
  return true;
}

/** En modo sin conexión el shell rechaza `obtenerToken()` con `Error('SIN_CONEXION')`: no es un fallo del gateway. */
function esSesionSinConexion(error: unknown): boolean {
  return error instanceof Error && error.message === 'SIN_CONEXION';
}

interface OpcionesRespaldo<TVariables> {
  variables?: TVariables;
  omitir?: boolean;
  notifyOnNetworkStatusChange?: boolean;
  /** `'all'` entrega los datos parciales junto con sus errores (se muestran, pero no se guardan). */
  errorPolicy?: 'none' | 'all';
}

type Respaldo<TData> =
  | { estado: 'sin-leer' }
  | { estado: 'leyendo'; clave: string }
  | { estado: 'leido'; clave: string; guardado: { datos: TData; guardadoEn: string } | null };

export interface ResultadoConRespaldo<TData> {
  /** Datos de la red o, si se cayó a lo guardado, del equipo. */
  data: TData | undefined;
  previousData: TData | undefined;
  loading: boolean;
  /** Error que la pantalla muestra como antes (no incluye los fallos de red cubiertos por lo guardado). */
  error: ErrorLike | undefined;
  refetch: () => Promise<unknown>;
  /** Los datos vienen del equipo (`guardadoEn` dice de cuándo). */
  desdeEquipo: boolean;
  guardadoEn?: string;
  /** Sin conexión y esta consulta nunca se guardó en el equipo. */
  sinDatosGuardados: boolean;
}

export function useConsultaConRespaldo<TData, TVariables extends OperationVariables = OperationVariables>(
  documento: TypedDocumentNode<TData, TVariables>,
  { variables, omitir = false, notifyOnNetworkStatusChange, errorPolicy }: OpcionesRespaldo<TVariables> = {},
): ResultadoConRespaldo<TData> {
  const almacen = obtenerAlmacen();
  const enLinea = useEnLinea();
  const sinConexion = !!almacen && !enLinea;
  const clave = claveConsulta(documento, variables);

  const consulta = useQuery(documento as TypedDocumentNode<TData, OperationVariables>, {
    variables: variables as OperationVariables,
    skip: omitir || sinConexion,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange,
    errorPolicy,
  });

  const falloDeRed = !!almacen && !omitir && !sinConexion && !!consulta.error && esFalloDeRed(consulta.error);
  const usarRespaldo = !omitir && (sinConexion || falloDeRed);

  // Respuesta completa de la red → se guarda (una parcial llega como error y no reemplaza la guardada)
  const datosRed = consulta.dataState === 'complete' && !consulta.error ? (consulta.data as TData) : undefined;
  useEffect(() => {
    if (!almacen || datosRed === undefined) return;
    almacen.guardarConsulta(clave, datosRed).catch(() => {
      // Si el equipo no deja guardar, la pantalla sigue con los datos de la red
    });
  }, [almacen, clave, datosRed]);

  // Fallo de red → se avisa al shell una vez por error
  const errorReportado = useRef<unknown>(undefined);
  useEffect(() => {
    if (!falloDeRed || errorReportado.current === consulta.error) return;
    errorReportado.current = consulta.error;
    if (!esSesionSinConexion(consulta.error)) reportarFalloConexion();
  }, [falloDeRed, consulta.error]);

  // Lo guardado en el equipo, solo cuando hace falta
  const [respaldo, setRespaldo] = useState<Respaldo<TData>>({ estado: 'sin-leer' });
  useEffect(() => {
    if (!usarRespaldo || !almacen) return;
    let vigente = true;
    setRespaldo({ estado: 'leyendo', clave });
    almacen
      .leerConsulta<TData>(clave)
      .catch(() => null)
      .then((guardado) => {
        if (vigente) setRespaldo({ estado: 'leido', clave, guardado });
      });
    return () => {
      vigente = false;
    };
  }, [usarRespaldo, almacen, clave]);

  // Al volver la conexión no hace falta hacer nada: la consulta deja de omitirse y vuelve a la red.

  if (!usarRespaldo) {
    return {
      data: consulta.data as TData | undefined,
      previousData: consulta.previousData as TData | undefined,
      loading: consulta.loading,
      error: consulta.error,
      refetch: () => consulta.refetch(),
      desdeEquipo: false,
      sinDatosGuardados: false,
    };
  }

  const leido = respaldo.estado === 'leido' && respaldo.clave === clave ? respaldo.guardado : undefined;
  return {
    data: leido?.datos,
    previousData: undefined,
    loading: leido === undefined,
    error: undefined,
    // Sin conexión no se pide a la red; tras un fallo de red sí se reintenta
    refetch: sinConexion ? () => Promise.resolve(undefined) : () => consulta.refetch(),
    desdeEquipo: !!leido,
    guardadoEn: leido?.guardadoEn,
    sinDatosGuardados: leido === null,
  };
}
