# 503 · Reportes por voz · tareas de `frontend/mf-supervision`

Requisitos y diseño: `docs/specs/503-reportes-voz/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto. Usa el componente de dictado de la 302 (`src/dictado/CampoDictado.tsx`).

Ajustes al aprobar la spec (31/10/2026): la ruta es `/supervision/reportes`; se agregan `AtajosReportes` y `exportarCsv` (UTF-8 con BOM y apóstrofo ante textos tipo fórmula); el resultado usa `aplicado` y `resumen`, y el código `RECETA_INVALIDA` se trata como `INTENCION_NO_RECONOCIDA`.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Instalar SheetJS 0.20.3 desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; cambios a contratos y pantallas (`docs/contratos.md`, `docs/app.md`)
- [x] Pantalla `/supervision/reportes` («Reportes») en el menú interno (como `/supervision/riesgo` de la 402), solo para `admin` y `gerente`
- [x] `PanelPedido`: `CampoDictado` de la 302 con contador (3 a 500) y «Consultar»; el cuadro de texto funciona sin micrófono
- [x] `AtajosReportes`: un botón por atajo de `catalogoReportes.atajos`; al pulsarlo, `consultarReporte(atajo)`
- [x] `ResultadoReporte`: título del conjunto, `aplicado` como etiquetas, `resumen` como texto, avisos, tabla con formato por tipo y aviso de filas recortadas; «Preparando el reporte…» y límite de 60 s
- [x] `exportarExcel`: hojas «Datos» y «Consulta», conversión por tipo y apóstrofo en textos tipo fórmula
- [x] `exportarCsv`: solo la tabla con `utils.sheet_to_csv`, UTF-8 con BOM y apóstrofo en textos tipo fórmula
- [x] `HistorialConsultas` y mensajes por código de error (`INTENCION_NO_RECONOCIDA` y `RECETA_INVALIDA` con los conjuntos, ejemplos y atajos)
- [x] Pruebas (incluida la lectura del `.xlsx` generado para revisar tipos de celda)
