# ERP · Microfrontend Supervisión: estructura y librerías

Misma estructura, librerías, tema y reglas que `mf-materiales` (ver su `docs/estructura.md`; si no lo tienes, la copia resumida está abajo), con estas diferencias:

- Web Component `<mf-supervision>`, `basepath: '/supervision'`, puerto 4203.
- Carpetas de área: `tablero/` (base), `riesgo/` (capa 4), `agentes/` y `reportes-voz/` (capa 5), `dictado/` (capa 3, componente reutilizable).
- Capa 5: exportar a Excel con SheetJS (según su spec).

## Copia resumida

React 19 · MUI 9 con `@emotion/cache` dentro del Shadow DOM y `tema.ts` (primario `#0E4D5C`, secundario `#F08A24`, éxito `#1B7343`, atención `#9A4A00`, error `#B42318`, fondo `#F2F5F6`, radio 10, Inter) · TanStack Router (rutas en código), Table y Form + Zod · Apollo Client 4 · Vitest + Testing Library.

```
src/
  bootstrap.tsx, App.tsx, tema.ts, router.tsx
  nucleo/       sesion.ts, apollo.ts, errores.ts, formato.ts
  tablero/      TableroPagina.tsx, TarjetaIndicador.tsx, TablaObras.tsx, tablero.graphql.ts
  compartido/   TablaDatos.tsx, EstadoChip.tsx, EstadoVacio.tsx, EstadoError.tsx
```
