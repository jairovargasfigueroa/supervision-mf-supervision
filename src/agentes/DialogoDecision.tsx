import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { codigoDeError, erroresDeCampo, mensajeDeError } from '../nucleo/errores';
import {
  APROBAR_SUGERENCIA,
  COMENTARIO_MAXIMO,
  MENSAJE_COMENTARIO,
  MENSAJE_MOTIVO,
  MOTIVO_MAXIMO,
  MOTIVO_MINIMO,
  RECHAZAR_SUGERENCIA,
  type Sugerencia,
} from './agentes.graphql';

// Diálogos para decidir una sugerencia (502, criterios 12 a 14): aprobar con un comentario opcional (hasta 300
// caracteres) o rechazar con un motivo obligatorio (10 a 500). Aprobar solo registra la decisión: no se crea,
// modifica ni envía nada en otro servicio.

export type ModoDecision = 'aprobar' | 'rechazar';

interface Props {
  sugerencia: Sugerencia;
  modo: ModoDecision;
  alCerrar: () => void;
  /** La decisión quedó registrada (o la sugerencia ya estaba decidida): hay que recargar la lista. */
  alDecidir: () => void;
}

export function DialogoDecision({ sugerencia, modo, alCerrar, alDecidir }: Props) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<unknown>();
  const [aprobar, aprobando] = useMutation(APROBAR_SUGERENCIA);
  const [rechazar, rechazando] = useMutation(RECHAZAR_SUGERENCIA);
  const enviando = aprobando.loading || rechazando.loading;

  const rechazo = modo === 'rechazar';
  const largo = texto.trim().length;
  const maximo = rechazo ? MOTIVO_MAXIMO : COMENTARIO_MAXIMO;
  const valido = rechazo ? largo >= MOTIVO_MINIMO && largo <= MOTIVO_MAXIMO : largo <= COMENTARIO_MAXIMO;
  const campo = rechazo ? 'motivo' : 'comentario';
  const errorCampo = erroresDeCampo(error).find((e) => e.campo === campo)?.mensaje;
  const contador = rechazo ? `${largo} / ${maximo} (mínimo ${MOTIVO_MINIMO})` : `${largo} / ${maximo}`;
  const errorLocal = largo > 0 && !valido ? (rechazo ? MENSAJE_MOTIVO : MENSAJE_COMENTARIO) : undefined;
  const mensajeCampo = errorCampo ?? errorLocal;
  const ayuda = mensajeCampo ? `${mensajeCampo} · ${contador}` : contador;

  const confirmar = async () => {
    setError(undefined);
    try {
      if (rechazo) await rechazar({ variables: { id: sugerencia.id, motivo: texto.trim() } });
      else await aprobar({ variables: { id: sugerencia.id, ...(largo > 0 && { comentario: texto.trim() }) } });
      alDecidir();
      alCerrar();
    } catch (e) {
      setError(e);
      // Otra persona ya la decidió: la lista debe reflejarlo
      if (codigoDeError(e) === 'SUGERENCIA_YA_DECIDIDA') alDecidir();
    }
  };

  const titulo = rechazo ? 'Rechazar sugerencia' : 'Aprobar sugerencia';

  return (
    <Dialog open onClose={enviando ? undefined : alCerrar} aria-labelledby="titulo-decision" fullWidth maxWidth="sm">
      <DialogTitle id="titulo-decision">{titulo}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 600 }}>{sugerencia.obraNombre}</Typography>
        <Typography sx={{ mb: 1 }}>{sugerencia.accionTexto}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {rechazo
            ? 'Escribe por qué no corresponde esta sugerencia.'
            : 'Aprobar solo registra tu decisión: no se crea ni se envía nada en otra área.'}
        </Typography>
        {error !== undefined && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {mensajeDeError(error)}
          </Alert>
        )}
        <TextField
          label={rechazo ? 'Motivo' : 'Comentario (opcional)'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          required={rechazo}
          multiline
          minRows={3}
          fullWidth
          autoFocus
          error={!!mensajeCampo}
          helperText={ayuda}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={alCerrar} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color={rechazo ? 'error' : 'primary'}
          disabled={!valido || enviando}
          onClick={() => void confirmar()}
        >
          {rechazo ? 'Rechazar' : 'Aprobar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
