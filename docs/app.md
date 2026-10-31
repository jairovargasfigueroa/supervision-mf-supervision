# ERP · Microfrontend Supervisión: qué hace

## Pantallas

| Pantalla | Quién | Caso de uso | Etapa |
|---|---|---|---|
| Tablero de obras (avance, plazo, alertas; cobros vencidos solo administración y gerente) | Administración, gerente, residente (sus obras) | Consultar tablero | Base |
| Dictado (prueba del componente de voz a texto) | Administración, gerente, residente | Voz a texto en el navegador | Capa 3 |
| Riesgo de retraso por obra (`/supervision/riesgo`, spec 402; enlace «Riesgo de retraso» en el menú interno) | Administración, gerente, residente (sus obras) | Predicciones | Capa 4 |
| Agentes: últimos informes y sugerencias para aprobar o rechazar («Ejecutar ahora» e historial: administración y gerente; el residente no ve Control de cobros) | Administración, gerente, residente (sus obras) | Agentes | Capa 5 |
| Reportes por voz: hablar, ver la tabla, exportar a Excel | Administración, gerente | Reportes generativos | Capa 5 |

Los informes de cada agente también se muestran dentro de su área (Obras, Materiales); aquí va el resumen.

Sin conexión (104): el tablero muestra la última respuesta completa guardada en el equipo con «Sin conexión · datos del dd/mm/aaaa hh:mm», o «No hay datos guardados de esta pantalla» si nunca se abrió en ese navegador.

## Qué no hace

- No ejecuta acciones sugeridas por los agentes sin aprobación de una persona.
- No envía audio al servidor: solo el texto transcrito.
