import type { AclaracionReporte, ConsultaReporte } from './reportes.graphql';

// Turnos de la conversación de la pantalla «Reportes» (505). La conversación vive en IA (30 min sin uso); aquí
// solo se guarda lo que se muestra: los pedidos del usuario y las respuestas del asistente, en orden.

export type Turno =
  /** Lo que pidió el usuario: su texto (escrito, dictado o una opción pulsada) o el título del reporte común. */
  | { id: number; rol: 'usuario'; texto: string }
  /** Un reporte, con el pedido que lo originó (para mostrarlo y exportarlo). */
  | { id: number; rol: 'asistente'; tipo: 'reporte'; consulta: ConsultaReporte; pedido: string }
  /** Una pregunta de aclaración con sus opciones. */
  | { id: number; rol: 'asistente'; tipo: 'aclaracion'; aclaracion: AclaracionReporte }
  /** Un error al pedir (código de `extensions.codigo` o el límite de 60 s del navegador). */
  | { id: number; rol: 'asistente'; tipo: 'error'; codigo?: string; error?: unknown };

/** Separador entre el pedido y las respuestas a las preguntas del asistente. */
const SEPARADOR = ' · ';

/**
 * Pedido de un reporte: el último turno del usuario y, si contestaba preguntas de aclaración, los pedidos que las
 * originaron, en orden («¿Cuánto cemento se usó? · Cemento IP-30»). `turnos` termina en el turno del usuario.
 */
export function pedidoDelReporte(turnos: readonly Turno[]): string {
  const partes: string[] = [];
  let i = turnos.length - 1;
  while (i >= 0) {
    const turno = turnos[i];
    if (turno.rol !== 'usuario') break;
    partes.unshift(turno.texto);
    const anterior = turnos[i - 1];
    if (anterior?.rol !== 'asistente' || anterior.tipo !== 'aclaracion') break;
    i -= 2;
  }
  return partes.join(SEPARADOR);
}
