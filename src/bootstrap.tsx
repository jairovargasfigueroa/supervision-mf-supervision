import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';

// El microfrontend se publica como Web Component para que el shell de Angular
// lo muestre sin depender de React. El Shadow DOM aísla sus estilos.
class MfSupervisionElement extends HTMLElement {
  private root: Root | null = null;

  connectedCallback() {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const contenedor = document.createElement('div');
    shadow.appendChild(contenedor);

    this.root = createRoot(contenedor);
    this.root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }
}

if (!customElements.get('mf-supervision')) {
  customElements.define('mf-supervision', MfSupervisionElement);
}
