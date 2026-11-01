import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Vista «Agentes» (502, criterio 16): una tarjeta por agente, las sugerencias para aprobar o rechazar y, para
// `admin` y `gerente`, el historial de ejecuciones con el detalle de sus pasos. Aprobar solo registra la decisión.

export function AgentesPagina() {
  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 2 }}>
        Agentes
      </Typography>
    </Box>
  );
}
