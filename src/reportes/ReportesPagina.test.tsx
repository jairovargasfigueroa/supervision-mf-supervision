import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';

afterEach(() => {
  cleanup();
  delete window.plataforma;
});

function sesion(roles: string[]) {
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

describe('ReportesPagina (503): acceso', () => {
  it('el gerente llega desde el menú interno «Reportes»', async () => {
    sesion(['gerente']);
    const historial = dibujar('/supervision/dictado');
    fireEvent.click(await screen.findByRole('tab', { name: 'Reportes' }));
    expect(await screen.findByRole('heading', { name: 'Reportes', level: 1 })).toBeTruthy();
    expect(historial.location.pathname).toBe('/supervision/reportes');
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
