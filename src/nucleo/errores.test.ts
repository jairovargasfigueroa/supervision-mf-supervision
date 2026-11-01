import { describe, expect, it } from 'vitest';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { avisoNoDisponible, codigoDeError, esPedidoNoReconocido, mensajeDeError, mensajeErrorReporte } from './errores';

const errorGraphql = (codigo?: string) =>
  new CombinedGraphQLErrors({
    data: null,
    errors: [{ message: 'x', extensions: codigo ? { codigo, servicio: 'obras' } : {} }],
  });

describe('errores', () => {
  it('toma el codigo de extensions y devuelve el mensaje del catálogo', () => {
    expect(codigoDeError(errorGraphql('SIN_PERMISO'))).toBe('SIN_PERMISO');
    expect(mensajeDeError(errorGraphql('SIN_PERMISO'))).toBe('No tienes permiso para hacer esta acción.');
    expect(mensajeDeError(errorGraphql('SERVICIO_NO_DISPONIBLE'))).toBe(
      'Este servicio no está disponible por el momento. Intenta de nuevo en unos minutos.',
    );
  });

  it('un codigo desconocido o sin codigo usa el mensaje de error inesperado', () => {
    expect(mensajeDeError(errorGraphql('OTRO'))).toMatch(/^Ocurrió un error inesperado/);
    expect(mensajeDeError(errorGraphql())).toMatch(/^Ocurrió un error inesperado/);
  });

  it('lee el codigo del cuerpo cuando el gateway responde con estado de error (401)', () => {
    const cuerpo = JSON.stringify({ errors: [{ message: 'x', extensions: { codigo: 'NO_AUTENTICADO' } }] });
    const error = new ServerError('401', { response: new Response(cuerpo, { status: 401 }), bodyText: cuerpo });
    expect(mensajeDeError(error)).toBe('Tu sesión terminó. Vuelve a iniciar sesión.');
  });

  it('un error de red muestra que no hay conexión', () => {
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toBe(
      'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
    );
  });

  it('arma el aviso del tablero con el nombre del servicio (009, criterio 5)', () => {
    expect(avisoNoDisponible('obras')).toBe('Datos de Obras no disponibles');
    expect(avisoNoDisponible('materiales')).toBe('Datos de Materiales no disponibles');
    expect(avisoNoDisponible('finanzas')).toBe('Datos de Finanzas no disponibles');
  });
});

describe('mensajes de reportes (503)', () => {
  const conCodigo = (codigo: string) =>
    new CombinedGraphQLErrors({ data: null, errors: [{ message: 'x', extensions: { codigo, servicio: 'ia' } }] });

  it('cada código tiene el texto de docs/mensajes.md', () => {
    expect(mensajeErrorReporte(conCodigo('INTENCION_NO_RECONOCIDA'))).toBe('No encontré un reporte para tu pedido');
    expect(mensajeErrorReporte(conCodigo('RECETA_INVALIDA'))).toBe('No encontré un reporte para tu pedido');
    expect(mensajeErrorReporte(conCodigo('DEMASIADAS_CONSULTAS'))).toBe('Demasiadas consultas; espera un momento');
    for (const codigo of ['LLM_NO_DISPONIBLE', 'REPORTES_NO_DISPONIBLES', 'SERVICIO_NO_DISPONIBLE']) {
      expect(mensajeErrorReporte(conCodigo(codigo))).toBe('El servicio de reportes no está disponible; intenta de nuevo');
    }
    expect(mensajeErrorReporte(conCodigo('TIEMPO_AGOTADO'))).toBe('El reporte tardó demasiado; intenta de nuevo');
    expect(mensajeErrorReporte(conCodigo('TEXTO_INVALIDO'))).toBe('El pedido debe tener entre 3 y 500 caracteres.');
    expect(mensajeErrorReporte(conCodigo('SIN_PERMISO'))).toBe('No tienes permiso para hacer esta acción.');
    expect(esPedidoNoReconocido('RECETA_INVALIDA')).toBe(true);
    expect(esPedidoNoReconocido('LLM_NO_DISPONIBLE')).toBe(false);
  });
});
