import { gql, type TypedDocumentNode } from '@apollo/client';
import { useConsultaConRespaldo } from '../nucleo/consulta-respaldo';

// Consulta del tablero (009; docs/contratos.md: tablero). El gateway resuelve cada parte por separado: si un
// servicio no responde, solo sus campos llegan en null con SERVICIO_NO_DISPONIBLE y el resto llega normal.

export type EstadoPlanilla = 'BORRADOR' | 'PRESENTADA' | 'APROBANDO' | 'APROBADA' | 'OBSERVADA';

export interface PlanillaCorta {
  periodo: string;
  estado: EstadoPlanilla;
}

/** Nivel del riesgo de retraso del modelo (402): BAJO < 30 % ≤ MEDIO < 60 % ≤ ALTO. */
export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'SIN_DATOS';

export interface FactorRiesgo {
  variable: string;
  descripcion: string;
  peso: number;
}

/** Predicción del modelo (402); `probabilidad` de 0 a 1, null con SIN_DATOS. */
export interface RiesgoRetraso {
  probabilidad: number | null;
  nivel: NivelRiesgo;
  factores: FactorRiesgo[];
  versionModelo: string | null;
  calculadaEn: string | null;
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
  /** IA (402); null si no responde. */
  obrasRiesgoAlto: number | null;
  /** IA (403): consumos atípicos PENDIENTE en las obras del usuario; null si no responde. */
  consumosAtipicosPendientes: number | null;
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
  /** IA (402); null si no responde. */
  riesgoRetraso: RiesgoRetraso | null;
  /** IA (403): consumos atípicos PENDIENTE de la obra; null si no responde. */
  consumosAtipicosPendientes: number | null;
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
        obrasRiesgoAlto
        consumosAtipicosPendientes
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
        riesgoRetraso {
          probabilidad
          nivel
          factores {
            variable
            descripcion
            peso
          }
          versionModelo
          calculadaEn
        }
        consumosAtipicosPendientes
      }
    }
  }
`;

/**
 * Tablero al abrir la pantalla (y con `refetch`, el botón «Actualizar»). `errorPolicy: 'all'` entrega a la vez los
 * datos que llegaron y los errores de las partes que fallaron. La respuesta completa se guarda en el equipo y, sin
 * conexión o si el gateway no responde, se muestra la guardada (104); una parcial se muestra pero no se guarda.
 */
export function useTablero() {
  return useConsultaConRespaldo(TABLERO, { errorPolicy: 'all', notifyOnNetworkStatusChange: true });
}
