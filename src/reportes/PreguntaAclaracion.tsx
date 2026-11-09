import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import type { AclaracionReporte } from './reportes.graphql';

// Pregunta de aclaración del asistente (505, criterios 2 y 5): el texto de la pregunta y, si las hay, sus opciones
// en botones (salen de los datos reales). Al pulsar una, su texto se envía como el siguiente turno de la
// conversación; también se puede escribir o dictar la respuesta en el campo del pedido. Solo la última pregunta
// sin responder tiene los botones activos. Todo se muestra como texto: React lo escapa.

interface Props {
  aclaracion: AclaracionReporte;
  /** La pregunta todavía espera respuesta (es el último turno y no se está preparando otro). */
  activa: boolean;
  alElegir: (opcion: string) => void;
}

export function PreguntaAclaracion({ aclaracion, activa, alElegir }: Props) {
  return (
    <Box
      component="section"
      aria-label="Pregunta del asistente"
      sx={{ borderLeft: 4, borderColor: 'primary.main', bgcolor: 'primary.light', borderRadius: 1, p: 2 }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <HelpOutlineIcon fontSize="small" sx={{ color: 'primary.main', mt: '2px' }} aria-hidden />
        <Typography sx={{ fontWeight: 500, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{aclaracion.pregunta}</Typography>
      </Box>
      {aclaracion.opciones.length > 0 && (
        <Box
          role="group"
          aria-label="Opciones de respuesta"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, pl: { xs: 0, sm: 3.5 } }}
        >
          {aclaracion.opciones.map((opcion) => (
            <Button
              key={opcion}
              variant="outlined"
              disabled={!activa}
              onClick={() => alElegir(opcion)}
              sx={{ minHeight: 44, bgcolor: 'background.paper', overflowWrap: 'anywhere', textAlign: 'left' }}
            >
              {opcion}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );
}
