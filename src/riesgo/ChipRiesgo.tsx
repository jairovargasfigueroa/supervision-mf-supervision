import Box from '@mui/material/Box';
import { EstadoChip, type TonoEstado } from '../compartido/EstadoChip';
import type { NivelRiesgo, RiesgoRetraso } from '../tablero/tablero.graphql';

// Riesgo de retraso del modelo (402) como chip de color y porcentaje: BAJO verde, MEDIO amarillo, ALTO rojo y
// SIN_DATOS gris «Sin datos» (diseño de la 402). Si IA no respondió (`null`) se muestra «—» con su aviso.

export const NIVEL_RIESGO: Record<NivelRiesgo, { etiqueta: string; tono: TonoEstado }> = {
  BAJO: { etiqueta: 'Bajo', tono: 'exito' },
  MEDIO: { etiqueta: 'Medio', tono: 'atencion' },
  ALTO: { etiqueta: 'Alto', tono: 'error' },
  SIN_DATOS: { etiqueta: 'Sin datos', tono: 'neutro' },
};

/** Porcentaje entero de una probabilidad de 0 a 1: `0.724` → `72 %`. */
export function porcentajeRiesgo(probabilidad: number): string {
  return `${Math.round(probabilidad * 100)} %`;
}

/** Valor para ordenar por riesgo: la probabilidad; sin datos (−1) o sin IA (−2) van al final de mayor a menor. */
export function ordenRiesgo(riesgo: RiesgoRetraso | null): number {
  if (!riesgo) return -2;
  return riesgo.probabilidad ?? -1;
}

interface Props {
  riesgo: RiesgoRetraso | null;
  /** Aviso cuando falta el dato: «Datos de IA no disponibles». */
  aviso?: string;
}

export function ChipRiesgo({ riesgo, aviso }: Props) {
  if (!riesgo) {
    return (
      <Box component="span" title={aviso} aria-label={aviso}>
        —
      </Box>
    );
  }
  const nivel = NIVEL_RIESGO[riesgo.nivel];
  const conProbabilidad = riesgo.nivel !== 'SIN_DATOS' && riesgo.probabilidad !== null;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
      <EstadoChip etiqueta={nivel.etiqueta} tono={nivel.tono} />
      {conProbabilidad && <span>{porcentajeRiesgo(riesgo.probabilidad!)}</span>}
    </Box>
  );
}
