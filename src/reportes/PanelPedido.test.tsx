import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { PanelPedido, pedidoValido } from './PanelPedido';

afterEach(cleanup);

function Panel({ alConsultar, ocupado }: { alConsultar: (t: string) => void; ocupado?: boolean }) {
  const [texto, setTexto] = useState('');
  return <PanelPedido texto={texto} onCambio={setTexto} alConsultar={alConsultar} ocupado={ocupado} />;
}

const cuadro = () => screen.getByRole('textbox', { name: 'Pedido del reporte' });
const consultar = () => screen.getByRole('button', { name: 'Consultar' }) as HTMLButtonElement;

describe('PanelPedido (503, criterios 1 a 3)', () => {
  it('sin micrófono el cuadro de texto funciona y «Consultar» envía el texto sin espacios de más', () => {
    const alConsultar = vi.fn();
    render(<Panel alConsultar={alConsultar} />);
    // jsdom no tiene micrófono: el dictado queda desactivado con su motivo
    expect((screen.getByRole('button', { name: 'Dictar con la voz' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(cuadro(), { target: { value: '  Planillas observadas de la zona norte ' } });
    expect(screen.getByLabelText('Caracteres del pedido').textContent).toBe('37 / 500');
    fireEvent.click(consultar());
    expect(alConsultar).toHaveBeenCalledWith('Planillas observadas de la zona norte');
  });

  it('con menos de 3 o más de 500 caracteres no deja consultar y avisa el largo', () => {
    const alConsultar = vi.fn();
    render(<Panel alConsultar={alConsultar} />);
    expect(consultar().disabled).toBe(true);

    fireEvent.change(cuadro(), { target: { value: 'ab' } });
    expect(consultar().disabled).toBe(true);
    expect(screen.getByText('El pedido debe tener entre 3 y 500 caracteres.')).toBeTruthy();

    fireEvent.change(cuadro(), { target: { value: 'x'.repeat(501) } });
    expect(consultar().disabled).toBe(true);
    fireEvent.submit(cuadro().closest('form')!);
    expect(alConsultar).not.toHaveBeenCalled();

    fireEvent.change(cuadro(), { target: { value: 'x'.repeat(500) } });
    expect(consultar().disabled).toBe(false);
  });

  it('mientras se prepara un reporte no deja pedir otro', () => {
    render(<Panel alConsultar={vi.fn()} ocupado />);
    fireEvent.change(cuadro(), { target: { value: 'Cobros vencidos' } });
    expect(consultar().disabled).toBe(true);
  });

  it('valida el largo del pedido', () => {
    expect(pedidoValido('abc')).toBe(true);
    expect(pedidoValido('  ab  ')).toBe(false);
  });

  it('505: con una conversación abierta acepta desde 1 carácter y muestra los botones que se le pasen', () => {
    const alConsultar = vi.fn();
    render(
      <PanelPedido texto="2" onCambio={vi.fn()} alConsultar={alConsultar} minimo={1} acciones={<button type="button">Nueva consulta</button>} />,
    );
    expect(consultar().disabled).toBe(false);
    fireEvent.click(consultar());
    expect(alConsultar).toHaveBeenCalledWith('2');
    expect(screen.getByRole('button', { name: 'Nueva consulta' })).toBeTruthy();
    expect(pedidoValido(' ', 1)).toBe(false);
    expect(pedidoValido('x'.repeat(501), 1)).toBe(false);
  });
});
