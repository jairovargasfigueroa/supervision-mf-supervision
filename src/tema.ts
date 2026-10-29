import { createTheme, type Theme } from '@mui/material/styles';

// Tema común de los microfrontends React (docs/diseno-visual.md de la carpeta general).
// Recibe el contenedor que está dentro del Shadow DOM para que diálogos, menús,
// tooltips y popovers se monten ahí y reciban los estilos de Emotion.
export function crearTema(contenedor: HTMLElement): Theme {
  return createTheme({
    palette: {
      primary: { main: '#0E4D5C', dark: '#0A3741', light: '#E2EEF1' },
      secondary: { main: '#F08A24', light: '#FDEEDC' },
      success: { main: '#1B7343', light: '#E2F3E9' },
      warning: { main: '#9A4A00', light: '#FDEEDC' },
      error: { main: '#B42318', light: '#FCE8E6' },
      text: { primary: '#14232A', secondary: '#56676F' },
      divider: '#DAE2E5',
      background: { default: '#F2F5F6', paper: '#FFFFFF' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      fontSize: 14,
      // Títulos de página 24 px/600, de sección 18 px/600, ayudas 12 px
      h1: { fontSize: '1.5rem', fontWeight: 600 },
      h2: { fontSize: '1.125rem', fontWeight: 600 },
      body1: { fontSize: '0.875rem' },
      caption: { fontSize: '0.75rem' },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      // Botones y campos con radio 6; chips en píldora
      MuiButton: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 999 } } },
      // Todo lo que se monta en un portal queda dentro del Shadow DOM
      MuiPopover: { defaultProps: { container: contenedor } },
      MuiPopper: { defaultProps: { container: contenedor } },
      MuiModal: { defaultProps: { container: contenedor } },
      MuiDialog: { defaultProps: { container: contenedor } },
    },
  });
}
