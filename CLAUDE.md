# ERP · Microfrontend Supervisión

Microfrontend del ERP para supervisión: tablero de obras (base) y, en la capa 5, resumen de los agentes y reportes por voz.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** Native Federation configurado, tema MUI dentro del Shadow DOM, `formato.ts`, estados vacío y error, y lectura de la sesión del shell (`nucleo/sesion.ts`, `nucleo/configuracion.ts`; sin shell muestra «Abre esta pantalla desde el ERP») (fase 1); tablero de obras con Apollo Client y TanStack Router/Table (009). No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- Node 24 · React 19 · TypeScript 6
- Native Federation 4 con el **adaptador esbuild** (`@softarc/native-federation` 4.7 + `@softarc/native-federation-esbuild` 4.2) y su preset oficial de React
- Apollo Client 4 (GraphQL hacia el gateway, `nucleo/apollo.ts` con el token del shell); previsto: capa 3: voz a texto en el navegador (Whisper); capa 5: exportar a Excel
- Puerto: `4203` (`PORT`)

## Comandos

```sh
npm install
npm start            # recompila al guardar y sirve en http://localhost:4203 (recargar el navegador a mano)
npm run build        # genera dist/ con remoteEntry.json
npm run typecheck
npm test             # Vitest
```

`http://localhost:4203` abre `public/index.html`, una página para probar el microfrontend sin el shell.

## Cómo se integra

- `src/bootstrap.tsx` registra el Web Component `<mf-supervision>` (con Shadow DOM) y monta React dentro.
- `federation.config.js` expone `./Bootstrap`; el shell lo carga y luego usa la etiqueta `<mf-supervision>`.
- `build.mjs` compila con `runEsBuildBuilder` y, con `--dev`, sirve `dist/` y `public/` con CORS abierto para el shell.
- Los estilos van dentro del Shadow DOM; no se cargan hojas globales.

## Estructura

Ver `docs/estructura.md` (obligatorio): `bootstrap.tsx` (Web Component con Shadow DOM, caché de Emotion y tema), `nucleo/` (sesión, configuración, formato), `compartido/` y una carpeta por área (`tablero/`; en la capa 5 `agentes/` y `reportes-voz/`).

## Reglas del proyecto

- Solo habla con el gateway GraphQL.
- Recibe la sesión del shell; no inicia sesión por su cuenta.
- Las sugerencias de los agentes solo se ejecutan si una persona las aprueba.
- La voz se transcribe en el navegador; al servidor solo llega el texto.

## Documentación

- `docs/estructura.md`: **librerías permitidas y estructura exacta de carpetas y archivos. Obligatorio leerlo antes de escribir código.**
- `docs/app.md`: pantallas y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(tablero): agrega resumen de obras`). Sin coautoría ni firmas de la IA.

Git Flow: ramas `feat/`, `fix/`, `docs/`… desde `develop`, que entran por *pull request*; nunca hagas *push* a `main` ni a `develop` (están protegidas). El agente crea y fusiona los PR (merge normal, sin squash) hacia `develop` cuando todas las pruebas pasan. Detalle y definición de terminado: `docs/flujo-trabajo.md` del repo `supervision-docs`.
