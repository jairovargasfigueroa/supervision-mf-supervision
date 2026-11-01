import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';
import { AGENTES, EJECUCIONES_AGENTE, HALLAZGOS, SUGERENCIAS } from './agentes.graphql';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

const sinIa = (campo: string) => ({
  data: null,
  errors: [{ message: 'x', path: [campo], extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'ia' } }],
});

const agente = (agente: string, nombre: string, mision: string) => ({
  __typename: 'AgenteInfo',
  agente,
  nombre,
  mision,
  herramientas: [],
  ultimaEjecucion: null,
  sugerenciasPendientes: 1,
});

const agentes = (lista: object[] | null): MockLink.MockedResponse => ({
  request: { query: AGENTES, variables: {} },
  result: lista ? { data: { agentes: lista } } : sinIa('agentes'),
});

const sugerencias = (lista: object[] | null): MockLink.MockedResponse => ({
  request: { query: SUGERENCIAS, variables: { estado: 'PENDIENTE', limite: 50 } },
  result: lista ? { data: { sugerencias: lista } } : sinIa('sugerencias'),
});

const hallazgos = (lista: object[] | null = []): MockLink.MockedResponse => ({
  request: { query: HALLAZGOS, variables: {} },
  result: lista ? { data: { hallazgos: lista } } : sinIa('hallazgos'),
});

const ejecuciones = (lista: object[] | null = []): MockLink.MockedResponse => ({
  request: { query: EJECUCIONES_AGENTE, variables: { limite: 20 } },
  result: lista ? { data: { ejecucionesAgente: lista } } : sinIa('ejecucionesAgente'),
});

const SEGUIMIENTO = agente('SEGUIMIENTO_OBRAS', 'Seguimiento de obras', 'Detectar obras atrasadas');
const MATERIALES = agente('CONTROL_MATERIALES', 'Control de materiales', 'Detectar stock bajo');
const COBROS = agente('CONTROL_COBROS', 'Control de cobros', 'Detectar cobros vencidos');

const SUGERENCIA = {
  __typename: 'Sugerencia',
  id: 's1',
  ejecucionId: 'e1',
  agente: 'SEGUIMIENTO_OBRAS',
  obraId: 'o1',
  obraNombre: 'Condominio Las Lomas',
  accion: 'PROGRAMAR_VISITA',
  accionTexto: 'Programar una visita de supervisión a la obra',
  descripcion: 'Atraso de 14 puntos <script>alert("x")</script>',
  estado: 'PENDIENTE',
  creadaEn: '2027-04-20T10:01:12Z',
  decididaPor: null,
  decididaEn: null,
  comentario: null,
};

describe('AgentesPagina (502): acceso', () => {
  it.each(['gerente', 'admin', 'residente'])('%s llega desde el menú interno «Agentes»', async (rol) => {
    sesion([rol]);
    const historial = dibujar('/supervision/dictado');
    fireEvent.click(await screen.findByRole('tab', { name: 'Agentes' }));
    expect(await screen.findByRole('heading', { name: 'Agentes', level: 1 })).toBeTruthy();
    expect(historial.location.pathname).toBe('/supervision/agentes');
  });
});

describe('AgentesPagina (502): vista por rol', () => {
  it('el gerente ve las tres tarjetas con «Ejecutar ahora», las sugerencias y el historial', async () => {
    sesion(['gerente']);
    dibujar('/supervision/agentes', [agentes([SEGUIMIENTO, MATERIALES, COBROS]), sugerencias([SUGERENCIA]), hallazgos(), ejecuciones()]);
    expect(await screen.findByRole('region', { name: 'Control de cobros' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ejecutar ahora' })).toHaveLength(3);
    expect(await screen.findByRole('listitem', { name: 'Sugerencia para Condominio Las Lomas' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Historial de ejecuciones' })).toBeTruthy();
  });

  it('el residente no ve «Ejecutar ahora» ni el historial (y el servidor no le manda Control de cobros)', async () => {
    sesion(['residente']);
    dibujar('/supervision/agentes', [agentes([SEGUIMIENTO, MATERIALES]), sugerencias([SUGERENCIA]), hallazgos()]);
    expect(await screen.findByRole('region', { name: 'Seguimiento de obras' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ejecutar ahora' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Control de cobros' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Historial de ejecuciones' })).toBeNull();
    // Puede decidir las sugerencias de sus obras
    const item = within(await screen.findByRole('listitem', { name: 'Sugerencia para Condominio Las Lomas' }));
    expect(item.getByRole('button', { name: 'Aprobar' })).toBeTruthy();
  });

  it('el texto de una sugerencia con etiquetas HTML se muestra como texto', async () => {
    sesion(['gerente']);
    dibujar('/supervision/agentes', [agentes([SEGUIMIENTO]), sugerencias([SUGERENCIA]), hallazgos(), ejecuciones()]);
    const item = within(await screen.findByRole('listitem', { name: 'Sugerencia para Condominio Las Lomas' }));
    expect(item.getByText('Atraso de 14 puntos <script>alert("x")</script>')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
  });
});

describe('AgentesPagina (502): IA no responde (criterio 21)', () => {
  it('cada sección de agentes muestra «No disponible por el momento»', async () => {
    sesion(['gerente']);
    dibujar('/supervision/agentes', [agentes(null), sugerencias(null), hallazgos(null), ejecuciones(null)]);
    const tarjetas = within(await screen.findByRole('region', { name: 'Agentes disponibles' }));
    expect(await tarjetas.findByText('No disponible por el momento')).toBeTruthy();
    expect(await within(screen.getByRole('region', { name: 'Sugerencias' })).findByText('No disponible por el momento')).toBeTruthy();
    expect(
      await within(screen.getByRole('region', { name: 'Historial de ejecuciones' })).findByText('No disponible por el momento'),
    ).toBeTruthy();
    // El resto de Supervisión sigue: el menú interno está
    expect(screen.getByRole('tab', { name: 'Tablero' })).toBeTruthy();
  });

  it('«Reintentar» vuelve a pedir las tarjetas', async () => {
    sesion(['residente']);
    dibujar('/supervision/agentes', [agentes(null), sugerencias([]), hallazgos(), agentes([SEGUIMIENTO])]);
    const tarjetas = within(await screen.findByRole('region', { name: 'Agentes disponibles' }));
    fireEvent.click(await tarjetas.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Seguimiento de obras' })).toBeTruthy();
  });
});
