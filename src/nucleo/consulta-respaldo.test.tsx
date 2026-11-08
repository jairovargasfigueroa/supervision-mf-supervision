import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { gql, type TypedDocumentNode } from '@apollo/client';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { EVENTO_CONEXION, type AlmacenPlataforma } from './conexion';
import { claveConsulta, esFalloDeRed, nombreOperacion, useConsultaConRespaldo } from './consulta-respaldo';

interface Datos {
  material: { __typename: 'Material'; id: string; nombre: string };
}

const MATERIAL: TypedDocumentNode<Datos, { id: string }> = gql`
  query MaterialPrueba($id: ID!) {
    material(id: $id) {
      id
      nombre
    }
  }
`;

const datos = (nombre: string): Datos => ({ material: { __typename: 'Material', id: 'm1', nombre } });
const CLAVE = 'MaterialPrueba:{"id":"m1"}';
const GUARDADO_EN = '2026-10-30T18:05:00.000Z'; // 14:05 en La Paz

/** Almacén en memoria con la interfaz que publica el shell. */
function crearAlmacen(inicial: Record<string, { datos: unknown; guardadoEn: string }> = {}) {
  const consultas = new Map(Object.entries(inicial));
  const almacen = {
    guardarConsulta: vi.fn(async (clave: string, d: unknown) => {
      consultas.set(clave, { datos: d, guardadoEn: new Date().toISOString() });
    }),
    leerConsulta: vi.fn(async (clave: string) => consultas.get(clave) ?? null),
  };
  return { almacen: almacen as typeof almacen & AlmacenPlataforma, consultas };
}

function publicarShell(almacen: AlmacenPlataforma | undefined, enLinea = true) {
  const conexion = { enLinea, reportarFallo: vi.fn() };
  window.plataforma = {
    sesion: {
      usuario: { id: 'u1', nombre: 'Ana', roles: ['admin'] },
      obtenerToken: vi.fn().mockResolvedValue('t'),
      cerrarSesion: vi.fn(),
    },
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
    conexion,
    almacen,
  };
  return conexion;
}

function cambiarConexion(enLinea: boolean) {
  act(() => {
    window.plataforma!.conexion!.enLinea = enLinea;
    window.dispatchEvent(new CustomEvent(EVENTO_CONEXION, { detail: { enLinea } }));
  });
}

function Prueba({ errorPolicy }: { errorPolicy?: 'all' }) {
  const consulta = useConsultaConRespaldo(MATERIAL, { variables: { id: 'm1' }, errorPolicy });
  return (
    <div>
      <AvisoSinConexion consulta={consulta} />
      <span data-testid="nombre">{consulta.data?.material.nombre ?? '-'}</span>
      <span data-testid="origen">{consulta.desdeEquipo ? 'equipo' : 'red'}</span>
      <span data-testid="error">{consulta.error ? 'con error' : 'sin error'}</span>
    </div>
  );
}

const respuesta = (nombre: string): MockLink.MockedResponse => ({
  request: { query: MATERIAL, variables: { id: 'm1' } },
  result: { data: datos(nombre) },
});
const falloDeRed: MockLink.MockedResponse = {
  request: { query: MATERIAL, variables: { id: 'm1' } },
  error: new TypeError('Failed to fetch'),
};

function dibujar(mocks: MockLink.MockedResponse[], errorPolicy?: 'all') {
  render(
    <MockedProvider mocks={mocks}>
      <Prueba errorPolicy={errorPolicy} />
    </MockedProvider>,
  );
}

const nombre = () => screen.getByTestId('nombre').textContent;

beforeEach(() => {
  delete window.plataforma;
});
afterEach(() => {
  cleanup();
  delete window.plataforma;
});

describe('claveConsulta', () => {
  it('es "{nombreOperacion}:{JSON.stringify(variables)}"', () => {
    expect(nombreOperacion(MATERIAL)).toBe('MaterialPrueba');
    expect(claveConsulta(MATERIAL, { id: 'm1' })).toBe(CLAVE);
    expect(claveConsulta(MATERIAL)).toBe('MaterialPrueba:{}');
    // Las variables sin valor no cuentan (igual que en la petición)
    expect(claveConsulta(MATERIAL, { id: 'm1', busqueda: undefined })).toBe(CLAVE);
  });
});

describe('esFalloDeRed', () => {
  it('es fallo de red lo que no es una respuesta del gateway', () => {
    expect(esFalloDeRed(new TypeError('Failed to fetch'))).toBe(true);
    expect(esFalloDeRed(new DOMException('tiempo', 'TimeoutError'))).toBe(true);
  });

  it('los errores GraphQL y los rechazos HTTP del gateway no son fallos de red', () => {
    const graphql = new CombinedGraphQLErrors({ errors: [{ message: 'x', extensions: { codigo: 'SIN_PERMISO' } }] });
    expect(esFalloDeRed(graphql)).toBe(false);
    const respuestaGateway = (estado: number, cuerpo: string) =>
      new ServerError('x', { response: new Response(cuerpo, { status: estado }), bodyText: cuerpo });
    expect(esFalloDeRed(respuestaGateway(401, '{"errors":[{"extensions":{"codigo":"NO_AUTENTICADO"}}]}'))).toBe(false);
    expect(esFalloDeRed(respuestaGateway(503, '{"errors":[{"extensions":{"codigo":"SERVICIO_NO_DISPONIBLE"}}]}'))).toBe(
      false,
    );
    // Un intermediario responde 502 o 504 cuando el gateway no contesta
    expect(esFalloDeRed(respuestaGateway(502, '<html>Bad Gateway</html>'))).toBe(true);
  });
});

describe('useConsultaConRespaldo', () => {
  it('en línea guarda la respuesta completa y la muestra como de la red', async () => {
    const { almacen, consultas } = crearAlmacen();
    publicarShell(almacen);
    dibujar([respuesta('Cemento')]);

    await waitFor(() => expect(nombre()).toBe('Cemento'));
    expect(screen.getByTestId('origen').textContent).toBe('red');
    await waitFor(() => expect(almacen.guardarConsulta).toHaveBeenCalledWith(CLAVE, datos('Cemento')));
    expect(consultas.has(CLAVE)).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ante un error de red avisa al shell y muestra lo guardado con su fecha', async () => {
    const { almacen } = crearAlmacen({ [CLAVE]: { datos: datos('Cemento guardado'), guardadoEn: GUARDADO_EN } });
    const conexion = publicarShell(almacen);
    dibujar([falloDeRed]);

    await waitFor(() => expect(nombre()).toBe('Cemento guardado'));
    expect(screen.getByTestId('origen').textContent).toBe('equipo');
    expect(screen.getByTestId('error').textContent).toBe('sin error');
    expect(screen.getByRole('status').textContent).toBe('Sin conexión · datos del 30/10/2026 14:05');
    expect(conexion.reportarFallo).toHaveBeenCalledOnce();
    expect(almacen.guardarConsulta).not.toHaveBeenCalled();
  });

  it('sin conexión no va a la red y lee lo guardado', async () => {
    const { almacen } = crearAlmacen({ [CLAVE]: { datos: datos('Cemento guardado'), guardadoEn: GUARDADO_EN } });
    const conexion = publicarShell(almacen, false);
    // Sin respuestas simuladas: si fuera a la red, fallaría
    dibujar([]);

    await waitFor(() => expect(nombre()).toBe('Cemento guardado'));
    expect(almacen.leerConsulta).toHaveBeenCalledWith(CLAVE);
    expect(screen.getByRole('status').textContent).toBe('Sin conexión · datos del 30/10/2026 14:05');
    expect(conexion.reportarFallo).not.toHaveBeenCalled();
  });

  it('sin conexión y sin nada guardado avisa que no hay datos de esta pantalla', async () => {
    publicarShell(crearAlmacen().almacen, false);
    dibujar([]);
    expect((await screen.findByRole('status')).textContent).toBe('No hay datos guardados de esta pantalla');
    expect(nombre()).toBe('-');
  });

  it('una respuesta con errores se muestra como antes y no reemplaza la guardada', async () => {
    const { almacen } = crearAlmacen({ [CLAVE]: { datos: datos('Cemento guardado'), guardadoEn: GUARDADO_EN } });
    const conexion = publicarShell(almacen);
    dibujar([
      {
        request: { query: MATERIAL, variables: { id: 'm1' } },
        result: {
          data: { material: null },
          errors: [{ message: 'x', extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'materiales' } }],
        },
      },
    ]);

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('con error'));
    expect(screen.getByTestId('origen').textContent).toBe('red');
    expect(almacen.guardarConsulta).not.toHaveBeenCalled();
    expect(conexion.reportarFallo).not.toHaveBeenCalled();
  });

  it("con errorPolicy 'all' muestra la respuesta parcial con su error y no la guarda", async () => {
    const { almacen } = crearAlmacen({ [CLAVE]: { datos: datos('Cemento guardado'), guardadoEn: GUARDADO_EN } });
    publicarShell(almacen);
    dibujar(
      [
        {
          request: { query: MATERIAL, variables: { id: 'm1' } },
          result: {
            data: datos('Cemento parcial'),
            errors: [{ message: 'x', extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'finanzas' } }],
          },
        },
      ],
      'all',
    );

    await waitFor(() => expect(nombre()).toBe('Cemento parcial'));
    expect(screen.getByTestId('error').textContent).toBe('con error');
    expect(screen.getByTestId('origen').textContent).toBe('red');
    expect(almacen.guardarConsulta).not.toHaveBeenCalled();
  });

  it('al volver la conexión vuelve a la red y guarda la respuesta nueva', async () => {
    const { almacen } = crearAlmacen({ [CLAVE]: { datos: datos('Cemento guardado'), guardadoEn: GUARDADO_EN } });
    publicarShell(almacen, false);
    dibujar([respuesta('Cemento nuevo')]);
    await waitFor(() => expect(nombre()).toBe('Cemento guardado'));

    cambiarConexion(true);
    await waitFor(() => expect(nombre()).toBe('Cemento nuevo'));
    expect(screen.getByTestId('origen').textContent).toBe('red');
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect(almacen.guardarConsulta).toHaveBeenCalledWith(CLAVE, datos('Cemento nuevo')));
  });

  it('al perder la conexión pasa a lo guardado', async () => {
    const { almacen } = crearAlmacen();
    publicarShell(almacen);
    dibujar([respuesta('Cemento')]);
    await waitFor(() => expect(almacen.guardarConsulta).toHaveBeenCalled());

    cambiarConexion(false);
    await waitFor(() => expect(screen.getByTestId('origen').textContent).toBe('equipo'));
    expect(nombre()).toBe('Cemento');
    expect(screen.getByRole('status').textContent).toMatch(/^Sin conexión · datos del \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it('sin almacén del shell trabaja como antes: el error de red se muestra y no se guarda nada', async () => {
    const conexion = publicarShell(undefined);
    dibujar([falloDeRed]);
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('con error'));
    expect(screen.getByTestId('origen').textContent).toBe('red');
    expect(conexion.reportarFallo).not.toHaveBeenCalled();
  });
});
