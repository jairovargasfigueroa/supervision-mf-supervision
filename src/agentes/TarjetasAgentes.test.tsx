import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { ESTADO_EJECUCION_AGENTE, EJECUTAR_AGENTE, type AgenteInfo } from './agentes.graphql';
import { TarjetasAgentes } from './TarjetasAgentes';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const AGENTES: AgenteInfo[] = [
  {
    agente: 'SEGUIMIENTO_OBRAS',
    nombre: 'Seguimiento de obras',
    mision: 'Detectar obras atrasadas o con riesgo alto',
    herramientas: ['avance_obra'],
    ultimaEjecucion: {
      id: 'e1',
      agente: 'SEGUIMIENTO_OBRAS',
      origen: 'PROGRAMADA',
      estado: 'TERMINADA',
      iniciadaEn: '2027-04-20T10:00:00Z',
      terminadaEn: '2027-04-20T10:01:12Z',
      cantidadHallazgos: 3,
    },
    sugerenciasPendientes: 2,
  },
  {
    agente: 'CONTROL_MATERIALES',
    nombre: 'Control de materiales',
    mision: 'Detectar stock bajo',
    herramientas: ['stock_obra'],
    ultimaEjecucion: {
      id: 'e2',
      agente: 'CONTROL_MATERIALES',
      origen: 'MANUAL',
      estado: 'FALLIDA',
      iniciadaEn: '2027-04-20T11:00:00Z',
      terminadaEn: '2027-04-20T11:03:00Z',
      cantidadHallazgos: 0,
    },
    sugerenciasPendientes: 1,
  },
  {
    agente: 'CONTROL_COBROS',
    nombre: 'Control de cobros',
    mision: 'Detectar cobros vencidos',
    herramientas: ['cobros_por_vencer'],
    ultimaEjecucion: null,
    sugerenciasPendientes: 0,
  },
];

const corta = (estado: 'EN_CURSO' | 'TERMINADA') => ({
  __typename: 'EjecucionCorta',
  id: 'e9',
  agente: 'SEGUIMIENTO_OBRAS',
  origen: 'MANUAL',
  estado,
  iniciadaEn: '2027-04-21T12:00:00Z',
  terminadaEn: null,
  cantidadHallazgos: 0,
});

const ejecutar = (codigo?: string): MockLink.MockedResponse => ({
  request: { query: EJECUTAR_AGENTE, variables: { agente: 'SEGUIMIENTO_OBRAS' } },
  result: codigo
    ? { data: null, errors: [{ message: 'x', path: ['ejecutarAgente'], extensions: { codigo, servicio: 'ia' } }] }
    : { data: { ejecutarAgente: corta('EN_CURSO') } },
});

const estado = (valor: 'EN_CURSO' | 'TERMINADA', veces = 1): MockLink.MockedResponse => ({
  request: { query: ESTADO_EJECUCION_AGENTE, variables: { id: 'e9' } },
  result: { data: { ejecucionAgente: { __typename: 'EjecucionAgente', id: 'e9', estado: valor } } },
  maxUsageCount: veces,
});

function dibujar(mocks: MockLink.MockedResponse[], puedeEjecutar = true, agentes = AGENTES) {
  const alActualizar = vi.fn();
  render(
    <MockedProvider mocks={mocks}>
      <TarjetasAgentes agentes={agentes} puedeEjecutar={puedeEjecutar} alActualizar={alActualizar} />
    </MockedProvider>,
  );
  return alActualizar;
}

const tarjeta = (nombre: string) => within(screen.getByRole('region', { name: nombre }));

describe('TarjetasAgentes (502, criterio 16)', () => {
  it('muestra misión, última ejecución con su estado y las sugerencias pendientes', () => {
    dibujar([]);
    const seguimiento = tarjeta('Seguimiento de obras');
    expect(seguimiento.getByText('Detectar obras atrasadas o con riesgo alto')).toBeTruthy();
    expect(seguimiento.getByText('Terminada').closest('[data-tono]')?.getAttribute('data-tono')).toBe('exito');
    expect(seguimiento.getByText('20/04/2027 06:00 · Programada · 3 hallazgos')).toBeTruthy();
    expect(seguimiento.getByText('2 sugerencias pendientes')).toBeTruthy();

    const materiales = tarjeta('Control de materiales');
    expect(materiales.getByText('Fallida').closest('[data-tono]')?.getAttribute('data-tono')).toBe('error');
    expect(materiales.getByText('1 sugerencia pendiente')).toBeTruthy();

    expect(tarjeta('Control de cobros').getByText('Sin ejecuciones todavía')).toBeTruthy();
  });

  it('el residente no ve «Ejecutar ahora»', () => {
    dibujar([], false, AGENTES.slice(0, 2));
    expect(screen.queryByRole('button', { name: 'Ejecutar ahora' })).toBeNull();
  });

  it('«Ejecutar ahora» muestra «En curso…» y consulta cada 3 s hasta que termina (criterio 2)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const alActualizar = dibujar([ejecutar(), estado('EN_CURSO', 2), estado('TERMINADA')]);
    const seguimiento = tarjeta('Seguimiento de obras');

    await act(async () => fireEvent.click(seguimiento.getByRole('button', { name: 'Ejecutar ahora' })));
    expect(await seguimiento.findByText('En curso…')).toBeTruthy();
    expect((seguimiento.getByRole('button', { name: 'Ejecutar ahora' }) as HTMLButtonElement).disabled).toBe(true);
    expect(alActualizar).not.toHaveBeenCalled();

    // Primera consulta y una a los 3 s: sigue en curso
    await act(async () => vi.advanceTimersByTime(3100));
    expect(alActualizar).not.toHaveBeenCalled();
    expect(seguimiento.getByText('En curso…')).toBeTruthy();
    // A los 6 s ya terminó
    for (let i = 0; i < 20 && alActualizar.mock.calls.length === 0; i++) await act(async () => vi.advanceTimersByTime(1000));
    expect(alActualizar).toHaveBeenCalledTimes(1);
    expect(seguimiento.queryByText('En curso…')).toBeNull();
  });

  it('deja de consultar a los 5 minutos y ofrece «Actualizar»', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const enCurso = { ...AGENTES[0], ultimaEjecucion: { ...AGENTES[0].ultimaEjecucion!, id: 'e9', estado: 'EN_CURSO' as const } };
    const alActualizar = dibujar([estado('EN_CURSO', 200)], true, [enCurso]);
    const seguimiento = tarjeta('Seguimiento de obras');
    expect(seguimiento.getByText('En curso…')).toBeTruthy();

    await act(async () => vi.advanceTimersByTime(5 * 60_000));
    fireEvent.click(await seguimiento.findByRole('button', { name: 'Actualizar' }));
    expect(alActualizar).toHaveBeenCalled();
  });

  it('si ya hay una ejecución en curso avisa «El agente ya se está ejecutando» (criterio 3)', async () => {
    const alActualizar = dibujar([ejecutar('EJECUCION_EN_CURSO')]);
    const seguimiento = tarjeta('Seguimiento de obras');
    fireEvent.click(seguimiento.getByRole('button', { name: 'Ejecutar ahora' }));
    expect(await seguimiento.findByText('El agente ya se está ejecutando')).toBeTruthy();
    expect(alActualizar).toHaveBeenCalled();
  });
});
