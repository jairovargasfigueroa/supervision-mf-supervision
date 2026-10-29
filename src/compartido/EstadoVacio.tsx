import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface Props {
  texto: string;
  accion?: { etiqueta: string; alPulsar: () => void };
}

// Estado vacío de un área: texto y, si corresponde, la acción para empezar
export function EstadoVacio({ texto, accion }: Props) {
  return (
    <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
      <Typography sx={{ color: 'text.secondary' }}>{texto}</Typography>
      {accion && (
        <Button variant="contained" sx={{ mt: 2 }} onClick={accion.alPulsar}>
          {accion.etiqueta}
        </Button>
      )}
    </Box>
  );
}
