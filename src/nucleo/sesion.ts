import { useEffect, useState } from 'react';
import type { AlmacenPlataforma, ConexionPlataforma } from './conexion';

// Sesión que publica el shell del ERP en window.plataforma (docs/convenciones.md,
// «Sesión dentro del ERP»). El microfrontend nunca habla con Keycloak.

export interface UsuarioSesion {
  id: string;
  nombre: string;
  roles: string[];
}

export interface SesionPlataforma {
  usuario: UsuarioSesion;
  obtenerToken(): Promise<string>; // token vigente (lo renueva el shell); en modo sin conexión rechaza con Error('SIN_CONEXION')
  cerrarSesion(): void;
  /** 104: la sesión se recuperó del equipo sin conexión (`obtenerToken()` rechaza). */
  sinConexion?: boolean;
}

export interface Plataforma {
  sesion?: SesionPlataforma;
  configuracion: { gatewayUrl: string };
  /** 104: estado de la conexión que decide el shell. */
  conexion?: ConexionPlataforma;
  /** 104: almacén local del shell (IndexedDB, separado por usuario). */
  almacen?: AlmacenPlataforma;
}

declare global {
  interface Window {
    plataforma?: Plataforma;
  }
}

/** Evento que emite el shell en window cuando la sesión cambia (token renovado o sesión cerrada) */
export const EVENTO_SESION = 'plataforma:sesion';

/** Sesión actual del shell, o `undefined` si el microfrontend se abrió solo o no hay sesión */
export function obtenerSesion(): SesionPlataforma | undefined {
  return window.plataforma?.sesion;
}

/** Token vigente para llamar al gateway; falla si no hay sesión del shell */
export function obtenerToken(): Promise<string> {
  const sesion = obtenerSesion();
  if (!sesion) return Promise.reject(new Error('No hay sesión del ERP'));
  return sesion.obtenerToken();
}

/** Sesión actual; vuelve a leerla cada vez que el shell emite `plataforma:sesion` */
export function useSesion(): SesionPlataforma | undefined {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const alCambiar = () => setVersion((v) => v + 1);
    window.addEventListener(EVENTO_SESION, alCambiar);
    return () => window.removeEventListener(EVENTO_SESION, alCambiar);
  }, []);

  return obtenerSesion();
}
