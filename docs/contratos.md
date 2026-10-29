# ERP · Microfrontend Supervisión: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

- Gateway GraphQL (`docs/contratos/graphql-erp.md` de la carpeta general), con `Authorization: Bearer <token>` del shell:
  - `tablero` (009) en `src/tablero/tablero.graphql.ts`: `indicadores { obrasEnEjecucion obrasEnRiesgo materialesBajos cobrosVencidos { cantidad monto } }` y `obras { obraId nombre avancePct plazoPct diferencia enRiesgo materialesBajos ultimaPlanilla { periodo estado } }`. Se pide con `errorPolicy: 'all'`: un campo en `null` con `SERVICIO_NO_DISPONIBLE` se muestra «—» con «Datos de {servicio} no disponibles» (el servicio sale de `extensions.servicio` o, si no viene, del dueño del campo: Obras, Materiales o Finanzas). `cobrosVencidos` llega en `null` sin error para roles que no son `admin` ni `gerente`: para ellos la tarjeta no se muestra.
  - En las capas 4 y 5: predicciones, agentes, sugerencias y reportes por voz.
- Shell: sesión del usuario en `window.plataforma.sesion` (token con `obtenerToken()`, roles en `usuario.roles`) y URL del gateway en `window.plataforma.configuracion.gatewayUrl`.

## Expone

- Web Component cargado por Native Federation (`./Bootstrap` registra la etiqueta), montado por el shell en su ruta `/supervision/**`.
- Navegación hacia el shell: al pulsar una obra del tablero cambia la dirección a `/obras/:id` con `window.history.pushState` y emite `popstate`; el router del shell abre el detalle de la obra en el área Obras (009, criterio 4).
