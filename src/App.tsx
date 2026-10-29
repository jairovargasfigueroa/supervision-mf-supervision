import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { EstadoVacio } from './compartido/EstadoVacio';

// Pantalla inicial del área hasta que lleguen sus funcionalidades (009)
export function App() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" sx={{ mb: 2 }}>
        Supervisión
      </Typography>
      <Paper variant="outlined">
        <EstadoVacio texto="Aún no hay pantallas en esta área." />
      </Paper>
    </Box>
  );
}
