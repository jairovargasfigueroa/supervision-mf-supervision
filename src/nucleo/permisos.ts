import { useSesion } from './sesion';

// Qué ve cada rol en Supervisión (docs/permisos.md). Los roles de window.plataforma.sesion.usuario.roles son los
// del token tal cual: incluyen roles técnicos de Keycloak (default-roles-*, offline_access…) y, si la persona también
// es cliente, `cliente`. En el ERP (azp `erp`) solo cuentan los roles internos (convenciones, regla del azp).
// El gateway vuelve a validar: `cobrosVencidos` llega en null sin error para los demás roles.

export const ROLES_INTERNOS = ['admin', 'residente', 'gerente', 'maestro', 'almacenero'] as const;

/** Roles que cuentan en el ERP. */
export function rolesEfectivos(roles: readonly string[]): string[] {
  return roles.filter((rol) => (ROLES_INTERNOS as readonly string[]).includes(rol));
}

/** El indicador de cobros vencidos del tablero: solo `admin` y `gerente` (009, criterio 1). */
export function puedeVerCobros(roles: readonly string[]): boolean {
  return rolesEfectivos(roles).some((rol) => rol === 'admin' || rol === 'gerente');
}

/** Si el usuario de la sesión del shell ve los cobros vencidos. */
export function usePuedeVerCobros(): boolean {
  return puedeVerCobros(useSesion()?.usuario.roles ?? []);
}
