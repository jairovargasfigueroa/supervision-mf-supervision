import { describe, expect, it } from 'vitest';
import { pedidoDelReporte, type Turno } from './conversacion';
import type { ConsultaReporte } from './reportes.graphql';

const aclaracion = (id: number): Turno => ({
  id,
  rol: 'asistente',
  tipo: 'aclaracion',
  aclaracion: { pregunta: '¿Cuál?', opciones: ['A', 'B'], preguntasRestantes: 4 },
});
const usuario = (id: number, texto: string): Turno => ({ id, rol: 'usuario', texto });
const reporte = (id: number): Turno => ({
  id,
  rol: 'asistente',
  tipo: 'reporte',
  consulta: { id: 'c' } as ConsultaReporte,
  pedido: 'x',
});

describe('pedidoDelReporte (505)', () => {
  it('un pedido sin preguntas es solo su texto', () => {
    expect(pedidoDelReporte([usuario(1, 'Cobros vencidos')])).toBe('Cobros vencidos');
  });

  it('junta el pedido con las respuestas a las preguntas de aclaración, en orden', () => {
    expect(
      pedidoDelReporte([
        usuario(1, '¿Cuánto cemento se usó?'),
        aclaracion(2),
        usuario(3, 'Cemento IP-30'),
        aclaracion(4),
        usuario(5, 'Este mes'),
      ]),
    ).toBe('¿Cuánto cemento se usó? · Cemento IP-30 · Este mes');
  });

  it('un seguimiento después de un reporte es solo el texto del seguimiento', () => {
    expect(pedidoDelReporte([usuario(1, 'Cemento usado'), reporte(2), usuario(3, '¿y en Torre Norte?')])).toBe(
      '¿y en Torre Norte?',
    );
  });

  it('un pedido después de un error no arrastra el que falló', () => {
    expect(
      pedidoDelReporte([usuario(1, 'el clima'), { id: 2, rol: 'asistente', tipo: 'error' }, usuario(3, 'Cobros vencidos')]),
    ).toBe('Cobros vencidos');
  });
});
