import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { formatearFechaHora } from '../nucleo/formato';
import type { AtajoReporte, ConsultaReporteCorta, PedidoReporte as Pedido } from './reportes.graphql';

// Últimas 10 consultas del usuario (503, criterio 16): al pulsar una se vuelve a consultar con el mismo texto o el
// mismo reporte común.

/** Cómo terminó una consulta del historial. */
export function textoResultado(c: Pick<ConsultaReporteCorta, 'resultado' | 'totalFilas'>): string {
  if (c.resultado === 'OK') return c.totalFilas === 1 ? '1 fila' : `${c.totalFilas ?? 0} filas`;
  if (c.resultado === 'ERROR') return 'Con error';
  return 'No reconocida';
}

interface Props {
  consultas: ConsultaReporteCorta[] | undefined;
  tituloAtajo: (atajo: AtajoReporte) => string;
  noDisponible?: boolean;
  ocupado?: boolean;
  alElegir: (pedido: Pedido) => void;
}

export function HistorialConsultas({ consultas, tituloAtajo, noDisponible = false, ocupado = false, alElegir }: Props) {
  const lista = () => {
    if (!consultas) {
      return noDisponible ? (
        <Typography sx={{ color: 'text.secondary' }}>No disponible por el momento</Typography>
      ) : null;
    }
    if (consultas.length === 0) {
      return <Typography sx={{ color: 'text.secondary' }}>Aún no hiciste consultas.</Typography>;
    }
    return (
      <List dense disablePadding>
        {consultas.map((c) => {
          const pedido: Pedido | undefined = c.atajo ? { atajo: c.atajo } : c.texto ? { texto: c.texto } : undefined;
          const titulo = c.atajo ? tituloAtajo(c.atajo) : (c.texto ?? '—');
          return (
            <ListItemButton
              key={c.id}
              disabled={ocupado || !pedido}
              onClick={() => pedido && alElegir(pedido)}
              sx={{ borderRadius: 1, alignItems: 'flex-start' }}
            >
              <ListItemText
                primary={titulo}
                secondary={`${formatearFechaHora(c.creadaEn)} · ${textoResultado(c)}`}
                slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    );
  };

  return (
    <Box component="section" aria-label="Últimas consultas">
      <Typography variant="h2" sx={{ mb: 1 }}>
        Últimas consultas
      </Typography>
      {lista()}
    </Box>
  );
}
