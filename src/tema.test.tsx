import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import Dialog from '@mui/material/Dialog';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { ThemeProvider } from '@mui/material/styles';
import { crearTema } from './tema';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function montarEnContenedor() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const contenedor = document.createElement('div');
  shadow.appendChild(contenedor);
  return { contenedor, tema: crearTema(contenedor) };
}

describe('tema', () => {
  it('usa los colores, el fondo, el radio y la fuente de diseno-visual.md', () => {
    const tema = crearTema(document.createElement('div'));
    expect(tema.palette.primary.main).toBe('#0E4D5C');
    expect(tema.palette.secondary.main).toBe('#F08A24');
    expect(tema.palette.success.main).toBe('#1B7343');
    expect(tema.palette.warning.main).toBe('#9A4A00');
    expect(tema.palette.error.main).toBe('#B42318');
    expect(tema.palette.background.default).toBe('#F2F5F6');
    expect(tema.shape.borderRadius).toBe(10);
    expect(tema.typography.fontFamily).toContain('Inter');
  });

  it('monta diálogos y menús dentro del contenedor del Shadow DOM', () => {
    const { contenedor, tema } = montarEnContenedor();
    const ancla = document.createElement('button');
    contenedor.appendChild(ancla);
    render(
      <ThemeProvider theme={tema}>
        <Dialog open>Contenido del diálogo</Dialog>
        <Menu open anchorEl={ancla}>
          <MenuItem>Opción</MenuItem>
        </Menu>
      </ThemeProvider>,
    );
    expect(contenedor.textContent).toContain('Contenido del diálogo');
    expect(contenedor.textContent).toContain('Opción');
    expect(document.body.textContent).not.toContain('Contenido del diálogo');
  });
});
