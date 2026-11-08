// Navegación hacia otra área del ERP (docs/estructura.md, «Rutas»): el shell de Angular decide qué microfrontend
// muestra según la dirección. Se cambia la dirección con pushState y se avisa con popstate, que el router del shell
// escucha; el microfrontend no conoce las rutas internas del shell más allá de la dirección pública.

/** Lleva a una dirección del ERP fuera de esta área, por ejemplo `/obras/<id>`. */
export function irAlErp(ruta: string): void {
  window.history.pushState(null, '', ruta);
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
}

/** Dirección del detalle de una obra en el área Obras (009, criterio 4). */
export function rutaDetalleObra(obraId: string): string {
  return `/obras/${encodeURIComponent(obraId)}`;
}
