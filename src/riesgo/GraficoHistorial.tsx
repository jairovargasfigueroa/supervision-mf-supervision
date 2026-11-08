import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { formatearFecha } from '../nucleo/formato';
import { porcentajeRiesgo } from './ChipRiesgo';
import type { PuntoRiesgo } from './riesgo.graphql';

// Gráfico de línea del historial de la probabilidad de retraso (402, criterio 8), con SVG propio (sin librería de
// gráficos; decisión del equipo). Eje vertical de 0 a 100 %, líneas punteadas en los umbrales MEDIO y ALTO y un punto
// por cálculo, del más antiguo al más reciente.

const ANCHO = 600;
const ALTO = 200;
const MARGEN = { izquierda: 44, derecha: 16, arriba: 12, abajo: 28 };

export interface PuntoGrafico {
  x: number;
  y: number;
  etiqueta: string;
}

/** Posición de cada punto en el dibujo; con un solo punto queda al centro. */
export function puntosGrafico(historial: PuntoRiesgo[]): PuntoGrafico[] {
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const paso = historial.length > 1 ? anchoUtil / (historial.length - 1) : 0;
  return historial.map((punto, i) => ({
    x: historial.length > 1 ? MARGEN.izquierda + i * paso : MARGEN.izquierda + anchoUtil / 2,
    y: MARGEN.arriba + (1 - Math.min(1, Math.max(0, punto.probabilidad))) * altoUtil,
    etiqueta: `${formatearFecha(punto.calculadaEn)}: ${porcentajeRiesgo(punto.probabilidad)}`,
  }));
}

function yDe(probabilidad: number): number {
  return MARGEN.arriba + (1 - probabilidad) * (ALTO - MARGEN.arriba - MARGEN.abajo);
}

interface Props {
  historial: PuntoRiesgo[];
  /** Nombre de la obra, para lectores de pantalla. */
  obra: string;
  umbralMedio?: number;
  umbralAlto?: number;
}

export function GraficoHistorial({ historial, obra, umbralMedio = 0.3, umbralAlto = 0.6 }: Props) {
  const { palette } = useTheme();
  const borde = palette.divider;
  const secundario = palette.text.secondary;
  const linea = palette.primary.main;
  if (historial.length === 0) {
    return (
      <Typography sx={{ color: 'text.secondary', py: 2 }}>Todavía no hay cálculos del riesgo de esta obra.</Typography>
    );
  }
  const puntos = puntosGrafico(historial);
  const primero = historial[0];
  const ultimo = historial[historial.length - 1];
  const ejes = [0, umbralMedio, umbralAlto, 1];

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={`Historial del riesgo de ${obra}: ${historial.length} ${historial.length === 1 ? 'cálculo' : 'cálculos'}`}
        style={{ display: 'block', minWidth: 320, fontFamily: 'inherit' }}
      >
        {ejes.map((valor) => (
          <g key={valor}>
            <line
              x1={MARGEN.izquierda}
              x2={ANCHO - MARGEN.derecha}
              y1={yDe(valor)}
              y2={yDe(valor)}
              stroke={borde}
              strokeDasharray={valor === umbralMedio || valor === umbralAlto ? '4 4' : undefined}
            />
            <text x={MARGEN.izquierda - 6} y={yDe(valor) + 4} textAnchor="end" fontSize="11" fill={secundario}>
              {porcentajeRiesgo(valor)}
            </text>
          </g>
        ))}
        {puntos.length > 1 && (
          <polyline
            data-testid="linea-historial"
            points={puntos.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={linea}
            strokeWidth="2"
          />
        )}
        {puntos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={linea}>
            <title>{p.etiqueta}</title>
          </circle>
        ))}
        <text x={MARGEN.izquierda} y={ALTO - 8} fontSize="11" fill={secundario}>
          {formatearFecha(primero.calculadaEn)}
        </text>
        {historial.length > 1 && (
          <text x={ANCHO - MARGEN.derecha} y={ALTO - 8} textAnchor="end" fontSize="11" fill={secundario}>
            {formatearFecha(ultimo.calculadaEn)}
          </text>
        )}
      </svg>
    </Box>
  );
}
