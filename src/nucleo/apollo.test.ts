import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApolloLink, gql } from '@apollo/client';
import { Observable } from 'rxjs';
import { crearClienteApollo } from './apollo';

afterEach(() => {
  delete window.plataforma;
});

const CONSULTA = gql`
  query Prueba {
    salud
  }
`;

/** Enlace final simulado: guarda los encabezados que le llegan y responde { salud: "ok" }. */
function enlaceSimulado(encabezados: Record<string, string>[]) {
  return new ApolloLink((operacion) => {
    encabezados.push(operacion.getContext().headers as Record<string, string>);
    return new Observable((observador) => {
      observador.next({ data: { salud: 'ok' } });
      observador.complete();
    });
  });
}

describe('cliente Apollo', () => {
  it('agrega el token del shell en Authorization a cada operación', async () => {
    const obtenerToken = vi.fn().mockResolvedValue('token-1');
    window.plataforma = {
      sesion: { usuario: { id: 'u', nombre: 'Ana', roles: ['gerente'] }, obtenerToken, cerrarSesion: vi.fn() },
      configuracion: { gatewayUrl: 'http://gateway/graphql' },
    };
    const encabezados: Record<string, string>[] = [];
    const cliente = crearClienteApollo(enlaceSimulado(encabezados));

    const { data } = await cliente.query({ query: CONSULTA, fetchPolicy: 'network-only' });

    expect(data).toEqual({ salud: 'ok' });
    expect(encabezados[0]).toMatchObject({ authorization: 'Bearer token-1' });
    expect(obtenerToken).toHaveBeenCalledTimes(1);
  });

  it('sin sesión del shell la operación falla sin llamar al gateway', async () => {
    const encabezados: Record<string, string>[] = [];
    const cliente = crearClienteApollo(enlaceSimulado(encabezados));
    await expect(cliente.query({ query: CONSULTA, fetchPolicy: 'network-only' })).rejects.toThrow(
      'No hay sesión del ERP',
    );
    expect(encabezados).toHaveLength(0);
  });
});
