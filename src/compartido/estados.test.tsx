import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstadoError } from './EstadoError';
import { EstadoVacio } from './EstadoVacio';

afterEach(cleanup);

describe('EstadoVacio', () => {
  it('muestra solo el texto si no hay acción', () => {
    render(<EstadoVacio texto="Aún no hay datos." />);
    expect(screen.getByText('Aún no hay datos.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('muestra la acción y la ejecuta al pulsarla', () => {
    const alPulsar = vi.fn();
    render(<EstadoVacio texto="Aún no hay datos." accion={{ etiqueta: 'Actualizar', alPulsar }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(alPulsar).toHaveBeenCalledOnce();
  });
});

describe('EstadoError', () => {
  it('muestra el aviso y reintenta al pulsar el botón', () => {
    const alReintentar = vi.fn();
    render(<EstadoError alReintentar={alReintentar} />);
    expect(screen.getByRole('alert').textContent).toContain('No disponible por el momento.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(alReintentar).toHaveBeenCalledOnce();
  });
});
