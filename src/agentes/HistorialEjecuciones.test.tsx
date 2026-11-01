import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { EJECUCION_AGENTE, EJECUCIONES_AGENTE } from './agentes.graphql';
import { argumentosConFormato, textoModelo } from './DetalleEjecucion';
import { HistorialEjecuciones } from './HistorialEjecuciones';

afterEach(cleanup);

const AGENTES = [
  { agente: 'SEGUIMIENTO_OBRAS' as const, nombre: 'Seguimiento de obras' },
  { agente: 'CONTROL_MATERIALES' as const, nombre: 'Control de materiales' },
];

const CORTA = {
  __typename: 'EjecucionCorta',
  id: 'e1',
  agente: 'CONTROL_MATERIALES',
  origen: 'MANUAL',
  estado: 'TERMINADA',
  iniciadaEn: '2027-04-20T14:00:00Z',
  terminadaEn: '2027-04-20T14:01:00Z',
  cantidadHallazgos: 1,
};

const DETALLE = {
  __typename: 'EjecucionAgente',
  id: 'e1',
  agente: 'CONTROL_MATERIALES',
  origen: 'MANUAL',
  estado: 'TERMINADA',
  solicitadaPor: { __typename: 'Usuario', id: 'u1', nombre: 'Ana Gerente' },
  iniciadaEn: '2027-04-20T14:00:00Z',
  terminadaEn: '2027-04-20T14:01:00Z',
  proveedorLlm: 'ollama',
  modelo: 'qwen3:8b',
  resumen: '2 obras con cemento bajo <img src=x onerror=alert(1)>',
  error: null,
  pasos: [
    {
      __typename: 'PasoEjecucion',
      numero: 1,
      servidor: 'materiales',
      herramienta: 'stock_obra',
      argumentos: '{"estados":["BAJO","JUSTO"]}',
      resultadoResumen: '4 filas: …',
      en: '2027-04-20T14:00:02Z',
      duracionMs: 180,
      error: null,
    },
    {
      __typename: 'PasoEjecucion',
      numero: 2,
      servidor: 'ia',
      herramienta: 'consultar_reporte',
      argumentos: '{"conjunto":"COBROS"}',
      resultadoResumen: '',
      en: '2027-04-20T14:00:05Z',
      duracionMs: 1250,
      error: 'ARGUMENTO_INVALIDO',
    },
  ],
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
      evidencia: [{ __typename: 'Evidencia', herramienta: 'stock_obra', dato: 'cantidad 80, mínimo 100, estado BAJO' }],
      detectadoEn: '2027-04-20T14:01:00Z',
    },
  ],
};

const ejecuciones = (variables: object, lista: object[] = [CORTA]): MockLink.MockedResponse => ({
  request: { query: EJECUCIONES_AGENTE, variables },
  result: { data: { ejecucionesAgente: lista } },
});

const detalle = (datos: object | null = DETALLE, codigo?: string): MockLink.MockedResponse => ({
  request: { query: EJECUCION_AGENTE, variables: { id: 'e1' } },
  result: codigo
    ? { data: { ejecucionAgente: null }, errors: [{ message: 'x', path: ['ejecucionAgente'], extensions: { codigo, servicio: 'ia' } }] }
    : { data: { ejecucionAgente: datos } },
});

function dibujar(mocks: MockLink.MockedResponse[]) {
  render(
    <MockedProvider mocks={mocks}>
      <HistorialEjecuciones agentes={AGENTES} />
    </MockedProvider>,
  );
}

async function abrirDetalle() {
  fireEvent.click(await screen.findByRole('row', { name: 'Ver la ejecución de Control de materiales del 20/04/2027 10:00' }));
  return within(await screen.findByRole('region', { name: 'Detalle de la ejecución' }));
}

describe('HistorialEjecuciones y DetalleEjecucion (502)', () => {
  it('lista las ejecuciones y filtra por agente', async () => {
    dibujar([ejecuciones({ limite: 20 }), ejecuciones({ agente: 'SEGUIMIENTO_OBRAS', limite: 20 }, [])]);
    const fila = await screen.findByRole('row', { name: /Control de materiales/ });
    expect(Array.from(fila.querySelectorAll('td')).map((c) => c.textContent)).toEqual([
      'Control de materiales',
      'Manual',
      'Terminada',
      '20/04/2027 10:00',
      '20/04/2027 10:01',
      '1',
    ]);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Agente de la ejecución' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Seguimiento de obras' }));
    expect(await screen.findByText('No hay ejecuciones con estos filtros.')).toBeTruthy();
  });

  it('el detalle muestra el modelo de lenguaje, el servidor de cada paso, los argumentos con formato y los hallazgos', async () => {
    dibujar([ejecuciones({ limite: 20 }), detalle()]);
    const d = await abrirDetalle();
    expect(d.getByText('Ollama · qwen3:8b')).toBeTruthy();
    expect(d.getByText('Manual · Ana Gerente')).toBeTruthy();

    const pasos = within(d.getByRole('table', { name: 'Pasos de la ejecución' })).getAllByRole('row').slice(1);
    const celdas = (i: number) => Array.from(pasos[i].querySelectorAll('td')).map((c) => c.textContent);
    expect(celdas(0)[1]).toBe('Materiales');
    expect(celdas(0)[2]).toBe('stock_obra');
    expect(pasos[0].querySelector('pre')?.textContent).toBe('{\n  "estados": [\n    "BAJO",\n    "JUSTO"\n  ]\n}');
    expect(celdas(0)[6]).toBe('180 ms');
    expect(celdas(0)[7]).toBe('—');
    expect(celdas(1)[1]).toBe('IA');
    expect(celdas(1)[6]).toBe('1.250 ms');
    expect(celdas(1)[7]).toBe('El agente pidió datos con parámetros no válidos; se ignoró.');

    expect(d.getByText('Cemento IP-30: 80 bolsas, mínimo 100')).toBeTruthy();
    expect(d.getByText('Causa probable: Consumo de la losa mayor al previsto')).toBeTruthy();
    expect(d.getByText('stock_obra: cantidad 80, mínimo 100, estado BAJO')).toBeTruthy();
    expect(d.getByText('Alta')).toBeTruthy();
    expect(d.getByText('Stock bajo', { exact: false })).toBeTruthy();
  });

  it('el texto del agente con etiquetas HTML se muestra como texto', async () => {
    dibujar([ejecuciones({ limite: 20 }), detalle()]);
    const d = await abrirDetalle();
    expect(d.getByLabelText('Resumen de la ejecución').textContent).toBe('2 obras con cemento bajo <img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  it('una ejecución fallida muestra el texto de su error', async () => {
    dibujar([
      ejecuciones({ limite: 20 }),
      detalle({ ...DETALLE, estado: 'FALLIDA', resumen: null, error: { __typename: 'ErrorEjecucion', codigo: 'SIN_HERRAMIENTAS', mensaje: 'x' }, pasos: [], hallazgos: [] }),
    ]);
    const d = await abrirDetalle();
    expect(d.getByText('Sin herramientas disponibles')).toBeTruthy();
    expect(d.getByText('Fallida')).toBeTruthy();
    expect(d.getByText('Sin hallazgos.')).toBeTruthy();
  });

  it('EJECUCION_NO_ENCONTRADA muestra «No encontramos esa ejecución.»', async () => {
    dibujar([ejecuciones({ limite: 20 }), detalle(null, 'EJECUCION_NO_ENCONTRADA')]);
    fireEvent.click(await screen.findByRole('row', { name: /Control de materiales/ }));
    expect(await screen.findByText('No encontramos esa ejecución.')).toBeTruthy();
  });

  it('arma el texto del modelo y de los argumentos', () => {
    expect(textoModelo('anthropic', 'claude-sonnet-5-5')).toBe('Anthropic · claude-sonnet-5-5');
    expect(argumentosConFormato('no es json')).toBe('no es json');
  });
});
