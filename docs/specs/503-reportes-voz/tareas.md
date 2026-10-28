# 503 · Reportes por voz · tareas de `frontend/mf-supervision`

Requisitos y diseño: `docs/specs/503-reportes-voz/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto. Requiere el componente de dictado de la capa 3.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Instalar SheetJS 0.20.3 desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- [ ] Pantalla `/supervision/reportes-voz` en el menú interno (como `/supervision/riesgo` de la 402), solo para `admin` y `gerente`
- [ ] `PanelDictado`: micrófono con el dictado de la capa 3 y cuadro de texto editable (3 a 500 caracteres) que funciona sin micrófono
- [ ] `ResultadoReporte`: título, filtros, respuesta como texto, avisos, tabla con formato por tipo y aviso de filas recortadas
- [ ] `exportarExcel`: hojas «Datos» y «Consulta», conversión por tipo y apóstrofo en textos tipo fórmula
- [ ] `HistorialConsultas` y mensajes por código de error (incluido el catálogo con ejemplos)
- [ ] Pruebas (incluida la lectura del `.xlsx` generado para revisar tipos de celda)
