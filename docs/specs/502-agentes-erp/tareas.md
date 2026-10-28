# 502 · Agentes en el ERP · tareas de `frontend/mf-supervision`

Requisitos y diseño: `docs/specs/502-agentes-erp/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Pantalla `/supervision/agentes` en el menú interno (mismo mecanismo que `/supervision/riesgo` de la 402)
- [ ] `TarjetasAgentes`: misión, última ejecución, pendientes y «Ejecutar ahora» (solo `admin` y `gerente`) con consulta cada 3 s
- [ ] `ListaSugerencias` con filtros y diálogos de aprobar (comentario opcional) y rechazar (motivo obligatorio con contador)
- [ ] `HistorialEjecuciones` y `DetalleEjecucion` (pasos y hallazgos), solo `admin` y `gerente`
- [ ] Manejo de «No disponible por el momento» y de los códigos `EJECUCION_EN_CURSO` y `SUGERENCIA_YA_DECIDIDA`
- [ ] Pruebas (incluida una que comprueba que un texto con etiquetas HTML se muestra como texto)
