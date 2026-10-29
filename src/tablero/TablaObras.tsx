import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SortingState } from '@tanstack/react-table';
import { EstadoChip, type TonoEstado } from '../compartido/EstadoChip';
import { EstadoVacio } from '../compartido/EstadoVacio';
import { ayudanteColumnas, TablaDatos } from '../compartido/TablaDatos';
import { formatearCantidad, formatearPorcentaje } from '../nucleo/formato';
import type { EstadoPlanilla, FilaTablero } from './tablero.graphql';

// Tabla de obras en ejecución del tablero (009, criterios 2 a 4): se abre ordenada por diferencia
// (plazo − avance) de mayor a menor y se puede ordenar por cualquier columna.

/** Estado de la planilla como chip (docs/diseno-visual.md, «Estados del dominio → color»). */
export const PLANILLA: Record<EstadoPlanilla, { etiqueta: string; tono: TonoEstado }> = {
  BORRADOR: { etiqueta: 'Borrador', tono: 'neutro' },
  PRESENTADA: { etiqueta: 'Presentada', tono: 'atencion' },
  APROBANDO: { etiqueta: 'En aprobación', tono: 'atencion' },
  APROBADA: { etiqueta: 'Aprobada', tono: 'exito' },
  OBSERVADA: { etiqueta: 'Observada', tono: 'error' },
};

export const ORDEN_INICIAL: SortingState = [{ id: 'diferencia', desc: true }];

const columna = ayudanteColumnas<FilaTablero>();

interface Props {
  filas: FilaTablero[];
  /** Abre el detalle de la obra (criterio 4). */
  alPulsarObra?: (fila: FilaTablero) => void;
  /** Aviso de las celdas de materiales bajos que llegaron sin dato (criterio 5). */
  avisoMateriales?: string;
}

export function TablaObras({ filas, alPulsarObra, avisoMateriales }: Props) {
  const columnas = useMemo(
    () => [
      columna.accessor('nombre', {
        header: 'Obra',
        sortFn: 'text',
        cell: ({ getValue }) => <Typography sx={{ fontWeight: 500 }}>{getValue()}</Typography>,
      }),
      columna.accessor('avancePct', {
        header: 'Avance',
        sortFn: 'basic',
        meta: { numerica: true },
        cell: ({ getValue }) => formatearPorcentaje(getValue()),
      }),
      columna.accessor('plazoPct', {
        header: 'Plazo',
        sortFn: 'basic',
        meta: { numerica: true },
        cell: ({ getValue }) => formatearPorcentaje(getValue()),
      }),
      columna.accessor('diferencia', {
        header: 'Diferencia',
        sortFn: 'basic',
        meta: { numerica: true },
        // Puntos de porcentaje (plazo − avance), con el mismo formato que avance y plazo
        cell: ({ getValue }) => formatearPorcentaje(getValue()),
      }),
      // Sin dato de Materiales la fila va al final al ordenar de mayor a menor
      columna.accessor((f) => f.materialesBajos ?? -1, {
        id: 'materialesBajos',
        header: 'Materiales bajos',
        sortFn: 'basic',
        meta: { numerica: true },
        cell: ({ row: { original: f } }) =>
          f.materialesBajos === null ? (
            <Box component="span" title={avisoMateriales} aria-label={avisoMateriales}>
              —
            </Box>
          ) : (
            formatearCantidad(f.materialesBajos)
          ),
      }),
      columna.accessor((f) => f.ultimaPlanilla?.periodo ?? '', {
        id: 'ultimaPlanilla',
        header: 'Última planilla',
        sortFn: 'alphanumeric',
        cell: ({ row: { original: f } }) =>
          f.ultimaPlanilla ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
              <span>{f.ultimaPlanilla.periodo}</span>
              <EstadoChip {...PLANILLA[f.ultimaPlanilla.estado]} />
            </Box>
          ) : (
            <Typography component="span" sx={{ color: 'text.secondary' }}>
              Sin planillas
            </Typography>
          ),
      }),
      columna.accessor((f) => (f.enRiesgo ? 1 : 0), {
        id: 'enRiesgo',
        header: 'Riesgo',
        sortFn: 'basic',
        cell: ({ row: { original: f } }) => (f.enRiesgo ? <EstadoChip etiqueta="En riesgo" tono="atencion" /> : null),
      }),
    ],
    [avisoMateriales],
  );

  return (
    <TablaDatos
      etiqueta="Obras en ejecución"
      columnas={columnas}
      filas={filas}
      idFila={(f) => f.obraId}
      ordenInicial={ORDEN_INICIAL}
      alPulsarFila={alPulsarObra}
      etiquetaFila={alPulsarObra && ((f) => `Abrir ${f.nombre}`)}
      vacio={<EstadoVacio texto="Aún no hay obras en ejecución." />}
    />
  );
}
