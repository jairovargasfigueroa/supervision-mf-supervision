import Chip from '@mui/material/Chip';

export type TonoEstado = 'exito' | 'atencion' | 'error' | 'neutro';

const PALETA: Record<TonoEstado, { fondo: string; texto: string }> = {
  exito: { fondo: 'success.light', texto: 'success.main' },
  atencion: { fondo: 'warning.light', texto: 'warning.main' },
  error: { fondo: 'error.light', texto: 'error.main' },
  neutro: { fondo: 'primary.light', texto: 'text.secondary' },
};

interface Props {
  etiqueta: string;
  tono: TonoEstado;
}

// Estado del dominio como chip: fondo suave y texto del color fuerte (docs/diseno-visual.md)
export function EstadoChip({ etiqueta, tono }: Props) {
  const { fondo, texto } = PALETA[tono];
  return <Chip label={etiqueta} size="small" data-tono={tono} sx={{ bgcolor: fondo, color: texto, fontWeight: 600 }} />;
}
