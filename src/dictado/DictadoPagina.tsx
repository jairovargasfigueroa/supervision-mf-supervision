import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { CampoDictado } from './CampoDictado';

// Pantalla «Dictado» (302, criterio 11): prueba del componente de dictado con un campo de texto y «Copiar texto».
// Al terminar la 503 se puede quitar del menú (el dictado queda dentro de «Reportes»).

export function DictadoPagina() {
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string>();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Texto copiado');
    } catch {
      setAviso('No se pudo copiar el texto');
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1 }}>
        Dictado
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 2 }}>
        Pulsa el micrófono y habla en español. La voz se transcribe en tu navegador: el audio no sale de tu computadora.
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, maxWidth: 720 }}>
        <CampoDictado valor={texto} onCambio={setTexto} etiqueta="Texto dictado" placeholder="Escribe o dicta el texto" />
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          disabled={!texto.trim()}
          onClick={() => void copiar()}
          sx={{ mt: 1 }}
        >
          Copiar texto
        </Button>
      </Paper>
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(undefined)} message={aviso} />
    </Box>
  );
}
