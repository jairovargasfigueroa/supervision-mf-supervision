// Configuración que publica el shell en window.plataforma.configuracion.
// Abierto solo (desarrollo) se usa la URL local del gateway (docs/entorno-local.md).

export const GATEWAY_URL_DESARROLLO = 'http://localhost:4000/graphql';

/** 601: única fuente de la dirección del gateway; se lee en cada consulta (sin variables al compilar). */
export function obtenerGatewayUrl(): string {
  return window.plataforma?.configuracion?.gatewayUrl || GATEWAY_URL_DESARROLLO;
}
