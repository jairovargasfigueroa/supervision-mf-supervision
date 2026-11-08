import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { ReactNode } from 'react';
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
import { AgentesPagina } from './agentes/AgentesPagina';
import { EstadoVacio } from './compartido/EstadoVacio';
import { puedeUsarReportes, useRoles } from './nucleo/permisos';
import { ReportesPagina } from './reportes/ReportesPagina';
import { RiesgoPagina } from './riesgo/RiesgoPagina';
import { TableroPagina } from './tablero/TableroPagina';

// Rutas internas del microfrontend (docs/estructura.md). El shell deja /supervision/** a este microfrontend;
// el router usa basepath /supervision y su pantalla inicial es el tablero (009). /supervision/riesgo es la
// pantalla «Riesgo de retraso» (402), /supervision/agentes la de «Agentes» (502) y /supervision/reportes la de
// «Reportes» (503, solo admin y gerente), con sus enlaces en el menú interno. Cada sección dice qué roles la ven:
// sin permiso no aparece en el menú y, si se abre por la dirección, muestra el aviso de permiso.

interface Seccion {
  ruta: string;
  etiqueta: string;
  /** Sin esto, la ven todos los roles del área (admin, gerente y residente). */
  permitido?: (roles: readonly string[]) => boolean;
}

export const SECCIONES: readonly Seccion[] = [
  { ruta: '/', etiqueta: 'Tablero' },
  { ruta: '/riesgo', etiqueta: 'Riesgo de retraso' },
  { ruta: '/agentes', etiqueta: 'Agentes' },
  { ruta: '/reportes', etiqueta: 'Reportes', permitido: puedeUsarReportes },
];

/** Secciones del menú interno que ve el usuario. */
export function seccionesVisibles(roles: readonly string[]): Seccion[] {
  return SECCIONES.filter((s) => !s.permitido || s.permitido(roles));
}

function Area() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const ruta = pathname.replace(/\/$/, '') || '/';
  const secciones = seccionesVisibles(useRoles());
  const actual = secciones.find((s) => s.ruta === ruta)?.ruta ?? false;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Tabs
        value={actual}
        onChange={(_, destino: string) => void navegar({ to: destino })}
        aria-label="Secciones de supervisión"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {secciones.map((s) => (
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


/** Pantalla solo para algunos roles: si no le corresponde, el aviso de permiso (docs/mensajes.md, SIN_PERMISO). */
function ConPermiso({ permitido, children }: { permitido: (roles: readonly string[]) => boolean; children: ReactNode }) {
  const roles = useRoles();
  if (permitido(roles)) return <>{children}</>;
  return (
    <Paper variant="outlined">
      <EstadoVacio texto="No tienes permiso para hacer esta acción." />
    </Paper>
  );
}

const reportes = createRoute({
  getParentRoute: () => raiz,
  path: '/reportes',
  component: () => (
    <ConPermiso permitido={puedeUsarReportes}>
      <ReportesPagina />
    </ConPermiso>
  ),
});

const agentes = createRoute({ getParentRoute: () => raiz, path: '/agentes', component: AgentesPagina });

const arbol = raiz.addChildren([tablero, riesgo, agentes, reportes]);

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
