import { useEffect, useState } from 'react';

// Conexión y almacén local que publica el shell del ERP (104, docs/convenciones.md «Sesión dentro del ERP»).
// El microfrontend no usa IndexedDB, localStorage ni service workers propios: usa lo que publica el shell.
// Abierto solo para desarrollar (sin shell) se trabaja como antes: siempre en línea y sin guardar nada.

/** `window.plataforma.conexion`: el shell decide cuándo se está sin conexión. */
export interface ConexionPlataforma {
  enLinea: boolean;
  /** Avisa al shell que una consulta falló por la red; el shell vuelve a comprobar con el gateway. */
  reportarFallo(): void;
}

/**
 * `window.plataforma.almacen`: el shell agrega el prefijo del usuario a cada clave. También guarda los
 * borradores de planilla (los usa mf-obras); este microfrontend solo usa las consultas.
 */
export interface AlmacenPlataforma {
  guardarConsulta(clave: string, datos: unknown): Promise<void>;
  leerConsulta<T>(clave: string): Promise<{ datos: T; guardadoEn: string } | null>;
}

/** Evento que emite el shell en window cada vez que cambia la conexión (`detail: { enLinea }`). */
export const EVENTO_CONEXION = 'plataforma:conexion';

/** Si hay conexión según el shell; sin shell (desarrollo) siempre en línea. */
export function estaEnLinea(): boolean {
  return window.plataforma?.conexion?.enLinea ?? true;
}

/** Almacén local del shell, o `undefined` si el microfrontend se abrió solo. */
export function obtenerAlmacen(): AlmacenPlataforma | undefined {
  return window.plataforma?.almacen;
}

/** Avisa al shell de un fallo de red (si hay shell). */
export function reportarFalloConexion(): void {
  window.plataforma?.conexion?.reportarFallo();
}

/** Estado de la conexión; se actualiza con el evento `plataforma:conexion`. */
export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(estaEnLinea);

  useEffect(() => {
    const alCambiar = (evento: Event) => {
      const detalle = (evento as CustomEvent<{ enLinea?: unknown } | null>).detail;
      setEnLinea(typeof detalle?.enLinea === 'boolean' ? detalle.enLinea : estaEnLinea());
    };
    // Por si cambió entre el primer dibujo y la suscripción
    setEnLinea(estaEnLinea());
    window.addEventListener(EVENTO_CONEXION, alCambiar);
    return () => window.removeEventListener(EVENTO_CONEXION, alCambiar);
  }, []);

  return enLinea;
}
