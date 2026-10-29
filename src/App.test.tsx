import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.plataforma;
});

function conSesion() {
  window.plataforma = {
    sesion: {
      usuario: { id: 'u1', nombre: 'Ana', roles: ['gerente'] },
      obtenerToken: vi.fn().mockResolvedValue('t'),
      cerrarSesion: vi.fn(),
    },
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
  };
  // El gateway no responde en estas pruebas: solo interesa la ruta que se abre
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
}

describe('App', () => {
  it('pide abrir la pantalla desde el ERP si no hay sesión del shell', () => {
    render(<App />);
    expect(screen.getByText('Abre esta pantalla desde el ERP')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('/supervision abre el tablero', async () => {
    conSesion();
    const historial = createMemoryHistory({ initialEntries: ['/supervision'] });
    render(<App historial={historial} />);
    expect(await screen.findByRole('heading', { name: 'Tablero de obras' })).toBeTruthy();
  });

  it('una ruta desconocida muestra el aviso con el enlace al tablero', async () => {
    conSesion();
    const historial = createMemoryHistory({ initialEntries: ['/supervision/otra'] });
    render(<App historial={historial} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ir al tablero' }));
    expect(await screen.findByRole('heading', { name: 'Tablero de obras' })).toBeTruthy();
    expect(historial.location.pathname).toMatch(/^\/supervision\/?$/);
  });
});
