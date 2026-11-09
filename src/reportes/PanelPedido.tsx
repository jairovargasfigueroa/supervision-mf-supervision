import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import { CampoDictado } from '../dictado/CampoDictado';
import { LARGO_MAXIMO_PEDIDO, LARGO_MINIMO_PEDIDO } from './reportes.graphql';

// Pedido del reporte (503, criterios 1 a 3): el texto se dicta con el componente de la 302 (Whisper en el
// navegador; al servidor solo llega el texto) o se escribe; se puede corregir y se envía con «Consultar».
// Sin micrófono o sin modelo de voz el cuadro de texto sigue funcionando. 505: dentro de una conversación el
// mínimo baja a 1 carácter (para responder «sí» o elegir una opción escribiéndola).

/** Texto de TEXTO_INVALIDO (docs/mensajes.md) para el largo mínimo dado. */
export function mensajeLargo(minimo: number = LARGO_MINIMO_PEDIDO): string {
  return `El pedido debe tener entre ${minimo} y ${LARGO_MAXIMO_PEDIDO} caracteres.`;
}

/** Texto de TEXTO_INVALIDO de un pedido nuevo (docs/mensajes.md). */
export const MENSAJE_LARGO = mensajeLargo();

/** El pedido que se envía (sin espacios a los lados) cumple el largo: de 3 a 500, o desde `minimo`. */
export function pedidoValido(texto: string, minimo: number = LARGO_MINIMO_PEDIDO): boolean {
  const largo = texto.trim().length;
  return largo >= minimo && largo <= LARGO_MAXIMO_PEDIDO;
}

interface Props {
  texto: string;
  onCambio: (texto: string) => void;
  alConsultar: (texto: string) => void;
  /** Mientras se prepara un reporte no se puede pedir otro. */
  ocupado?: boolean;
  /** Largo mínimo del texto: 3 para un pedido nuevo, 1 dentro de una conversación (505). */
  minimo?: number;
  /** Botones junto a «Consultar» (505: «Nueva consulta»). */
  acciones?: ReactNode;
}

export function PanelPedido({ texto, onCambio, alConsultar, ocupado = false, minimo = LARGO_MINIMO_PEDIDO, acciones }: Props) {
  const largo = texto.trim().length;
  const valido = pedidoValido(texto, minimo);
  const fueraDeRango = largo > 0 && !valido;

  return (
    <Box
      component="form"
      aria-label="Pedido del reporte"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido && !ocupado) alConsultar(texto.trim());
      }}
    >
      <CampoDictado
        valor={texto}
        onCambio={onCambio}
        etiqueta="Pedido del reporte"
        placeholder="Por ejemplo: ¿Cuánto cemento se usó en Las Palmas este trimestre?"
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
        <Typography
          variant="caption"
          aria-label="Caracteres del pedido"
          sx={{ color: fueraDeRango ? 'error.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
        >
          {largo} / {LARGO_MAXIMO_PEDIDO}
        </Typography>
        {fueraDeRango && (
          <Typography variant="caption" sx={{ color: 'error.main' }}>
            {mensajeLargo(minimo)}
          </Typography>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {acciones}
          <Button
            type="submit"
            variant="contained"
            startIcon={<SearchIcon />}
            disabled={!valido || ocupado}
            sx={{ minHeight: 44 }}
          >
            Consultar
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
