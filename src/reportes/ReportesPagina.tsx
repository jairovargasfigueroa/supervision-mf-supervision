import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Pantalla «Reportes» (503): pedir un reporte hablando o escribiendo, o con un reporte común; ver el resumen y la
// tabla, y exportarlo a Excel o CSV. Solo `admin` y `gerente` (la ruta la protege router.tsx).

export function ReportesPagina() {
  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 2 }}>
        Reportes
      </Typography>
    </Box>
  );
}
