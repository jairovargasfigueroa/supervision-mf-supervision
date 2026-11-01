import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ErrorGrabacion } from './grabador';
import { agregarTexto, CampoDictado, formatearTiempo } from './CampoDictado';
import type { DependenciasDictado, MotorDictado } from './useDictado';

afterEach(() => {
  cleanup();
});

const audio = (segundos: number) => new Float32Array(segundos * 16000);

function motor(textos: string[] = ['faltan doce bolsas de cemento']): MotorDictado {
  return {
    preparar: async (alAvance) => alAvance(100),
    transcribir: vi.fn(async () => textos.shift() ?? ''),
  };
}

const grabador = () => ({ detener: async () => new Blob(['x']), cancelar: () => undefined });

function Campo({ inicial = '', dependencias }: { inicial?: string; dependencias: Partial<DependenciasDictado> }) {
  const [valor, setValor] = useState(inicial);
  return (
    <CampoDictado
      valor={valor}
      onCambio={setValor}
      etiqueta="Nota"
      dependencias={{ soportado: () => true, convertir: async () => audio(3), grabar: async () => grabador(), ...dependencias }}
    />
  );
}

const campo = () => screen.getByRole('textbox', { name: 'Nota' }) as HTMLTextAreaElement;

async function dictar() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dictar con la voz' })));
  expect(screen.getByText(/^Grabando… 0:00$/)).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Detener la grabación' })));
}

describe('CampoDictado (302)', () => {
  it('el texto dictado se agrega al final del existente (criterio 10)', async () => {
    render(<Campo inicial="Vaciado de losa del tercer piso." dependencias={{ motor: motor(['Faltan doce bolsas.', 'Llovió.']) }} />);
    await dictar();
    expect(campo().value).toBe('Vaciado de losa del tercer piso. Faltan doce bolsas.');
    await dictar();
    expect(campo().value).toBe('Vaciado de losa del tercer piso. Faltan doce bolsas. Llovió.');
  });

  it('el texto se puede corregir a mano', async () => {
    render(<Campo dependencias={{ motor: motor(['faltan dose bolsas']) }} />);
    await dictar();
    fireEvent.change(campo(), { target: { value: 'faltan doce bolsas' } });
    expect(campo().value).toBe('faltan doce bolsas');
  });

  it('muestra el avance de la primera descarga del modelo (criterio 5)', async () => {
    let terminar!: () => void;
    render(
      <Campo
        dependencias={{
          motor: {
            preparar: (alAvance) =>
              new Promise<void>((r) => {
                alAvance(45);
                terminar = r;
              }),
            transcribir: async () => '',
          },
        }}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dictar con la voz' })));
    expect(screen.getByText('Preparando el dictado: 45 %')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Dictar con la voz' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => terminar());
    expect(screen.getByRole('button', { name: 'Detener la grabación' })).toBeTruthy();
  });

  it('sin permiso del micrófono avisa y el campo se puede usar escribiendo (criterio 7)', async () => {
    render(<Campo dependencias={{ motor: motor(), grabar: vi.fn().mockRejectedValue(new ErrorGrabacion('SIN_PERMISO')) }} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dictar con la voz' })));
    expect(screen.getByText('Sin permiso para usar el micrófono')).toBeTruthy();
    fireEvent.change(campo(), { target: { value: 'escrito a mano' } });
    expect(campo().value).toBe('escrito a mano');
  });

  it('sin soporte del navegador el botón se desactiva con el motivo (criterio 8)', () => {
    render(<Campo dependencias={{ motor: motor(), soportado: () => false }} />);
    const boton = screen.getByRole('button', { name: 'Dictar con la voz' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(screen.getByText('El dictado no está disponible en este navegador; puedes escribir el texto.')).toBeTruthy();
    fireEvent.change(campo(), { target: { value: 'escrito' } });
    expect(campo().value).toBe('escrito');
  });

  it('si el modelo no se descarga, el botón se desactiva con el motivo (criterio 8)', async () => {
    render(
      <Campo
        dependencias={{ motor: { preparar: () => Promise.reject(new Error('x')), transcribir: async () => '' } }}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dictar con la voz' })));
    expect(screen.getByText('No se pudo descargar el modelo de dictado; puedes escribir el texto.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Dictar con la voz' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('una grabación corta avisa sin borrar lo que ya había (criterio 9)', async () => {
    render(<Campo inicial="Nota previa" dependencias={{ motor: motor(), convertir: async () => audio(0) }} />);
    await dictar();
    expect(screen.getByText('No se entendió el audio, intenta de nuevo')).toBeTruthy();
    expect(campo().value).toBe('Nota previa');
  });

  it('el campo desactivado no deja escribir ni dictar', () => {
    render(<CampoDictado valor="" onCambio={() => undefined} etiqueta="Nota" desactivado dependencias={{ soportado: () => true }} />);
    expect(campo().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Dictar con la voz' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('agrega con un espacio y formatea el tiempo', () => {
    expect(agregarTexto('', 'hola')).toBe('hola');
    expect(agregarTexto('uno  \n', 'dos')).toBe('uno dos');
    expect(formatearTiempo(75)).toBe('1:15');
  });
});
