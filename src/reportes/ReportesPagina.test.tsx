import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';
import { CATALOGO_REPORTES, CONSULTAR_REPORTE, CONSULTAS_REPORTE, type AtajoReporte } from './reportes.graphql';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.plataforma;
});

function sesion(roles: string[] = ['gerente']) {
  window.plataforma = {
    sesion: {
      usuario: { id: 'u1', nombre: 'Ana Gerente', roles },
      obtenerToken: vi.fn().mockResolvedValue('t'),
      cerrarSesion: vi.fn(),
    },
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
  };
}

function dibujar(ruta: string, mocks: MockLink.MockedResponse[] = []) {
  const historial = createMemoryHistory({ initialEntries: [ruta] });
  render(
    <MockedProvider mocks={mocks}>
      <RouterProvider router={crearRouter(historial)} />
    </MockedProvider>,
  );
  return historial;
}

const CATALOGO = {
  __typename: 'CatalogoReportes',
  conjuntos: [
    {
      __typename: 'ConjuntoDisponible',
      conjunto: 'CONSUMO_MATERIAL',
      titulo: 'Material usado',
      descripcion: 'Cantidad, monto referencial y número de salidas',
      columnas: [{ __typename: 'ColumnaReporte', clave: 'material', titulo: 'Material', tipo: 'TEXTO' }],
      filtros: ['obra', 'zona', 'cliente', 'material', 'periodo'],
      agrupaciones: ['obra', 'zona', 'cliente', 'material', 'periodo'],
      ejemplos: ['¿Cuánto cemento se usó en Las Palmas este trimestre?', 'Material usado por zona este año'],
    },
    {
      __typename: 'ConjuntoDisponible',
      conjunto: 'COBROS',
      titulo: 'Cobros',
      descripcion: 'Número, monto, emisión, vencimiento y estado',
      columnas: [],
      filtros: ['obra'],
      agrupaciones: ['obra'],
      ejemplos: ['Cobros vencidos de este año'],
    },
  ],
  atajos: [
    { __typename: 'AtajoDisponible', atajo: 'COBROS_VENCIDOS', titulo: 'Cobros vencidos', descripcion: 'Vencidos' },
    {
      __typename: 'AtajoDisponible',
      atajo: 'COBROS_POR_VENCER',
      titulo: 'Cobros que vencen en los próximos 30 días',
      descripcion: 'Por vencer',
    },
  ],
};

const catalogo = (): MockLink.MockedResponse => ({
  request: { query: CATALOGO_REPORTES, variables: {} },
  result: { data: { catalogoReportes: CATALOGO } },
});

const historial = (consultas: object[] = []): MockLink.MockedResponse => ({
  request: { query: CONSULTAS_REPORTE, variables: { limite: 10 } },
  result: { data: { consultasReporte: consultas.map((c) => ({ __typename: 'ConsultaReporteCorta', ...c })) } },
  maxUsageCount: 5,
});

const RESULTADO = {
  __typename: 'ConsultaReporte',
  id: 'c1',
  texto: 'Cobros vencidos de este año',
  atajo: null,
  conjunto: 'COBROS',
  tituloConjunto: 'Cobros',
  aplicado: [{ __typename: 'ElementoAplicado', nombre: 'Estado', valor: 'Vencido' }],
  resumen: 'Hay 1 cobro vencido por Bs 12 500.',
  resumenPlantilla: false,
  avisos: [],
  columnas: [
    { __typename: 'ColumnaReporte', clave: 'numero', titulo: 'Número', tipo: 'TEXTO' },
    { __typename: 'ColumnaReporte', clave: 'monto', titulo: 'Monto neto', tipo: 'MONTO' },
  ],
  filas: [['CB-0001', '12500.00']],
  totalFilas: 1,
  truncado: false,
  creadaEn: '2027-03-20T14:00:00Z',
};

const consultar = (
  variables: { texto: string } | { atajo: AtajoReporte },
  respuesta: { datos?: object; codigo?: string; demora?: number } = {},
): MockLink.MockedResponse => ({
  request: { query: CONSULTAR_REPORTE, variables },
  delay: respuesta.demora,
  result: respuesta.codigo
    ? { data: null, errors: [{ message: 'x', path: ['consultarReporte'], extensions: { codigo: respuesta.codigo, servicio: 'ia' } }] }
    : { data: { consultarReporte: { ...RESULTADO, ...respuesta.datos } } },
});

const cuadro = () => screen.getByRole('textbox', { name: 'Pedido del reporte' });

async function pedir(texto: string) {
  fireEvent.change(await screen.findByRole('textbox', { name: 'Pedido del reporte' }), { target: { value: texto } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
}

describe('ReportesPagina (503): acceso', () => {
  it('el gerente llega desde el menú interno «Reportes»', async () => {
    sesion(['gerente']);
    const nav = dibujar('/supervision/dictado', [catalogo(), historial()]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Reportes' }));
    expect(await screen.findByRole('heading', { name: 'Reportes', level: 1 })).toBeTruthy();
    expect(nav.location.pathname).toBe('/supervision/reportes');
  });

  it('el residente no ve «Reportes» en el menú y, por la dirección, recibe el aviso de permiso', async () => {
    sesion(['residente']);
    dibujar('/supervision/reportes');
    expect(await screen.findByText('No tienes permiso para hacer esta acción.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Reportes' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Reportes' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Dictado' })).toBeTruthy();
  });
});

describe('ReportesPagina (503): consultar', () => {
  it('escribe el pedido, muestra «Preparando el reporte…» y luego el resultado (criterios 3, 8 y 11)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: 'Cobros vencidos de este año' }, { demora: 30 }),
      historial(),
    ]);
    await pedir('Cobros vencidos de este año');
    expect(await screen.findByText('Preparando el reporte…')).toBeTruthy();

    const resultado = within(await screen.findByRole('region', { name: 'Resultado del reporte' }));
    expect(resultado.getByRole('heading', { name: 'Cobros' })).toBeTruthy();
    expect(resultado.getByText('Hay 1 cobro vencido por Bs 12 500.')).toBeTruthy();
    expect(resultado.getByText('Estado: Vencido')).toBeTruthy();
    expect(resultado.getByText('Bs 12.500,00')).toBeTruthy();
    expect(screen.queryByText('Preparando el reporte…')).toBeNull();
  });

  it('un reporte común se pide con su atajo, sin texto (criterio 4)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ atajo: 'COBROS_VENCIDOS' }, { datos: { texto: null, atajo: 'COBROS_VENCIDOS' } }),
      historial(),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Cobros vencidos' }));
    const resultado = within(await screen.findByRole('region', { name: 'Resultado del reporte' }));
    expect(resultado.getByText('Pedido: Cobros vencidos')).toBeTruthy();
    expect(cuadro()).toBeTruthy();
  });

  it('si pasan 60 segundos sin respuesta avisa «El reporte tardó demasiado; intenta de nuevo» (criterio 11)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: 'Cobros vencidos de este año' }, { demora: 120_000 }),
    ]);
    await pedir('Cobros vencidos de este año');
    expect(await screen.findByText('Preparando el reporte…')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(await screen.findByText('El reporte tardó demasiado; intenta de nuevo')).toBeTruthy();
  });
});
