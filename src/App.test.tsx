import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from './App';

afterEach(() => {
  cleanup();
  delete window.plataforma;
});

describe('App', () => {
  it('pide abrir la pantalla desde el ERP si no hay sesión del shell', () => {
    render(<App />);
    expect(screen.getByText('Abre esta pantalla desde el ERP')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('muestra el área con su estado vacío si hay sesión', () => {
    window.plataforma = {
      sesion: {
        usuario: { id: 'u1', nombre: 'Ana', roles: ['admin'] },
        obtenerToken: vi.fn().mockResolvedValue('t'),
        cerrarSesion: vi.fn(),
      },
      configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
    };
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Supervisión' })).toBeTruthy();
    expect(screen.getByText('Aún no hay pantallas en esta área.')).toBeTruthy();
  });
});
