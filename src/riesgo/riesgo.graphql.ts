import { gql, type TypedDocumentNode } from '@apollo/client';
import { useConsultaConRespaldo } from '../nucleo/consulta-respaldo';

// Consultas de la pantalla «Riesgo de retraso» (402; docs/contratos.md). La lista usa la misma consulta del tablero
// (`tablero { obras { … riesgoRetraso } }`); aquí van el historial de la obra elegida y el panel «Sobre el modelo».

export interface PuntoRiesgo {
  /** 0 a 1 */
  probabilidad: number;
  calculadaEn: string;
}

/** Cálculos que se muestran en el gráfico (el valor por defecto del contrato). */
export const LIMITE_HISTORIAL = 30;

export const HISTORIAL_RIESGO: TypedDocumentNode<
  { obra: { id: string; historialRiesgo: PuntoRiesgo[] | null } | null },
  { id: string }
> = gql`
  query HistorialRiesgo($id: ID!) {
    obra(id: $id) {
      id
      historialRiesgo(limite: ${LIMITE_HISTORIAL}) {
        probabilidad
        calculadaEn
      }
    }
  }
`;

export type OrigenDatosModelo = 'SINTETICOS' | 'REALES';

export interface MetricasModeloRiesgo {
  aucRoc: number;
  aucRocRegla: number;
  recallMedio: number;
  precisionAlto: number;
  brier: number;
}

export interface ModeloRiesgo {
  versionModelo: string;
  entrenadoEn: string;
  /** `SINTETICOS` o `REALES` (String en el contrato). */
  datos: string;
  filasEntrenamiento: number;
  metricas: MetricasModeloRiesgo;
  umbralMedio: number;
  umbralAlto: number;
}

export const MODELO_RIESGO: TypedDocumentNode<{ modeloRiesgo: ModeloRiesgo | null }, Record<string, never>> = gql`
  query ModeloRiesgo {
    modeloRiesgo {
      versionModelo
      entrenadoEn
      datos
      filasEntrenamiento
      metricas {
        aucRoc
        aucRocRegla
        recallMedio
        precisionAlto
        brier
      }
      umbralMedio
      umbralAlto
    }
  }
`;

/** Historial de la probabilidad de una obra, del más antiguo al más reciente; no se pide sin obra elegida. */
export function useHistorialRiesgo(obraId: string | undefined) {
  return useConsultaConRespaldo(HISTORIAL_RIESGO, {
    variables: { id: obraId ?? '' },
    omitir: !obraId,
    errorPolicy: 'all',
  });
}

/** Versión, fecha de entrenamiento, métricas y origen de los datos del modelo. */
export function useModeloRiesgo() {
  return useConsultaConRespaldo(MODELO_RIESGO, { errorPolicy: 'all' });
}
