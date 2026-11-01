import { describe, expect, it } from 'vitest';
import { puedeUsarReportes, puedeVerCobros, rolesEfectivos } from './permisos';

describe('permisos', () => {
  it('solo cuentan los roles internos del ERP', () => {
    expect(rolesEfectivos(['default-roles-supervision', 'offline_access', 'residente', 'cliente'])).toEqual([
      'residente',
    ]);
  });

  it('cobros vencidos: solo admin y gerente (009, criterio 1)', () => {
    expect(puedeVerCobros(['admin'])).toBe(true);
    expect(puedeVerCobros(['offline_access', 'gerente'])).toBe(true);
    expect(puedeVerCobros(['residente'])).toBe(false);
    expect(puedeVerCobros(['residente', 'cliente'])).toBe(false);
    expect(puedeVerCobros([])).toBe(false);
  });
});

describe('permisos de la capa 5', () => {
  it('reportes (503): solo admin y gerente', () => {
    expect(puedeUsarReportes(['admin'])).toBe(true);
    expect(puedeUsarReportes(['gerente'])).toBe(true);
    expect(puedeUsarReportes(['residente'])).toBe(false);
    expect(puedeUsarReportes(['cliente'])).toBe(false);
  });
});
