import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import type { ResultadoConRespaldo } from '../nucleo/consulta-respaldo';
import { formatearFechaHora } from '../nucleo/formato';

interface Props {
  consulta: Pick<ResultadoConRespaldo<unknown>, 'desdeEquipo' | 'guardadoEn' | 'sinDatosGuardados'>;
}

/** «Sin conexión · datos del dd/mm/aaaa hh:mm» (hora de La Paz). */
export function textoDatosGuardados(guardadoEn: string): string {
  return `Sin conexión · datos del ${formatearFechaHora(guardadoEn)}`;
}

// Aviso común de las pantallas con respaldo en el equipo (104, criterio 8): datos guardados y de cuándo,
// o que la pantalla nunca se abrió en este equipo. Nada si los datos vienen de la red.
export function AvisoSinConexion({ consulta }: Props) {
  if (consulta.sinDatosGuardados) {
    return (
      <Box role="status" sx={{ py: 6, px: 3, textAlign: 'center', color: 'text.secondary' }}>
        <CloudOffOutlinedIcon sx={{ mb: 1 }} />
        <Typography sx={{ color: 'text.secondary' }}>No hay datos guardados de esta pantalla</Typography>
      </Box>
    );
  }
  if (consulta.desdeEquipo && consulta.guardadoEn) {
    return (
      <Alert role="status" severity="warning" icon={<CloudOffOutlinedIcon fontSize="inherit" />}>
        {textoDatosGuardados(consulta.guardadoEn)}
      </Alert>
    );
  }
  return null;
}
