# ERP · Microfrontend Supervisión: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

- Gateway GraphQL (`docs/contratos/graphql-erp.md` de la carpeta general), con `Authorization: Bearer <token>` del shell:
  - `tablero` (009) en `src/tablero/tablero.graphql.ts`: `indicadores { obrasEnEjecucion obrasEnRiesgo materialesBajos cobrosVencidos { cantidad monto } }` y `obras { obraId nombre avancePct plazoPct diferencia enRiesgo materialesBajos ultimaPlanilla { periodo estado } }`. Se pide con `errorPolicy: 'all'`: un campo en `null` con `SERVICIO_NO_DISPONIBLE` se muestra «—» con «Datos de {servicio} no disponibles» (el servicio sale de `extensions.servicio` o, si no viene, del dueño del campo: Obras, Materiales o Finanzas). `cobrosVencidos` llega en `null` sin error para roles que no son `admin` ni `gerente`: para ellos la tarjeta no se muestra.
  - 402, en la misma consulta `tablero`: `indicadores.obrasRiesgoAlto` (tarjeta «Riesgo alto (modelo)») y `obras.riesgoRetraso { probabilidad nivel factores { variable descripcion peso } versionModelo calculadaEn }` (columna «Riesgo (modelo)», ordenable: chip `BAJO` verde, `MEDIO` amarillo, `ALTO` rojo, `SIN_DATOS` gris «Sin datos», y porcentaje entero). Si IA no responde, esos campos llegan en `null` con `SERVICIO_NO_DISPONIBLE` (`extensions.servicio = "ia"`) y se muestran «—» con «Datos de IA no disponibles». La columna «Riesgo» (regla «En riesgo») se mantiene.
  - En las capas 4 y 5: predicciones, agentes, sugerencias y reportes por voz.
- Shell: sesión del usuario en `window.plataforma.sesion` (token con `obtenerToken()`, roles en `usuario.roles`) y URL del gateway en `window.plataforma.configuracion.gatewayUrl`.
  - 104: `sesion.sinConexion` (en ese modo `obtenerToken()` rechaza con `Error('SIN_CONEXION')`), `window.plataforma.conexion` (`{ enLinea, reportarFallo() }` y el evento `plataforma:conexion` con `detail: { enLinea }`) y `window.plataforma.almacen` (`guardarConsulta`, `leerConsulta`; separado por usuario). Si no existen (microfrontend abierto solo), trabaja en línea y sin guardar nada.

## Expone

- Web Component cargado por Native Federation (`./Bootstrap` registra la etiqueta), montado por el shell en su ruta `/supervision/**`.
- Navegación hacia el shell: al pulsar una obra del tablero cambia la dirección a `/obras/:id` con `window.history.pushState` y emite `popstate`; el router del shell abre el detalle de la obra en el área Obras (009, criterio 4).
