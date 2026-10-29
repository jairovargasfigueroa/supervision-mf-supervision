import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface Props {
  alReintentar: () => void;
}

// Estado de error de una sección cuyo servicio no responde
export function EstadoError({ alReintentar }: Props) {
  return (
    <Box role="alert" sx={{ py: 6, px: 3, textAlign: 'center' }}>
      <Typography sx={{ color: 'text.secondary' }}>No disponible por el momento.</Typography>
      <Button variant="outlined" sx={{ mt: 2 }} onClick={alReintentar}>
        Reintentar
      </Button>
    </Box>
  );
}
