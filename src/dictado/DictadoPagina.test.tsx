import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';

beforeEach(() => {
  window.plataforma = {
    sesion: {
      usuario: { id: 'u1', nombre: 'Rosa', roles: ['residente'] },
      obtenerToken: vi.fn().mockResolvedValue('t'),
      cerrarSesion: vi.fn(),
    },
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.plataforma;
});

function dibujar(ruta: string) {
  const historial = createMemoryHistory({ initialEntries: [ruta] });
  render(
    <MockedProvider mocks={[]}>
      <RouterProvider router={crearRouter(historial)} />
    </MockedProvider>,
  );
  return historial;
}

describe('DictadoPagina (302, criterio 11)', () => {
  it('se llega desde el menú interno «Dictado»', async () => {
    const historial = dibujar('/supervision/riesgo');
    fireEvent.click(await screen.findByRole('tab', { name: 'Dictado' }));
    expect(await screen.findByRole('heading', { name: 'Dictado', level: 1 })).toBeTruthy();
    expect(historial.location.pathname).toBe('/supervision/dictado');
  });

  it('«Copiar texto» copia lo escrito o dictado al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    dibujar('/supervision/dictado');

    const boton = (await screen.findByRole('button', { name: 'Copiar texto' })) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto dictado' }), {
      target: { value: 'Vaciado de losa del tercer piso' },
    });
    fireEvent.click(boton);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Vaciado de losa del tercer piso'));
    expect(await screen.findByText('Texto copiado')).toBeTruthy();
  });

  it('en este navegador de pruebas (sin micrófono) el campo sirve para escribir', async () => {
    dibujar('/supervision/dictado');
    expect(
      await screen.findByText('El dictado no está disponible en este navegador; puedes escribir el texto.'),
    ).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Texto dictado' }) as HTMLTextAreaElement).disabled).toBe(false);
  });
});
