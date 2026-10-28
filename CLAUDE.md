# ERP · Microfrontend Supervisión

Microfrontend del ERP para supervisión: tablero de obras (base) y, en la capa 5, resumen de los agentes y reportes por voz.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** solo documentación. El proyecto del framework todavía no se generó (tarea de la fase 1 del plan general). No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- Angular o Vue **[por decidir]** · expuesto por Module Federation
- Cliente GraphQL hacia el gateway
- Capa 3: voz a texto en el navegador (Whisper) · Capa 5: exportar a Excel

## Comandos

Se completan al generar el proyecto.

## Estructura prevista

```
src/
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

- `docs/app.md`: qué hace, pantallas o responsabilidades, y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(alcance): descripción`). Sin coautoría ni firmas de la IA.
