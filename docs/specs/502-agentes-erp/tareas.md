# 502 · Agentes en el ERP · tareas de `frontend/mf-supervision`

Requisitos y diseño: `docs/specs/502-agentes-erp/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Ajuste al aprobar la spec (31/10/2026): el detalle de la ejecución muestra el servidor MCP de cada paso (`servidor`: Obras, Materiales, Finanzas o IA) y el proveedor y el modelo de lenguaje que usó la ejecución (`proveedorLlm`, `modelo`).

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Pantalla `/supervision/agentes` en el menú interno (mismo mecanismo que `/supervision/riesgo` de la 402); cambios a contratos y pantallas (`docs/contratos.md`, `docs/app.md`)
- [ ] `TarjetasAgentes`: misión, última ejecución, pendientes y «Ejecutar ahora» (solo `admin` y `gerente`) con consulta cada 3 s
- [ ] `ListaSugerencias` con filtros y diálogos de aprobar (comentario opcional) y rechazar (motivo obligatorio con contador)
- [ ] `HistorialEjecuciones` y `DetalleEjecucion` (pasos con su servidor, hallazgos y proveedor y modelo de lenguaje), solo `admin` y `gerente`
- [ ] Manejo de «No disponible por el momento» y de los códigos `EJECUCION_EN_CURSO` y `SUGERENCIA_YA_DECIDIDA`
- [ ] Pruebas (incluida una que comprueba que un texto con etiquetas HTML se muestra como texto)
