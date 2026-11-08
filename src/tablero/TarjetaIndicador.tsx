import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface Props {
  titulo: string;
  /** Cifra principal; `null` si su servicio no respondió (se muestra «—»). */
  valor: string | null;
  /** Línea de ayuda bajo la cifra (por ejemplo, el monto de los cobros vencidos). */
  detalle?: string;
  /** Aviso cuando falta el dato: «Datos de Finanzas no disponibles» (009, criterio 5). */
  aviso?: string;
  /** Color de la cifra cuando pide atención (obras en riesgo, materiales bajos, cobros vencidos). */
  tono?: 'error' | 'atencion';
}

// Tarjeta de un indicador del tablero (009, criterio 1): título, cifra grande y una línea de ayuda.
export function TarjetaIndicador({ titulo, valor, detalle, aviso, tono }: Props) {
  const ayuda = valor === null ? aviso : detalle;
  const color = valor === null || !tono ? 'text.primary' : tono === 'error' ? 'error.main' : 'warning.main';
  return (
    <Paper variant="outlined" role="group" aria-label={titulo} sx={{ p: 2 }}>
      <Typography
        variant="caption"
        component="h2"
        sx={{ display: 'block', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}
      >
        {titulo}
      </Typography>
      <Typography
        sx={{
          fontSize: '2rem',
          fontWeight: 600,
          lineHeight: 1.3,
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontVariantNumeric: 'tabular-nums',
          color,
        }}
      >
        {valor ?? '—'}
      </Typography>
      {ayuda && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {ayuda}
        </Typography>
      )}
    </Paper>
  );
}
