import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ApolloProvider } from '@apollo/client/react';
import { EstadoVacio } from './compartido/EstadoVacio';
import { obtenerClienteApollo } from './nucleo/apollo';
import { useSesion } from './nucleo/sesion';

// Raíz del área: cliente GraphQL con el token del shell. Sin la sesión del shell (abierto solo en su puerto)
// solo muestra el aviso.
export function App() {
  const sesion = useSesion();

  if (!sesion) {
    return <EstadoVacio texto="Abre esta pantalla desde el ERP" />;
  }

  return (
    <ApolloProvider client={obtenerClienteApollo()}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Supervisión
        </Typography>
        <Paper variant="outlined">
          <EstadoVacio texto="Aún no hay pantallas en esta área." />
        </Paper>
      </Box>
    </ApolloProvider>
  );
}
