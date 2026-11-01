import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';

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

describe('AgentesPagina (502): acceso', () => {
  it.each(['gerente', 'admin', 'residente'])('%s llega desde el menú interno «Agentes»', async (rol) => {
    sesion([rol]);
    const historial = dibujar('/supervision/dictado');
    fireEvent.click(await screen.findByRole('tab', { name: 'Agentes' }));
    expect(await screen.findByRole('heading', { name: 'Agentes', level: 1 })).toBeTruthy();
    expect(historial.location.pathname).toBe('/supervision/agentes');
  });
});
