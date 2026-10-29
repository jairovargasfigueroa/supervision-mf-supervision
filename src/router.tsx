import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  type RouterHistory,
} from '@tanstack/react-router';
import { EstadoVacio } from './compartido/EstadoVacio';
import { TableroPagina } from './tablero/TableroPagina';

// Rutas internas del microfrontend (docs/estructura.md). El shell deja /supervision/** a este microfrontend;
// el router usa basepath /supervision y su pantalla inicial es el tablero (009).

function Area() {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Outlet />
    </Box>
  );
}

function NoEncontrada() {
  const navegar = useNavigate();
  return (
    <Paper variant="outlined">
      <EstadoVacio
        texto="No encontramos lo que buscas. Puede que ya no exista o que no tengas acceso."
        accion={{ etiqueta: 'Ir al tablero', alPulsar: () => void navegar({ to: '/' }) }}
      />
    </Paper>
  );
}

const raiz = createRootRoute({ component: Area, notFoundComponent: NoEncontrada });
const tablero = createRoute({ getParentRoute: () => raiz, path: '/', component: TableroPagina });

const arbol = raiz.addChildren([tablero]);

/** Crea el router del área; en pruebas recibe un historial en memoria. */
export function crearRouter(historial: RouterHistory = createBrowserHistory()) {
  return createRouter({ routeTree: arbol, history: historial, basepath: '/supervision' });
}

export type RouterSupervision = ReturnType<typeof crearRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: RouterSupervision;
  }
}
