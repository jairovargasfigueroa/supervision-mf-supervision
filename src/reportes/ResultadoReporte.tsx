import { useMemo, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { ayudanteColumnas, TablaDatos } from '../compartido/TablaDatos';
import { formatearCantidad, formatearFecha, formatearMonto, formatearPorcentaje } from '../nucleo/formato';
import type { ConsultaReporte, TipoColumna } from './reportes.graphql';

// Resultado de un reporte (503, criterios 8 a 10): conjunto y lo aplicado (para comprobar que se entendió bien),
// el resumen como texto, los avisos y la tabla (hasta 100 filas) con formato según el tipo de cada columna.
// Todo lo que llega se muestra como texto: React lo escapa (el resumen lo redacta un modelo de lenguaje).

/** Aviso de filas recortadas (docs/mensajes.md). */
export const AVISO_TRUNCADO = 'Se muestran las primeras 100 filas';

const NUMERICOS: TipoColumna[] = ['NUMERO', 'MONTO', 'PORCENTAJE'];

/**
 * Valor de una celda para la pantalla: montos con «Bs» y 2 decimales, porcentajes con «%», números con hasta
 * 3 decimales, fechas dd/mm/aaaa, booleanos «Sí»/«No» y nulos «—» (diseño, «mf-supervision»).
 */
export function formatearCelda(valor: string | null, tipo: TipoColumna): string {
  if (valor === null || valor === '') return '—';
  switch (tipo) {
    case 'MONTO':
      return Number.isFinite(Number(valor)) ? formatearMonto(Number(valor)) : valor;
    case 'PORCENTAJE':
      return Number.isFinite(Number(valor)) ? formatearPorcentaje(Number(valor)) : valor;
    case 'NUMERO':
      return Number.isFinite(Number(valor)) ? formatearCantidad(Number(valor)) : valor;
    case 'FECHA':
      return Number.isNaN(Date.parse(valor)) ? valor : formatearFecha(valor);
    case 'BOOLEANO':
      return valor === 'true' ? 'Sí' : valor === 'false' ? 'No' : valor;
    default:
      return valor;
  }
}

/** Valor para ordenar la columna: número en las numéricas, texto en las demás (nulos al final). */
function valorOrden(valor: string | null, tipo: TipoColumna): number | string {
  if (NUMERICOS.includes(tipo)) return valor === null ? Number.NEGATIVE_INFINITY : Number(valor);
  return valor ?? '';
}

type Fila = { indice: number; valores: (string | null)[] };
const columna = ayudanteColumnas<Fila>();

interface Props {
  consulta: ConsultaReporte;
  /** Lo que pidió el usuario: su texto o el título del reporte común. */
  pedido: string;
  /** Botones de exportación. */
  acciones?: ReactNode;
}

export function ResultadoReporte({ consulta, pedido, acciones }: Props) {
  const columnas = useMemo(
    () =>
      consulta.columnas.map((c, i) => {
        const numerica = NUMERICOS.includes(c.tipo);
        return columna.accessor((f) => valorOrden(f.valores[i] ?? null, c.tipo), {
          id: `${i}-${c.clave}`,
          header: c.titulo,
          sortFn: numerica ? 'basic' : 'alphanumeric',
          meta: { numerica },
          cell: ({ row }) => formatearCelda(row.original.valores[i] ?? null, c.tipo),
        });
      }),
    [consulta.columnas],
  );
  const filas = useMemo(() => consulta.filas.map((valores, indice) => ({ indice, valores })), [consulta.filas]);

  return (
    <Box component="section" aria-label="Resultado del reporte">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h2">{consulta.tituloConjunto}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {consulta.totalFilas === 1 ? '1 fila' : `${consulta.totalFilas} filas`}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>{acciones}</Box>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Pedido: {pedido}
      </Typography>
      {consulta.aplicado.length > 0 && (
        <Box component="ul" aria-label="Lo que se aplicó" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 0, m: 0, mb: 2, listStyle: 'none' }}>
          {consulta.aplicado.map((a, i) => (
            <li key={i}>
              <Chip size="small" variant="outlined" label={`${a.nombre}: ${a.valor}`} />
            </li>
          ))}
        </Box>
      )}
      <Typography aria-label="Resumen" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
        {consulta.resumen}
      </Typography>
      {consulta.avisos.map((aviso) => (
        <Alert key={aviso} severity="warning" sx={{ mb: 1 }}>
          {aviso}
        </Alert>
      ))}
      {consulta.truncado && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {AVISO_TRUNCADO}
        </Alert>
      )}
      <TablaDatos etiqueta={`Reporte: ${consulta.tituloConjunto}`} columnas={columnas} filas={filas} idFila={(f) => String(f.indice)} />
    </Box>
  );
}
