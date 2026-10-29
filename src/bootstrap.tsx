import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline';
import { App } from './App';
import { crearTema } from './tema';

// El microfrontend se publica como Web Component para que el shell de Angular
// lo muestre sin depender de React. El Shadow DOM aísla sus estilos: Emotion
// escribe los estilos de MUI dentro del shadowRoot y no en el <head> del shell.
class MfSupervisionElement extends HTMLElement {
  private root: Root | null = null;

  connectedCallback() {
    if (this.root) return;
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });

    const estiloHost = document.createElement('style');
    estiloHost.textContent = ':host { display: block; }';
    const contenedor = document.createElement('div');
    shadow.replaceChildren(estiloHost, contenedor);

    const cache = createCache({ key: 'mf', container: shadow });
    const tema = crearTema(contenedor);

    this.root = createRoot(contenedor);
    this.root.render(
      <StrictMode>
        <CacheProvider value={cache}>
          <ThemeProvider theme={tema}>
            <ScopedCssBaseline>
              <App />
            </ScopedCssBaseline>
          </ThemeProvider>
        </CacheProvider>
      </StrictMode>,
    );
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
    this.shadowRoot?.replaceChildren();
  }
}

if (!customElements.get('mf-supervision')) {
  customElements.define('mf-supervision', MfSupervisionElement);
}
