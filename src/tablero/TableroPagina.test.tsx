import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';
import { TABLERO, type FilaTablero, type IndicadoresTablero } from './tablero.graphql';

/** Sesión del shell con los roles del token (incluye los técnicos de Keycloak). */
function sesionCon(...roles: string[]) {
  window.plataforma = {
    sesion: {
      usuario: { id: 'u1', nombre: 'Ana', roles: ['default-roles-supervision', 'offline_access', ...roles] },
      obtenerToken: vi.fn().mockResolvedValue('t'),
      cerrarSesion: vi.fn(),
    },
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
  };
}

beforeEach(() => sesionCon('gerente'));
afterEach(() => {
  cleanup();
  delete window.plataforma;
  window.history.replaceState(null, '', '/');
});

// Datos de prueba del tablero (docs/datos-prueba.md, gerente1): llegan sin ordenar
const OBRA_1 = 'b0000000-0000-4000-8000-000000000101';
const OBRA_2 = 'b0000000-0000-4000-8000-000000000102';
const OBRA_3 = 'b0000000-0000-4000-8000-000000000103';

const fila = (f: Omit<FilaTablero, 'ultimaPlanilla'> & { ultimaPlanilla?: FilaTablero['ultimaPlanilla'] }) => ({
  __typename: 'FilaTablero',
  ...f,
  ultimaPlanilla: f.ultimaPlanilla ? { __typename: 'PlanillaCorta', ...f.ultimaPlanilla } : null,
});

const FILAS = [
  fila({
    obraId: OBRA_3,
    nombre: 'Unidad Educativa San Martín',
    avancePct: 10.25,
    plazoPct: 12.33,
    diferencia: 2.08,
    enRiesgo: false,
    materialesBajos: 0,
  }),
  fila({
    obraId: OBRA_1,
    nombre: 'Edificio Las Palmeras',
    avancePct: 30.5,
    plazoPct: 35.34,
    diferencia: 4.84,
    enRiesgo: false,
    materialesBajos: 0,
    ultimaPlanilla: { periodo: '2026-09', estado: 'PRESENTADA' },
  }),
  fila({
    obraId: OBRA_2,
    nombre: 'Condominio Las Lomas',
    avancePct: 16.34,
    plazoPct: 50,
    diferencia: 33.66,
    enRiesgo: true,
    materialesBajos: 1,
    ultimaPlanilla: { periodo: '2026-09', estado: 'OBSERVADA' },
  }),
];

const INDICADORES: IndicadoresTablero = {
  obrasEnEjecucion: 3,
  obrasEnRiesgo: 1,
  materialesBajos: 1,
  cobrosVencidos: { cantidad: 1, monto: 290134.8 },
};

type Respuesta = {
  indicadores?: Partial<IndicadoresTablero> | null;
  obras?: ReturnType<typeof fila>[] | null;
};

function respuesta({ indicadores, obras }: Respuesta = {}) {
  const ind = indicadores === null ? null : { ...INDICADORES, ...indicadores };
  return {
    tablero: {
      __typename: 'Tablero',
      indicadores: ind && {
        __typename: 'IndicadoresTablero',
        ...ind,
        cobrosVencidos: ind.cobrosVencidos && { __typename: 'ResumenMonto', ...ind.cobrosVencidos },
      },
      obras: obras === undefined ? FILAS : obras,
    },
  };
}

const noDisponible = (servicio: string, ...camino: (string | number)[]) => ({
  message: 'x',
  path: ['tablero', ...camino],
  extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio },
});

const tablero = (datos = respuesta(), errores?: ReturnType<typeof noDisponible>[]): MockLink.MockedResponse => ({
  request: { query: TABLERO, variables: {} },
  result: errores ? { data: datos, errors: errores } : { data: datos },
});

function dibujar(mocks: MockLink.MockedResponse[]) {
  const historial = createMemoryHistory({ initialEntries: ['/supervision'] });
  render(
    <MockedProvider mocks={mocks}>
      <RouterProvider router={crearRouter(historial)} />
    </MockedProvider>,
  );
}

const tarjeta = async (titulo: string) => within(await screen.findByRole('group', { name: titulo }));

/** Filas de datos de la tabla (sin el encabezado) cuando ya llegaron. */
const filasTabla = async () => {
  let filas: HTMLElement[] = [];
  await waitFor(() => {
    filas = within(screen.getByRole('table', { name: 'Obras en ejecución' })).getAllByRole('row').slice(1);
    if (filas.length === 0) throw new Error('sin datos');
  });
  return filas;
};

const nombres = (filas: HTMLElement[]) => filas.map((f) => within(f).getAllByRole('cell')[0].textContent);

describe('TableroPagina sin conexión (104)', () => {
  const CLAVE = 'Tablero:{}';

  /** Publica la conexión y un almacén en memoria como los del shell. */
  function conShell(enLinea: boolean, guardadas: Record<string, unknown> = {}) {
    const consultas = new Map(
      Object.entries(guardadas).map(([clave, datos]) => [clave, { datos, guardadoEn: '2026-10-30T18:05:00.000Z' }]),
    );
    const almacen = {
      guardarConsulta: vi.fn(async (clave: string, datos: unknown) => {
        consultas.set(clave, { datos, guardadoEn: new Date().toISOString() });
      }),
      leerConsulta: vi.fn(async (clave: string) => consultas.get(clave) ?? null),
    };
    const conexion = { enLinea, reportarFallo: vi.fn() };
    window.plataforma = { ...window.plataforma!, conexion, almacen: almacen as never };
    return { almacen, conexion };
  }

  it('en línea guarda el tablero completo en el equipo', async () => {
    const { almacen } = conShell(true);
    dibujar([tablero()]);
    await filasTabla();
    await waitFor(() => expect(almacen.guardarConsulta).toHaveBeenCalledWith(CLAVE, respuesta()));
    expect(screen.queryByText(/^Sin conexión/)).toBeNull();
  });

  it('un tablero parcial se muestra pero no se guarda', async () => {
    const { almacen } = conShell(true);
    dibujar([
      tablero(respuesta({ indicadores: { materialesBajos: null } }), [
        noDisponible('materiales', 'indicadores', 'materialesBajos'),
      ]),
    ]);
    expect((await tarjeta('Obras en ejecución')).getByText('3')).toBeTruthy();
    expect(screen.getByText('Datos de Materiales no disponibles')).toBeTruthy();
    expect(almacen.guardarConsulta).not.toHaveBeenCalled();
  });

  it('sin conexión muestra el tablero guardado con el aviso y su fecha', async () => {
    conShell(false, { [CLAVE]: respuesta() });
    dibujar([]);
    expect(nombres(await filasTabla())).toHaveLength(3);
    expect((await tarjeta('Obras en ejecución')).getByText('3')).toBeTruthy();
    expect(screen.getByText('Sin conexión · datos del 30/10/2026 14:05')).toBeTruthy();
  });

  it('si el gateway no responde avisa al shell y muestra el tablero guardado', async () => {
    const { conexion } = conShell(true, { [CLAVE]: respuesta() });
    dibujar([{ request: { query: TABLERO, variables: {} }, error: new TypeError('Failed to fetch') }]);
    expect(await screen.findByText('Sin conexión · datos del 30/10/2026 14:05')).toBeTruthy();
    expect(nombres(await filasTabla())).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(conexion.reportarFallo).toHaveBeenCalledOnce();
  });

  it('sin conexión y sin tablero guardado avisa que no hay datos de esta pantalla', async () => {
    conShell(false);
    dibujar([]);
    expect(await screen.findByText('No hay datos guardados de esta pantalla')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});

describe('TableroPagina', () => {
  it('muestra los cuatro indicadores para gerente (criterio 1)', async () => {
    dibujar([tablero()]);

    expect((await tarjeta('Obras en ejecución')).getByText('3')).toBeTruthy();
    expect((await tarjeta('Obras en riesgo')).getByText('1')).toBeTruthy();
    expect((await tarjeta('Materiales bajos')).getByText('1')).toBeTruthy();
    const cobros = await tarjeta('Cobros vencidos');
    expect(cobros.getByText('1')).toBeTruthy();
    expect(cobros.getByText('Bs 290.134,80')).toBeTruthy();
  });

  it('residente no ve el indicador de cobros vencidos (criterio 1)', async () => {
    sesionCon('residente');
    dibujar([tablero(respuesta({ indicadores: { cobrosVencidos: null } }))]);

    expect(await tarjeta('Obras en ejecución')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Cobros vencidos' })).toBeNull();
    expect(screen.queryByText(/Datos de Finanzas/)).toBeNull();
  });

  it('la tabla se abre ordenada por diferencia de mayor a menor con sus columnas (criterios 2 y 3)', async () => {
    dibujar([tablero()]);
    const filas = await filasTabla();

    expect(nombres(filas)).toEqual(['Condominio Las Lomas', 'Edificio Las Palmeras', 'Unidad Educativa San Martín']);
    const encabezado = screen.getByRole('columnheader', { name: 'Diferencia' });
    expect(encabezado.getAttribute('aria-sort')).toBe('descending');

    const lomas = within(filas[0]);
    expect(lomas.getByText('16,3 %')).toBeTruthy();
    expect(lomas.getByText('50 %')).toBeTruthy();
    expect(lomas.getByText('33,7 %')).toBeTruthy();
    expect(lomas.getByText('2026-09')).toBeTruthy();
    expect(lomas.getByText('Observada').closest('[data-tono]')?.getAttribute('data-tono')).toBe('error');
    expect(lomas.getByText('En riesgo').closest('[data-tono]')?.getAttribute('data-tono')).toBe('atencion');
    expect(within(filas[1]).getByText('Presentada')).toBeTruthy();
    expect(within(filas[1]).queryByText('En riesgo')).toBeNull();
    expect(within(filas[2]).getByText('Sin planillas')).toBeTruthy();
  });

  it('se puede ordenar por cualquier columna (criterio 3)', async () => {
    dibujar([tablero()]);
    await filasTabla();

    fireEvent.click(screen.getByRole('button', { name: 'Obra' }));
    expect(nombres(await filasTabla())).toEqual([
      'Condominio Las Lomas',
      'Edificio Las Palmeras',
      'Unidad Educativa San Martín',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Obra' }));
    expect(nombres(await filasTabla())).toEqual([
      'Unidad Educativa San Martín',
      'Edificio Las Palmeras',
      'Condominio Las Lomas',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Avance' }));
    const porAvance = nombres(await filasTabla());
    expect([porAvance[0], porAvance[2]].sort()).toEqual(['Edificio Las Palmeras', 'Unidad Educativa San Martín']);
  });

  it('al pulsar una obra va a /obras/:id del shell con popstate (criterio 4)', async () => {
    const alCambiar = vi.fn();
    window.addEventListener('popstate', alCambiar);
    dibujar([tablero()]);
    const [lomas] = await filasTabla();

    fireEvent.click(lomas);
    expect(window.location.pathname).toBe(`/obras/${OBRA_2}`);
    expect(alCambiar).toHaveBeenCalledOnce();

    fireEvent.keyDown(screen.getByRole('row', { name: 'Abrir Edificio Las Palmeras' }), { key: 'Enter' });
    expect(window.location.pathname).toBe(`/obras/${OBRA_1}`);
    window.removeEventListener('popstate', alCambiar);
  });

  it('con Materiales y Finanzas caídos muestra «—» con su aviso y el resto normal (criterio 5)', async () => {
    const sinMateriales = FILAS.map((f) => ({ ...f, materialesBajos: null }));
    dibujar([
      tablero(respuesta({ indicadores: { materialesBajos: null, cobrosVencidos: null }, obras: sinMateriales }), [
        noDisponible('materiales', 'indicadores', 'materialesBajos'),
        noDisponible('finanzas', 'indicadores', 'cobrosVencidos'),
        ...sinMateriales.map((_, i) => noDisponible('materiales', 'obras', i, 'materialesBajos')),
      ]),
    ]);

    const materiales = await tarjeta('Materiales bajos');
    expect(materiales.getByText('—')).toBeTruthy();
    expect(materiales.getByText('Datos de Materiales no disponibles')).toBeTruthy();
    const cobros = await tarjeta('Cobros vencidos');
    expect(cobros.getByText('—')).toBeTruthy();
    expect(cobros.getByText('Datos de Finanzas no disponibles')).toBeTruthy();
    expect((await tarjeta('Obras en ejecución')).getByText('3')).toBeTruthy();

    const filas = await filasTabla();
    expect(nombres(filas)[0]).toBe('Condominio Las Lomas');
    for (const f of filas) expect(within(f).getByLabelText('Datos de Materiales no disponibles').textContent).toBe('—');
    expect(screen.getByRole('alert').textContent).toBe('Datos de Materiales no disponibles');
  });

  it('con Obras caído la tabla y sus indicadores muestran «—» con «Datos de Obras no disponibles» (criterio 5)', async () => {
    dibujar([
      tablero(respuesta({ indicadores: { obrasEnEjecucion: null, obrasEnRiesgo: null }, obras: null }), [
        noDisponible('obras', 'obras'),
        noDisponible('obras', 'indicadores', 'obrasEnEjecucion'),
        noDisponible('obras', 'indicadores', 'obrasEnRiesgo'),
      ]),
    ]);

    const enEjecucion = await tarjeta('Obras en ejecución');
    expect(enEjecucion.getByText('—')).toBeTruthy();
    expect(enEjecucion.getByText('Datos de Obras no disponibles')).toBeTruthy();
    expect((await tarjeta('Obras en riesgo')).getByText('Datos de Obras no disponibles')).toBeTruthy();
    expect((await tarjeta('Cobros vencidos')).getByText('Bs 290.134,80')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Datos de Obras no disponibles');
  });

  it('«Actualizar» vuelve a pedir el tablero (criterio 6)', async () => {
    dibujar([tablero(), tablero(respuesta({ indicadores: { obrasEnRiesgo: 2 } }))]);
    expect((await tarjeta('Obras en riesgo')).getByText('1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(async () => expect((await tarjeta('Obras en riesgo')).getByText('2')).toBeTruthy());
  });

  it('sin respuesta del gateway muestra el error y «Reintentar» vuelve a pedir', async () => {
    dibujar([
      { request: { query: TABLERO, variables: {} }, error: new TypeError('Failed to fetch') },
      tablero(),
    ]);
    expect(await screen.findByText('No disponible por el momento.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect((await tarjeta('Obras en ejecución')).getByText('3')).toBeTruthy();
  });
});
