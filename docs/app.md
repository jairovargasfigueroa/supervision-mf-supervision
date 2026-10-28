# ERP · Microfrontend Supervisión: qué hace

## Pantallas

| Pantalla | Quién | Caso de uso | Etapa |
|---|---|---|---|
| Tablero de obras (avance, plazo, alertas) | Gerente, residente | Consultar tablero | Base |
| Riesgo de retraso por obra | Gerente | Predicciones | Capa 4 |
| Agentes: últimos informes y sugerencias para aprobar o rechazar | Gerente, residente | Agentes | Capa 5 |
| Reportes por voz: hablar, ver la tabla, exportar a Excel | Gerente, administración | Reportes generativos | Capa 5 |

Los informes de cada agente también se muestran dentro de su área (Obras, Materiales); aquí va el resumen.

## Qué no hace

- No ejecuta acciones sugeridas por los agentes sin aprobación de una persona.
- No envía audio al servidor: solo el texto transcrito.
