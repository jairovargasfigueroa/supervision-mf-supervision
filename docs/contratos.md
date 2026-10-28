# ERP · Microfrontend Supervisión: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

- Gateway GraphQL: área tablero (base); en las capas 4 y 5, predicciones, agentes, sugerencias y reportes por voz.
- Shell: sesión del usuario en `window.plataforma.sesion` (token con `obtenerToken()`).

## Expone

- Web Component cargado por Native Federation (`./Bootstrap` registra la etiqueta), montado por el shell en su ruta.
