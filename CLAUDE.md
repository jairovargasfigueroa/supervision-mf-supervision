# ERP · Microfrontend Supervisión

Microfrontend del ERP para supervisión: tablero de obras (base) y, en la capa 5, resumen de los agentes y reportes por voz.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** proyecto creado con Native Federation configurado, sin pantallas. No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- Node 24 · React 19 · TypeScript 6
- Native Federation 4 con el **adaptador esbuild** (`@softarc/native-federation` 4.7 + `@softarc/native-federation-esbuild` 4.2) y su preset oficial de React
- Previsto: Apollo Client 4 (GraphQL hacia el gateway); capa 3: voz a texto en el navegador (Whisper); capa 5: exportar a Excel
- Puerto: `4203` (`PORT`)

## Comandos

```sh
npm install
npm start            # recompila al guardar y sirve en http://localhost:4203 (recargar el navegador a mano)
npm run build        # genera dist/ con remoteEntry.json
npm run typecheck
```

`http://localhost:4203` abre `public/index.html`, una página para probar el microfrontend sin el shell.

## Cómo se integra

- `src/bootstrap.tsx` registra el Web Component `<mf-supervision>` (con Shadow DOM) y monta React dentro.
- `federation.config.js` expone `./Bootstrap`; el shell lo carga y luego usa la etiqueta `<mf-supervision>`.
- `build.mjs` compila con `runEsBuildBuilder` y, con `--dev`, sirve `dist/` y `public/` con CORS abierto para el shell.
- Los estilos van dentro del Shadow DOM; no se cargan hojas globales.

## Estructura prevista

```
src/
  bootstrap.tsx   Web Component (no tocar salvo para pasar propiedades del shell)
  App.tsx
  tablero/        resumen de obras (base)
  agentes/        informes y sugerencias para aprobar (capa 5)
  reportes-voz/   consulta por voz, tabla y exportar a Excel (capa 5)
```

## Reglas del proyecto

- Solo habla con el gateway GraphQL.
- Recibe la sesión del shell; no inicia sesión por su cuenta.
- Las sugerencias de los agentes solo se ejecutan si una persona las aprueba.
- La voz se transcribe en el navegador; al servidor solo llega el texto.

## Documentación

- `docs/app.md`: pantallas y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(tablero): agrega resumen de obras`). Sin coautoría ni firmas de la IA.
