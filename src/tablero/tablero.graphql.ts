import { gql, type TypedDocumentNode } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// Consulta del tablero (009; docs/contratos.md: tablero). El gateway resuelve cada parte por separado: si un
// servicio no responde, solo sus campos llegan en null con SERVICIO_NO_DISPONIBLE y el resto llega normal.

export type EstadoPlanilla = 'BORRADOR' | 'PRESENTADA' | 'APROBANDO' | 'APROBADA' | 'OBSERVADA';

export interface PlanillaCorta {
  periodo: string;
  estado: EstadoPlanilla;
}

export interface ResumenMonto {
  cantidad: number;
  monto: number;
}

export interface IndicadoresTablero {
  obrasEnEjecucion: number | null;
  obrasEnRiesgo: number | null;
  materialesBajos: number | null;
  /** Finanzas; null sin error si el rol no es admin ni gerente. */
  cobrosVencidos: ResumenMonto | null;
}

export interface FilaTablero {
  obraId: string;
  nombre: string;
  avancePct: number;
  plazoPct: number;
  /** plazoPct − avancePct */
  diferencia: number;
  enRiesgo: boolean;
  /** Materiales; null si no responde. */
  materialesBajos: number | null;
  ultimaPlanilla: PlanillaCorta | null;
}

export interface Tablero {
  indicadores: IndicadoresTablero | null;
  obras: FilaTablero[] | null;
}

export const TABLERO: TypedDocumentNode<{ tablero: Tablero }, Record<string, never>> = gql`
  query Tablero {
    tablero {
      indicadores {
        obrasEnEjecucion
        obrasEnRiesgo
        materialesBajos
        cobrosVencidos {
          cantidad
          monto
        }
      }
      obras {
        obraId
        nombre
        avancePct
        plazoPct
        diferencia
        enRiesgo
        materialesBajos
        ultimaPlanilla {
          periodo
          estado
        }
      }
    }
  }
`;

/**
 * Tablero al abrir la pantalla (y con `refetch`, el botón «Actualizar»). `errorPolicy: 'all'` entrega a la vez los
 * datos que llegaron y los errores de las partes que fallaron.
 */
export function useTablero() {
  return useQuery(TABLERO, { errorPolicy: 'all', notifyOnNetworkStatusChange: true });
}
