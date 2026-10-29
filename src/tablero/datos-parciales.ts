import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { avisoNoDisponible, NOMBRE_SERVICIO, type Servicio } from '../nucleo/errores';
import type { FilaTablero, ResumenMonto, Tablero } from './tablero.graphql';

// Qué partes del tablero llegaron y cuáles no (009, criterio 5). Cada campo es de un servicio (gateway, «tablero»):
// si llega en null se muestra «—» con «Datos de {servicio} no disponibles». El servicio se toma de
// `extensions.servicio` del error de ese campo y, si no viene, del dueño del campo.

/** Un dato del tablero: su valor, o el aviso de por qué falta. */
export type Dato<T> = { valor: T } | { aviso: string };

export interface TableroVisible {
  obrasEnEjecucion: Dato<number>;
  obrasEnRiesgo: Dato<number>;
  materialesBajos: Dato<number>;
  /** `undefined` si el rol no ve cobros (la tarjeta no se muestra). */
  cobrosVencidos?: Dato<ResumenMonto>;
  obras: Dato<FilaTablero[]>;
  /** Aviso de la columna «Materiales bajos» si alguna fila llegó sin ese dato. */
  avisoMaterialesFilas?: string;
}

type Ruta = readonly (string | number)[];

function servicioDelError(errores: CombinedGraphQLErrors | undefined, ruta: Ruta): Servicio | undefined {
  for (const e of errores?.errors ?? []) {
    const camino = e.path ?? [];
    // El error es del campo, de uno que lo contiene (todo `indicadores`) o de uno de sus hijos
    const largo = Math.min(camino.length, ruta.length);
    if (largo === 0 || camino.slice(0, largo).some((parte, i) => parte !== ruta[i])) continue;
    const servicio = e.extensions?.['servicio'];
    if (typeof servicio === 'string' && servicio in NOMBRE_SERVICIO) return servicio as Servicio;
  }
  return undefined;
}

function dato<T>(
  valor: T | null | undefined,
  ruta: Ruta,
  dueno: Servicio,
  errores: CombinedGraphQLErrors | undefined,
): Dato<T> {
  if (valor !== null && valor !== undefined) return { valor };
  return { aviso: avisoNoDisponible(servicioDelError(errores, ruta) ?? dueno) };
}

/** Arma lo que muestra el tablero a partir de la respuesta parcial del gateway. */
export function tableroVisible(tablero: Tablero, error: unknown, verCobros: boolean): TableroVisible {
  const errores = CombinedGraphQLErrors.is(error) ? error : undefined;
  const ind = tablero.indicadores;
  const rutaInd = ['tablero', 'indicadores'] as const;
  const obras = tablero.obras;
  const filaSinMateriales = obras?.findIndex((f) => f.materialesBajos === null) ?? -1;

  return {
    obrasEnEjecucion: dato(ind?.obrasEnEjecucion, [...rutaInd, 'obrasEnEjecucion'], 'obras', errores),
    obrasEnRiesgo: dato(ind?.obrasEnRiesgo, [...rutaInd, 'obrasEnRiesgo'], 'obras', errores),
    materialesBajos: dato(ind?.materialesBajos, [...rutaInd, 'materialesBajos'], 'materiales', errores),
    cobrosVencidos: verCobros
      ? dato(ind?.cobrosVencidos, [...rutaInd, 'cobrosVencidos'], 'finanzas', errores)
      : undefined,
    obras: dato(obras, ['tablero', 'obras'], 'obras', errores),
    avisoMaterialesFilas:
      filaSinMateriales < 0
        ? undefined
        : avisoNoDisponible(
            servicioDelError(errores, ['tablero', 'obras', filaSinMateriales, 'materialesBajos']) ?? 'materiales',
          ),
  };
}
