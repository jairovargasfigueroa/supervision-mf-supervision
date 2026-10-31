# 402 · Riesgo de retraso · tareas de `frontend/mf-supervision`

Requisitos y diseño: `docs/specs/402-riesgo-retraso/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Tablero: tarjeta «Riesgo alto (modelo)» y columna «Riesgo (modelo)» ordenable con chip por nivel; aviso de datos de IA no disponibles; pruebas
- [x] Pantalla `/supervision/riesgo`: lista por probabilidad, factores, gráfico SVG del historial y panel «Sobre el modelo» con el aviso de datos sintéticos; enlace en el menú interno
- [ ] Panel «Sobre el modelo»: aviso distinto según `datos` (`SINTETICOS` o `REALES`) (salió al aprobar la spec, criterio 9)
- [ ] Pruebas de la pantalla (lista ordenada, gráfico con 1 y 30 puntos, IA caída)
