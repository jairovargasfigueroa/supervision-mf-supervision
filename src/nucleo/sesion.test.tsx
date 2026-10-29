import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { EVENTO_SESION, obtenerSesion, obtenerToken, useSesion, type SesionPlataforma } from './sesion';
import { GATEWAY_URL_DESARROLLO, obtenerGatewayUrl } from './configuracion';

function crearSesion(nombre: string, token = 'token-1'): SesionPlataforma {
  return {
    usuario: { id: 'u1', nombre, roles: ['admin'] },
    obtenerToken: vi.fn().mockResolvedValue(token),
    cerrarSesion: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  delete window.plataforma;
});

describe('sesion', () => {
  it('no hay sesión si el shell no publicó window.plataforma', async () => {
    expect(obtenerSesion()).toBeUndefined();
    await expect(obtenerToken()).rejects.toThrow('No hay sesión del ERP');
  });

  it('delega obtenerToken en la sesión del shell', async () => {
    const sesion = crearSesion('Ana');
    window.plataforma = { sesion, configuracion: { gatewayUrl: 'http://gw/graphql' } };
    await expect(obtenerToken()).resolves.toBe('token-1');
    expect(sesion.obtenerToken).toHaveBeenCalledOnce();
  });

  it('useSesion se actualiza con el evento plataforma:sesion', () => {
    function Nombre() {
      const sesion = useSesion();
      return <span>{sesion ? sesion.usuario.nombre : 'sin sesión'}</span>;
    }
    window.plataforma = { sesion: crearSesion('Ana'), configuracion: { gatewayUrl: 'x' } };
    render(<Nombre />);
    expect(screen.getByText('Ana')).toBeTruthy();

    act(() => {
      window.plataforma!.sesion = undefined;
      window.dispatchEvent(new Event(EVENTO_SESION));
    });
    expect(screen.getByText('sin sesión')).toBeTruthy();
  });
});

describe('configuracion', () => {
  it('usa la URL del gateway que publica el shell', () => {
    window.plataforma = { configuracion: { gatewayUrl: 'https://erp.example/graphql' } };
    expect(obtenerGatewayUrl()).toBe('https://erp.example/graphql');
  });

  it('usa la URL local si el microfrontend se abrió solo', () => {
    expect(obtenerGatewayUrl()).toBe(GATEWAY_URL_DESARROLLO);
    expect(GATEWAY_URL_DESARROLLO).toBe('http://localhost:4000/graphql');
  });
});
