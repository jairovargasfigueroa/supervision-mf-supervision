import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';
import { TABLERO, type NivelRiesgo } from '../tablero/tablero.graphql';
import { HISTORIAL_RIESGO, MODELO_RIESGO } from './riesgo.graphql';

beforeEach(() => {
  window.plataforma = {
    sesion: {
      usuario: { id: 'u1', nombre: 'Ana', roles: ['gerente'] },
      obtenerToken: vi.fn().mockResolvedValue('t'),
      cerrarSesion: vi.fn(),
    },
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
  };
});
afterEach(() => {
  cleanup();
  delete window.plataforma;
});

const OBRA_1 = 'b0000000-0000-4000-8000-000000000101';
const OBRA_2 = 'b0000000-0000-4000-8000-000000000102';
const OBRA_3 = 'b0000000-0000-4000-8000-000000000103';

const riesgo = (probabilidad: number | null, nivel: NivelRiesgo, factores: string[] = []) => ({
  __typename: 'RiesgoRetraso',
  probabilidad,
  nivel,
  factores: factores.map((descripcion, i) => ({ __typename: 'FactorRiesgo', variable: `v${i}`, descripcion, peso: 0.5 })),
  versionModelo: nivel === 'SIN_DATOS' ? null : 'rr-1.0.0',
  calculadaEn: nivel === 'SIN_DATOS' ? null : '2026-11-15T05:00:00Z',
});

const fila = (obraId: string, nombre: string, riesgoRetraso: ReturnType<typeof riesgo> | null) => ({
  __typename: 'FilaTablero',
  obraId,
  nombre,
  avancePct: 20,
  plazoPct: 30,
  diferencia: 10,
  enRiesgo: false,
  materialesBajos: 0,
  ultimaPlanilla: null,
  riesgoRetraso,
});

// Llegan sin ordenar
const FILAS = [
  fila(OBRA_3, 'Unidad Educativa San Martín', riesgo(null, 'SIN_DATOS')),
  fila(OBRA_1, 'Edificio Las Palmeras', riesgo(0.35, 'MEDIO', ['Ya transcurrió 35 % del plazo'])),
  fila(
    OBRA_2,
    'Condominio Las Lomas',
    riesgo(0.72, 'ALTO', [
      'El ritmo de avance de los últimos meses es menor al necesario para terminar a tiempo',
      'Se observaron 2 planillas',
    ]),
  ),
];

const respuestaTablero = (obras: ReturnType<typeof fila>[] = FILAS) => ({
  tablero: {
    __typename: 'Tablero',
    indicadores: {
      __typename: 'IndicadoresTablero',
      obrasEnEjecucion: 3,
      obrasEnRiesgo: 0,
      materialesBajos: 0,
      cobrosVencidos: { __typename: 'ResumenMonto', cantidad: 0, monto: 0 },
      obrasRiesgoAlto: 1,
    },
    obras,
  },
});

const sinIa = (...camino: (string | number)[]) => ({
  message: 'x',
  path: camino,
  extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'ia' },
});

const tablero = (datos = respuestaTablero(), errores?: ReturnType<typeof sinIa>[]): MockLink.MockedResponse => ({
  request: { query: TABLERO, variables: {} },
  result: errores ? { data: datos, errors: errores } : { data: datos },
});

const MODELO = {
  __typename: 'ModeloRiesgo',
  versionModelo: 'rr-1.0.0',
  entrenadoEn: '2026-11-20T15:00:00Z',
  datos: 'SINTETICOS',
  filasEntrenamiento: 9600,
  metricas: {
    __typename: 'MetricasModeloRiesgo',
    aucRoc: 0.86,
    aucRocRegla: 0.74,
    recallMedio: 0.83,
    precisionAlto: 0.74,
    brier: 0.14,
  },
  umbralMedio: 0.3,
  umbralAlto: 0.6,
};

const modelo = (modeloRiesgo: typeof MODELO | null = MODELO, codigo?: string): MockLink.MockedResponse => ({
  request: { query: MODELO_RIESGO, variables: {} },
  result: codigo
    ? { data: { modeloRiesgo: null }, errors: [{ message: 'x', path: ['modeloRiesgo'], extensions: { codigo, servicio: 'ia' } }] }
    : { data: { modeloRiesgo } },
});

const historial = (id: string, puntos: { probabilidad: number; calculadaEn: string }[] | null): MockLink.MockedResponse => ({
  request: { query: HISTORIAL_RIESGO, variables: { id } },
  result:
    puntos === null
      ? { data: { obra: { __typename: 'Obra', id, historialRiesgo: null } }, errors: [sinIa('obra', 'historialRiesgo')] }
      : {
          data: {
            obra: { __typename: 'Obra', id, historialRiesgo: puntos.map((p) => ({ __typename: 'PuntoRiesgo', ...p })) },
          },
        },
});

function dibujar(mocks: MockLink.MockedResponse[]) {
  const historialNavegador = createMemoryHistory({ initialEntries: ['/supervision/riesgo'] });
  render(
    <MockedProvider mocks={mocks}>
      <RouterProvider router={crearRouter(historialNavegador)} />
    </MockedProvider>,
  );
}

const filasTabla = async () => {
  let filas: HTMLElement[] = [];
  await waitFor(() => {
    filas = within(screen.getByRole('table', { name: 'Riesgo de retraso por obra' })).getAllByRole('row').slice(1);
    if (filas.length === 0) throw new Error('sin datos');
  });
  return filas;
};
const nombres = (filas: HTMLElement[]) => filas.map((f) => within(f).getAllByRole('cell')[0].textContent);
const panelModelo = () => within(screen.getByRole('region', { name: 'Sobre el modelo' }));

describe('RiesgoPagina (402)', () => {
  it('lista las obras de mayor a menor probabilidad con nivel, factores y fecha de cálculo (criterio 8)', async () => {
    dibujar([tablero(), modelo()]);
    const filas = await filasTabla();
    expect(nombres(filas)).toEqual(['Condominio Las Lomas', 'Edificio Las Palmeras', 'Unidad Educativa San Martín']);

    const lomas = within(filas[0]);
    expect(lomas.getByText('Alto').closest('[data-tono]')?.getAttribute('data-tono')).toBe('error');
    expect(lomas.getByText('72 %')).toBeTruthy();
    expect(lomas.getByText('El ritmo de avance de los últimos meses es menor al necesario para terminar a tiempo')).toBeTruthy();
    expect(lomas.getByText('Se observaron 2 planillas')).toBeTruthy();
    expect(lomas.getByText('15/11/2026 01:00')).toBeTruthy();
    expect(within(filas[1]).getByText('Medio').closest('[data-tono]')?.getAttribute('data-tono')).toBe('atencion');
    expect(within(filas[2]).getByText('Sin datos')).toBeTruthy();
    expect(within(filas[2]).getAllByRole('cell')[3].textContent).toBe('—');
    expect(screen.getByText('Elige una obra para ver su historial.')).toBeTruthy();
  });

  it('al elegir una obra muestra sus factores y el gráfico de su historial (criterio 8)', async () => {
    dibujar([
      tablero(),
      modelo(),
      historial(OBRA_2, [
        { probabilidad: 0.55, calculadaEn: '2026-11-13T05:00:00Z' },
        { probabilidad: 0.65, calculadaEn: '2026-11-14T05:00:00Z' },
        { probabilidad: 0.72, calculadaEn: '2026-11-15T05:00:00Z' },
      ]),
    ]);
    const [lomas] = await filasTabla();
    fireEvent.click(lomas);

    const panel = within(await screen.findByRole('region', { name: 'Riesgo de Condominio Las Lomas' }));
    expect(panel.getByText('Se observaron 2 planillas')).toBeTruthy();
    const grafico = await panel.findByRole('img', { name: 'Historial del riesgo de Condominio Las Lomas: 3 cálculos' });
    expect(grafico.querySelectorAll('circle')).toHaveLength(3);
  });

  it('el panel «Sobre el modelo» muestra versión, fecha, métricas, origen de los datos y el aviso (criterio 9)', async () => {
    dibujar([tablero(), modelo()]);
    await filasTabla();
    const panel = panelModelo();
    expect(await panel.findByText('rr-1.0.0')).toBeTruthy();
    expect(panel.getByText('20/11/2026')).toBeTruthy();
    expect(panel.getByText('Datos sintéticos · 9.600 filas de entrenamiento')).toBeTruthy();
    expect(panel.getByText('0,86 (regla actual: 0,74)')).toBeTruthy();
    expect(panel.getByText('0,83')).toBeTruthy();
    expect(panel.getByText('0,14')).toBeTruthy();
    expect(panel.getByText('Medio desde 30 % · Alto desde 60 %')).toBeTruthy();
    expect(
      panel.getByText(
        'Modelo entrenado con datos sintéticos; es una estimación de apoyo, no reemplaza la revisión de la obra',
      ),
    ).toBeTruthy();
    expect(panel.getByText(/no prueban que acierte con obras reales/)).toBeTruthy();
  });

  it('con un modelo reentrenado con datos reales cambia el aviso (criterio 9)', async () => {
    dibujar([tablero(), modelo({ ...MODELO, versionModelo: 'rr-1.1.0', datos: 'REALES', filasEntrenamiento: 240 })]);
    await filasTabla();
    const panel = panelModelo();
    expect(
      await panel.findByText(
        'Modelo entrenado con datos reales; es una estimación de apoyo, no reemplaza la revisión de la obra',
      ),
    ).toBeTruthy();
    expect(panel.getByText('Datos reales · 240 filas de entrenamiento')).toBeTruthy();
    expect(panel.queryByText(/datos sintéticos/)).toBeNull();
    expect(panel.queryByText(/no prueban que acierte/)).toBeNull();
  });

  it('sin modelo cargado avisa «El modelo de riesgo no está disponible por el momento.»', async () => {
    dibujar([tablero(), modelo(null, 'MODELO_NO_DISPONIBLE')]);
    await filasTabla();
    expect(await panelModelo().findByText('El modelo de riesgo no está disponible por el momento.')).toBeTruthy();
  });

  it('con IA caída el riesgo, el historial y el modelo muestran «—» con «Datos de IA no disponibles» (criterio 12)', async () => {
    const filasSinIa = FILAS.map((f) => ({ ...f, riesgoRetraso: null }));
    dibujar([
      tablero(
        respuestaTablero(filasSinIa),
        filasSinIa.map((_, i) => sinIa('tablero', 'obras', i, 'riesgoRetraso')),
      ),
      modelo(null, 'SERVICIO_NO_DISPONIBLE'),
      historial(OBRA_1, null),
    ]);
    const filas = await filasTabla();
    // La lista se sigue viendo, con «—» en el riesgo
    expect(nombres(filas)).toHaveLength(3);
    for (const f of filas) expect(within(f).getByLabelText('Datos de IA no disponibles').textContent).toBe('—');
    expect(screen.getByRole('alert').textContent).toBe('Datos de IA no disponibles');
    expect(await panelModelo().findByText('Datos de IA no disponibles')).toBeTruthy();

    fireEvent.click(screen.getByRole('row', { name: 'Ver el historial de Edificio Las Palmeras' }));
    const panel = within(await screen.findByRole('region', { name: 'Riesgo de Edificio Las Palmeras' }));
    expect(await panel.findByText('Datos de IA no disponibles')).toBeTruthy();
    expect(panel.queryByRole('img')).toBeNull();
  });

  it('se llega desde el menú interno «Riesgo de retraso»', async () => {
    const historialNavegador = createMemoryHistory({ initialEntries: ['/supervision'] });
    render(
      <MockedProvider mocks={[tablero(), tablero(), modelo()]}>
        <RouterProvider router={crearRouter(historialNavegador)} />
      </MockedProvider>,
    );
    fireEvent.click(await screen.findByRole('tab', { name: 'Riesgo de retraso' }));
    expect(await screen.findByRole('heading', { name: 'Riesgo de retraso', level: 1 })).toBeTruthy();
    expect(historialNavegador.location.pathname).toBe('/supervision/riesgo');
    expect(screen.getByRole('tab', { name: 'Riesgo de retraso' }).getAttribute('aria-selected')).toBe('true');
  });
});
