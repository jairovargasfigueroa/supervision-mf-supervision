import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import { CampoDictado } from '../dictado/CampoDictado';
import { LARGO_MAXIMO_PEDIDO, LARGO_MINIMO_PEDIDO } from './reportes.graphql';

// Pedido del reporte (503, criterios 1 a 3): el texto se dicta con el componente de la 302 (Whisper en el
// navegador; al servidor solo llega el texto) o se escribe; se puede corregir y se envía con «Consultar».
// Sin micrófono o sin modelo de voz el cuadro de texto sigue funcionando.

/** Texto de TEXTO_INVALIDO (docs/mensajes.md). */
export const MENSAJE_LARGO = 'El pedido debe tener entre 3 y 500 caracteres.';

/** El pedido que se envía (sin espacios a los lados) cumple el largo de 3 a 500. */
export function pedidoValido(texto: string): boolean {
  const largo = texto.trim().length;
  return largo >= LARGO_MINIMO_PEDIDO && largo <= LARGO_MAXIMO_PEDIDO;
}

interface Props {
  texto: string;
  onCambio: (texto: string) => void;
  alConsultar: (texto: string) => void;
  /** Mientras se prepara un reporte no se puede pedir otro. */
  ocupado?: boolean;
}

export function PanelPedido({ texto, onCambio, alConsultar, ocupado = false }: Props) {
  const largo = texto.trim().length;
  const valido = pedidoValido(texto);
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
            {MENSAJE_LARGO}
          </Typography>
        )}
        <Button
          type="submit"
          variant="contained"
          startIcon={<SearchIcon />}
          disabled={!valido || ocupado}
          sx={{ ml: 'auto' }}
        >
          Consultar
        </Button>
      </Box>
    </Box>
  );
}
