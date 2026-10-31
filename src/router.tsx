import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useLocation,
  useNavigate,
  type RouterHistory,
} from '@tanstack/react-router';
import { EstadoVacio } from './compartido/EstadoVacio';
import { RiesgoPagina } from './riesgo/RiesgoPagina';
import { TableroPagina } from './tablero/TableroPagina';

// Rutas internas del microfrontend (docs/estructura.md). El shell deja /supervision/** a este microfrontend;
// el router usa basepath /supervision y su pantalla inicial es el tablero (009). /supervision/riesgo es la
// pantalla «Riesgo de retraso» (402), con su enlace en el menú interno.

export const SECCIONES = [
  { ruta: '/', etiqueta: 'Tablero' },
  { ruta: '/riesgo', etiqueta: 'Riesgo de retraso' },
] as const;

function Area() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const ruta = pathname.replace(/\/$/, '') || '/';
  const actual = SECCIONES.find((s) => s.ruta === ruta)?.ruta ?? false;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Tabs
        value={actual}
        onChange={(_, destino: string) => void navegar({ to: destino })}
        aria-label="Secciones de supervisión"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {SECCIONES.map((s) => (
          <Tab key={s.ruta} value={s.ruta} label={s.etiqueta} />
        ))}
      </Tabs>
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
const riesgo = createRoute({ getParentRoute: () => raiz, path: '/riesgo', component: RiesgoPagina });

const arbol = raiz.addChildren([tablero, riesgo]);

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
