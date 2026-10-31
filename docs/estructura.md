# ERP · Microfrontend Supervisión: estructura y librerías

Misma estructura, librerías, tema y reglas que `mf-materiales` (ver su `docs/estructura.md`; si no lo tienes, la copia resumida está abajo), con estas diferencias:

- Web Component `<mf-supervision>`, `basepath: '/supervision'`, puerto 4203.
- Carpetas de área: `tablero/` (base), `riesgo/` (capa 4), `agentes/` y `reportes-voz/` (capa 5), `dictado/` (capa 3, componente reutilizable).
- Capa 5: exportar a Excel con SheetJS (según su spec).

## Copia resumida

React 19 · MUI 9 con `@emotion/cache` dentro del Shadow DOM y `tema.ts` (primario `#0E4D5C`, secundario `#F08A24`, éxito `#1B7343`, atención `#9A4A00`, error `#B42318`, fondo `#F2F5F6`, radio 10, Inter) · TanStack Router (rutas en código), Table y Form + Zod · Apollo Client 4 · Vitest + Testing Library (entorno `jsdom`, `vitest.config.ts`; `npm test`; cada prueba junto a su archivo).

```
src/
  bootstrap.tsx, App.tsx, tema.ts, router.tsx
  nucleo/       sesion.ts, configuracion.ts, apollo.ts, errores.ts, formato.ts, permisos.ts, navegacion.ts,
                conexion.ts, consulta-respaldo.ts
  tablero/      TableroPagina.tsx, TarjetaIndicador.tsx, TablaObras.tsx, tablero.graphql.ts, datos-parciales.ts
  riesgo/       RiesgoPagina.tsx, ChipRiesgo.tsx (nivel del modelo como chip y porcentaje), GraficoHistorial.tsx
                (SVG propio), PanelModelo.tsx («Sobre el modelo»), riesgo.graphql.ts (402)
  compartido/   TablaDatos.tsx, EstadoChip.tsx, EstadoVacio.tsx, EstadoError.tsx, AvisoSinConexion.tsx
```

- `nucleo/conexion.ts` y `nucleo/consulta-respaldo.ts` (104): iguales que en mf-materiales; `useConsultaConRespaldo` pide a la red con `network-only` y guarda la respuesta completa en el almacén del shell; sin conexión o ante un fallo de red muestra lo guardado. `compartido/AvisoSinConexion.tsx`: «Sin conexión · datos del dd/mm/aaaa hh:mm» o «No hay datos guardados de esta pantalla».

- `nucleo/permisos.ts`: roles efectivos del ERP (solo los internos) y qué ve cada rol (cobros vencidos: `admin` y `gerente`).
- `nucleo/navegacion.ts`: ir a otra área del ERP (`pushState` + `popstate`, por ejemplo `/obras/:id`).
- `tablero/datos-parciales.ts`: qué partes del tablero llegaron y el aviso «Datos de {servicio} no disponibles» de las que faltan.
- `compartido/TablaDatos.tsx`: TanStack Table dibujada con la Table de MUI; orden inicial, filas pulsables (clic o Enter) y, debajo de 600 px, desplazamiento horizontal con la primera columna fija.

## Rutas

TanStack Router con `createBrowserHistory()` y `basepath: '/supervision'`: `/supervision` es el tablero (009) y `/supervision/riesgo` el riesgo de retraso (402), con pestañas «Tablero» y «Riesgo de retraso» como menú interno (`SECCIONES` de `router.tsx`); cualquier otra ruta muestra el aviso con «Ir al tablero». El historial del navegador de TanStack intercepta `pushState`; `App.tsx` lo destruye al desmontar. Para ir a otra área se usa `irAlErp()` de `nucleo/navegacion.ts`.
