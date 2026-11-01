import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { APROBAR_SUGERENCIA, HALLAZGOS, RECHAZAR_SUGERENCIA, SUGERENCIAS, type FiltroSugerencias } from './agentes.graphql';
import { ListaSugerencias } from './ListaSugerencias';

afterEach(cleanup);

const AGENTES = [
  { agente: 'SEGUIMIENTO_OBRAS' as const, nombre: 'Seguimiento de obras' },
  { agente: 'CONTROL_MATERIALES' as const, nombre: 'Control de materiales' },
];

const sugerencia = (id: string, extra: object = {}) => ({
  __typename: 'Sugerencia',
  id,
  ejecucionId: 'e1',
  agente: 'CONTROL_MATERIALES',
  obraId: 'o1',
  obraNombre: 'Edificio Las Palmas',
  accion: 'VERIFICAR_INVENTARIO',
  accionTexto: 'Hacer un conteo físico del material en el depósito de la obra',
  descripcion: 'Contar el cemento IP-30: el stock está bajo el mínimo.',
  estado: 'PENDIENTE',
  creadaEn: '2027-04-20T10:01:12Z',
  decididaPor: null,
  decididaEn: null,
  comentario: null,
  ...extra,
});

const lista = (filtro: FiltroSugerencias, sugerencias: object[], veces = 1): MockLink.MockedResponse => ({
  request: { query: SUGERENCIAS, variables: filtro },
  result: { data: { sugerencias } },
  maxUsageCount: veces,
});

const hallazgos = (veces = 3): MockLink.MockedResponse => ({
  request: { query: HALLAZGOS, variables: {} },
  result: {
    data: {
      hallazgos: [
        {
          __typename: 'Hallazgo',
          ejecucionId: 'e1',
          agente: 'CONTROL_MATERIALES',
          obraId: 'o1',
          obraNombre: 'Edificio Las Palmas',
          tipo: 'STOCK_BAJO',
          severidad: 'ALTA',
          situacion: 'Cemento IP-30: 80 bolsas, mínimo 100',
          causaProbable: 'Consumo de la losa mayor al previsto',
          evidencia: [{ __typename: 'Evidencia', herramienta: 'stock_obra', dato: 'cantidad 80' }],
          detectadoEn: '2027-04-20T10:01:12Z',
        },
      ],
    },
  },
  maxUsageCount: veces,
});

const PENDIENTES = { estado: 'PENDIENTE' as const, limite: 50 };

const error = (campo: string, codigo: string, errores?: object[]) => ({
  data: null,
  errors: [{ message: 'x', path: [campo], extensions: { codigo, servicio: 'ia', ...(errores && { errores }) } }],
});

function dibujar(mocks: MockLink.MockedResponse[]) {
  const alDecidir = vi.fn();
  render(
    <MockedProvider mocks={mocks}>
      <ListaSugerencias agentes={AGENTES} alDecidir={alDecidir} />
    </MockedProvider>,
  );
  return alDecidir;
}

const item = async () => within(await screen.findByRole('listitem', { name: 'Sugerencia para Edificio Las Palmas' }));

describe('ListaSugerencias (502)', () => {
  it('muestra las pendientes con obra, acción, descripción y el hallazgo que las originó', async () => {
    dibujar([lista(PENDIENTES, [sugerencia('s1')]), hallazgos()]);
    const s = await item();
    expect(s.getByText('Hacer un conteo físico del material en el depósito de la obra')).toBeTruthy();
    expect(s.getByText('Contar el cemento IP-30: el stock está bajo el mínimo.')).toBeTruthy();
    expect(await s.findByText('Hallazgo: Cemento IP-30: 80 bolsas, mínimo 100')).toBeTruthy();
    expect(s.getByText(/Control de materiales/)).toBeTruthy();
    expect(s.getByText('Pendiente')).toBeTruthy();
    expect(s.getByRole('button', { name: 'Aprobar' })).toBeTruthy();
    expect(s.getByRole('button', { name: 'Rechazar' })).toBeTruthy();
  });

  it('filtra por agente y estado', async () => {
    dibujar([
      lista(PENDIENTES, [sugerencia('s1')]),
      hallazgos(),
      lista(
        { estado: 'APROBADA', limite: 50 },
        [sugerencia('s2', { estado: 'APROBADA', decididaPor: { __typename: 'Usuario', id: 'u1', nombre: 'Ana Gerente' }, decididaEn: '2027-04-21T14:00:00Z', comentario: 'Lo hace el almacenero' })],
      ),
      lista({ estado: 'APROBADA', agente: 'SEGUIMIENTO_OBRAS', limite: 50 }, []),
    ]);
    await item();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Estado' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Aprobadas' }));
    const s = await item();
    expect(await s.findByText('Aprobada por Ana Gerente el 21/04/2027 10:00 · Comentario: Lo hace el almacenero')).toBeTruthy();
    expect(s.queryByRole('button', { name: 'Aprobar' })).toBeNull();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Agente' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Seguimiento de obras' }));
    expect(await screen.findByText('No hay sugerencias con estos filtros.')).toBeTruthy();
  });

  it('aprobar con comentario opcional registra la decisión y recarga (criterio 12)', async () => {
    const alDecidir = dibujar([
      lista(PENDIENTES, [sugerencia('s1')]),
      hallazgos(),
      {
        request: { query: APROBAR_SUGERENCIA, variables: { id: 's1' } },
        result: { data: { aprobarSugerencia: sugerencia('s1', { estado: 'APROBADA' }) } },
      },
      lista(PENDIENTES, []),
    ]);
    fireEvent.click((await item()).getByRole('button', { name: 'Aprobar' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Aprobar sugerencia' }));
    expect(dialogo.getByText(/Aprobar solo registra tu decisión/)).toBeTruthy();
    expect(dialogo.getByText('0 / 300')).toBeTruthy();
    fireEvent.click(dialogo.getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(alDecidir).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('No hay sugerencias con estos filtros.')).toBeTruthy();
  });

  it('un comentario de más de 300 caracteres no se puede enviar; el error del servidor va junto al campo', async () => {
    dibujar([
      lista(PENDIENTES, [sugerencia('s1')]),
      hallazgos(),
      {
        request: { query: APROBAR_SUGERENCIA, variables: { id: 's1', comentario: 'ok' } },
        result: error('aprobarSugerencia', 'COMENTARIO_INVALIDO', [{ campo: 'comentario', mensaje: 'Máximo 300 caracteres.' }]),
      },
    ]);
    fireEvent.click((await item()).getByRole('button', { name: 'Aprobar' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Aprobar sugerencia' }));
    const campo = dialogo.getByRole('textbox', { name: 'Comentario (opcional)' });
    fireEvent.change(campo, { target: { value: 'x'.repeat(301) } });
    expect((dialogo.getByRole('button', { name: 'Aprobar' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(campo, { target: { value: 'ok' } });
    fireEvent.click(dialogo.getByRole('button', { name: 'Aprobar' }));
    expect(await dialogo.findByText('Revisa el comentario.')).toBeTruthy();
    expect(dialogo.getByText('Máximo 300 caracteres.')).toBeTruthy();
  });

  it('rechazar exige un motivo de 10 a 500 caracteres con contador (criterio 13)', async () => {
    const alDecidir = dibujar([
      lista(PENDIENTES, [sugerencia('s1')]),
      hallazgos(),
      {
        request: { query: RECHAZAR_SUGERENCIA, variables: { id: 's1', motivo: 'El stock ya se repuso ayer' } },
        result: { data: { rechazarSugerencia: sugerencia('s1', { estado: 'RECHAZADA' }) } },
      },
      lista(PENDIENTES, []),
    ]);
    fireEvent.click((await item()).getByRole('button', { name: 'Rechazar' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Rechazar sugerencia' }));
    const boton = dialogo.getByRole('button', { name: 'Rechazar' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    const campo = dialogo.getByRole('textbox', { name: 'Motivo' });
    fireEvent.change(campo, { target: { value: 'corto' } });
    expect(dialogo.getByText('5 / 500 (mínimo 10)')).toBeTruthy();
    expect(boton.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: 'El stock ya se repuso ayer' } });
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    await waitFor(() => expect(alDecidir).toHaveBeenCalled());
  });

  it('si otra persona ya la decidió avisa y recarga la lista (criterio 14)', async () => {
    const alDecidir = dibujar([
      lista(PENDIENTES, [sugerencia('s1')], 2),
      hallazgos(),
      {
        request: { query: APROBAR_SUGERENCIA, variables: { id: 's1' } },
        result: error('aprobarSugerencia', 'SUGERENCIA_YA_DECIDIDA'),
      },
    ]);
    fireEvent.click((await item()).getByRole('button', { name: 'Aprobar' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Aprobar sugerencia' }));
    fireEvent.click(dialogo.getByRole('button', { name: 'Aprobar' }));
    expect(await dialogo.findByText('Esta sugerencia ya fue aprobada o rechazada. Recarga la lista.')).toBeTruthy();
    expect(alDecidir).toHaveBeenCalled();
  });
});
