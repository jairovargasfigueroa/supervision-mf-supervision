import { describe, expect, it } from 'vitest';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { tableroVisible } from './datos-parciales';
import type { FilaTablero, Tablero } from './tablero.graphql';

const FILA: FilaTablero = {
  obraId: 'o1',
  nombre: 'Edificio Las Palmeras',
  avancePct: 30,
  plazoPct: 35,
  diferencia: 5,
  enRiesgo: false,
  materialesBajos: 0,
  ultimaPlanilla: null,
};

const COMPLETO: Tablero = {
  indicadores: { obrasEnEjecucion: 3, obrasEnRiesgo: 1, materialesBajos: 1, cobrosVencidos: { cantidad: 1, monto: 10 } },
  obras: [FILA],
};

const errores = (...lista: { path: (string | number)[]; servicio?: string }[]) =>
  new CombinedGraphQLErrors({
    data: null,
    errors: lista.map(({ path, servicio }) => ({
      message: 'x',
      path,
      extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', ...(servicio && { servicio }) },
    })),
  });

describe('tableroVisible', () => {
  it('con todo lo que llegó no hay avisos', () => {
    const visible = tableroVisible(COMPLETO, undefined, true);
    expect(visible.obrasEnEjecucion).toEqual({ valor: 3 });
    expect(visible.cobrosVencidos).toEqual({ valor: { cantidad: 1, monto: 10 } });
    expect(visible.obras).toEqual({ valor: [FILA] });
    expect(visible.avisoMaterialesFilas).toBeUndefined();
  });

  it('sin permiso de cobros no arma la tarjeta aunque llegue en null', () => {
    const sinCobros = { ...COMPLETO, indicadores: { ...COMPLETO.indicadores!, cobrosVencidos: null } };
    const visible = tableroVisible(sinCobros, undefined, false);
    expect(visible.cobrosVencidos).toBeUndefined();
  });

  it('un campo en null sin error usa el servicio dueño del campo', () => {
    const visible = tableroVisible({ indicadores: null, obras: [{ ...FILA, materialesBajos: null }] }, undefined, true);
    expect(visible.obrasEnRiesgo).toEqual({ aviso: 'Datos de Obras no disponibles' });
    expect(visible.materialesBajos).toEqual({ aviso: 'Datos de Materiales no disponibles' });
    expect(visible.cobrosVencidos).toEqual({ aviso: 'Datos de Finanzas no disponibles' });
    expect(visible.avisoMaterialesFilas).toBe('Datos de Materiales no disponibles');
  });

  it('el servicio de extensions.servicio del error del campo manda sobre el dueño', () => {
    // Obras no respondió y el gateway no pudo sumar los materiales bajos de sus obras
    const visible = tableroVisible(
      { indicadores: { ...COMPLETO.indicadores!, materialesBajos: null }, obras: COMPLETO.obras },
      errores(
        { path: ['tablero', 'indicadores', 'materialesBajos'], servicio: 'obras' },
        { path: ['tablero', 'indicadores', 'obrasEnRiesgo'], servicio: 'finanzas' },
      ),
      true,
    );
    expect(visible.materialesBajos).toEqual({ aviso: 'Datos de Obras no disponibles' });
    expect(visible.obrasEnRiesgo).toEqual({ valor: 1 });
  });

  it('un error de todo `indicadores` vale para cada uno de sus campos', () => {
    const visible = tableroVisible(
      { indicadores: null, obras: COMPLETO.obras },
      errores({ path: ['tablero', 'indicadores'], servicio: 'materiales' }),
      true,
    );
    expect(visible.obrasEnEjecucion).toEqual({ aviso: 'Datos de Materiales no disponibles' });
    expect(visible.obras).toEqual({ valor: [FILA] });
  });
});
