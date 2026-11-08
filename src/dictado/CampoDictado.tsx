import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import StopIcon from '@mui/icons-material/Stop';
import { useDictado, type DependenciasDictado, type ErrorDictado } from './useDictado';

// Campo de texto con dictado por voz (302). La voz se transcribe en el navegador con Whisper; a la pantalla que
// lo usa solo le llega el texto (onCambio). Cada dictado se agrega al final de lo que ya hay y el texto se puede
// corregir a mano. Sin micrófono o sin modelo, el campo sigue sirviendo para escribir (criterios 7 a 9).

/** Textos de docs/mensajes.md («IA en el dispositivo y en el navegador»). */
export const MENSAJES_DICTADO: Record<ErrorDictado, string> = {
  SIN_PERMISO: 'Sin permiso para usar el micrófono',
  NO_ENTENDIDO: 'No se entendió el audio, intenta de nuevo',
  SIN_SOPORTE: 'El dictado no está disponible en este navegador; puedes escribir el texto.',
  MODELO: 'No se pudo descargar el modelo de dictado; puedes escribir el texto.',
};

/** Agrega el texto dictado al final del existente, separado por un espacio (criterio 10). */
export function agregarTexto(actual: string, dictado: string): string {
  const base = actual.replace(/\s+$/, '');
  return base ? `${base} ${dictado}` : dictado;
}

/** `75` → `1:15` */
export function formatearTiempo(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

export interface PropsCampoDictado {
  valor: string;
  onCambio: (texto: string) => void;
  placeholder?: string;
  /** Límite de una grabación; 60 por defecto (criterio 2). */
  maxSegundos?: number;
  desactivado?: boolean;
  /** Nombre del campo para lectores de pantalla (por defecto, el placeholder). */
  etiqueta?: string;
  /** Solo en las pruebas: worker, grabador y soporte simulados. */
  dependencias?: Partial<DependenciasDictado>;
}

export function CampoDictado({
  valor,
  onCambio,
  placeholder,
  maxSegundos,
  desactivado = false,
  etiqueta,
  dependencias,
}: PropsCampoDictado) {
  const dictado = useDictado({
    alTexto: (texto) => onCambio(agregarTexto(valor, texto)),
    maxSegundos,
    dependencias,
  });
  const { estado, progreso, error, segundos } = dictado;

  const grabando = estado === 'GRABANDO';
  const ocupado = estado === 'PREPARANDO' || estado === 'TRANSCRIBIENDO';
  const noDisponible = estado === 'NO_DISPONIBLE';
  const motivo = noDisponible && error ? MENSAJES_DICTADO[error] : undefined;
  const etiquetaBoton = grabando ? 'Detener la grabación' : 'Dictar con la voz';

  const boton = (
    <IconButton
      aria-label={etiquetaBoton}
      color={grabando ? 'error' : 'primary'}
      disabled={desactivado || ocupado || noDisponible}
      onClick={grabando ? dictado.detener : dictado.iniciar}
      edge="end"
    >
      {noDisponible ? <MicOffIcon /> : grabando ? <StopIcon /> : <MicIcon />}
    </IconButton>
  );

  return (
    <Box>
      <TextField
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        disabled={desactivado}
        multiline
        minRows={3}
        fullWidth
        slotProps={{
          htmlInput: { 'aria-label': etiqueta ?? placeholder ?? 'Texto' },
          input: {
            endAdornment: (
              <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                {/* Tooltip necesita un elemento que reciba eventos aunque el botón esté desactivado */}
                <Tooltip title={motivo ?? etiquetaBoton}>
                  <span>{boton}</span>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <Box aria-live="polite" sx={{ mt: 1, minHeight: 24 }}>
        {estado === 'PREPARANDO' && (
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Preparando el dictado: {progreso} %
            </Typography>
            <LinearProgress variant="determinate" value={progreso} aria-label="Avance de la descarga del modelo" sx={{ mt: 0.5 }} />
          </Box>
        )}
        {grabando && (
          <Typography variant="body2" role="status" sx={{ color: 'error.main', fontWeight: 600 }}>
            Grabando… {formatearTiempo(segundos)}
          </Typography>
        )}
        {estado === 'TRANSCRIBIENDO' && (
          <Typography variant="body2" role="status" sx={{ color: 'text.secondary' }}>
            Transcribiendo…
          </Typography>
        )}
        {estado === 'ERROR' && error && (
          <Alert severity="warning" sx={{ py: 0 }}>
            {MENSAJES_DICTADO[error]}
          </Alert>
        )}
        {motivo && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {motivo}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
