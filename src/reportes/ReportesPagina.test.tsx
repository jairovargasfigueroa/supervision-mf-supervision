import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockLink } from '@apollo/client/testing';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { crearRouter } from '../router';
import {
  CATALOGO_REPORTES,
  CONSULTAR_REPORTE,
  CONSULTAS_REPORTE,
  type VariablesConsultarReporte,
} from './reportes.graphql';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.plataforma;
});

function sesion(roles: string[] = ['gerente']) {
  window.plataforma = {
    sesion: {
      usuario: { id: 'u1', nombre: 'Ana Gerente', roles },
      obtenerToken: vi.fn().mockResolvedValue('t'),
      cerrarSesion: vi.fn(),
    },
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
  };
}

function dibujar(ruta: string, mocks: MockLink.MockedResponse[] = []) {
  const historial = createMemoryHistory({ initialEntries: [ruta] });
  render(
    <MockedProvider mocks={mocks}>
      <RouterProvider router={crearRouter(historial)} />
    </MockedProvider>,
  );
  return historial;
}

const CATALOGO = {
  __typename: 'CatalogoReportes',
  conjuntos: [
    {
      __typename: 'ConjuntoDisponible',
      conjunto: 'CONSUMO_MATERIAL',
      titulo: 'Material usado',
      descripcion: 'Cantidad, monto referencial y número de salidas',
      columnas: [{ __typename: 'ColumnaReporte', clave: 'material', titulo: 'Material', tipo: 'TEXTO' }],
      filtros: ['obra', 'zona', 'cliente', 'material', 'periodo'],
      agrupaciones: ['obra', 'zona', 'cliente', 'material', 'periodo'],
      ejemplos: ['¿Cuánto cemento se usó en Las Palmas este trimestre?', 'Material usado por zona este año'],
    },
    {
      __typename: 'ConjuntoDisponible',
      conjunto: 'COBROS',
      titulo: 'Cobros',
      descripcion: 'Número, monto, emisión, vencimiento y estado',
      columnas: [],
      filtros: ['obra'],
      agrupaciones: ['obra'],
      ejemplos: ['Cobros vencidos de este año'],
    },
  ],
  atajos: [
    { __typename: 'AtajoDisponible', atajo: 'COBROS_VENCIDOS', titulo: 'Cobros vencidos', descripcion: 'Vencidos' },
    {
      __typename: 'AtajoDisponible',
      atajo: 'COBROS_POR_VENCER',
      titulo: 'Cobros que vencen en los próximos 30 días',
      descripcion: 'Por vencer',
    },
  ],
};

const catalogo = (): MockLink.MockedResponse => ({
  request: { query: CATALOGO_REPORTES, variables: {} },
  result: { data: { catalogoReportes: CATALOGO } },
});

const historial = (consultas: object[] = []): MockLink.MockedResponse => ({
  request: { query: CONSULTAS_REPORTE, variables: { limite: 10 } },
  result: { data: { consultasReporte: consultas.map((c) => ({ __typename: 'ConsultaReporteCorta', ...c })) } },
  maxUsageCount: 5,
});

const RESULTADO = {
  __typename: 'ConsultaReporte',
  id: 'c1',
  texto: 'Cobros vencidos de este año',
  atajo: null,
  conjunto: 'COBROS',
  tituloConjunto: 'Cobros',
  aplicado: [{ __typename: 'ElementoAplicado', nombre: 'Estado', valor: 'Vencido' }],
  resumen: 'Hay 1 cobro vencido por Bs 12 500.',
  resumenPlantilla: false,
  avisos: [],
  columnas: [
    { __typename: 'ColumnaReporte', clave: 'numero', titulo: 'Número', tipo: 'TEXTO' },
    { __typename: 'ColumnaReporte', clave: 'monto', titulo: 'Monto neto', tipo: 'MONTO' },
  ],
  filas: [['CB-0001', '12500.00']],
  totalFilas: 1,
  truncado: false,
  creadaEn: '2027-03-20T14:00:00Z',
};

/** Pregunta de aclaración que devuelve el asistente (505). */
interface Aclaracion {
  pregunta: string;
  opciones: string[];
  preguntasRestantes?: number;
}

/** `consultarReporte` con un reporte (por defecto), una aclaración o un error, en la conversación `conv-1`. */
const consultar = (
  variables: VariablesConsultarReporte,
  respuesta: { datos?: object; aclaracion?: Aclaracion; codigo?: string; demora?: number; conversacionId?: string } = {},
): MockLink.MockedResponse => ({
  request: { query: CONSULTAR_REPORTE, variables },
  delay: respuesta.demora,
  result: respuesta.codigo
    ? { data: null, errors: [{ message: 'x', path: ['consultarReporte'], extensions: { codigo: respuesta.codigo, servicio: 'ia' } }] }
    : {
        data: {
          consultarReporte: {
            __typename: 'RespuestaReporte',
            conversacionId: respuesta.conversacionId ?? 'conv-1',
            ...(respuesta.aclaracion
              ? {
                  tipo: 'ACLARACION',
                  consulta: null,
                  aclaracion: { __typename: 'AclaracionReporte', preguntasRestantes: 4, ...respuesta.aclaracion },
                }
              : { tipo: 'REPORTE', consulta: { ...RESULTADO, ...respuesta.datos }, aclaracion: null }),
          },
        },
      },
});

const cuadro = () => screen.getByRole('textbox', { name: 'Pedido del reporte' });

async function pedir(texto: string) {
  fireEvent.change(await screen.findByRole('textbox', { name: 'Pedido del reporte' }), { target: { value: texto } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
}

describe('ReportesPagina (503): acceso', () => {
  it('el gerente llega desde el menú interno «Reportes»', async () => {
    sesion(['gerente']);
    const nav = dibujar('/supervision/riesgo', [catalogo(), historial()]);
    fireEvent.click(await screen.findByRole('tab', { name: 'Reportes' }));
    expect(await screen.findByRole('heading', { name: 'Reportes', level: 1 })).toBeTruthy();
    expect(nav.location.pathname).toBe('/supervision/reportes');
  });

  it('el residente no ve «Reportes» en el menú y, por la dirección, recibe el aviso de permiso', async () => {
    sesion(['residente']);
    dibujar('/supervision/reportes');
    expect(await screen.findByText('No tienes permiso para hacer esta acción.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Reportes' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Reportes' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Agentes' })).toBeTruthy();
  });
});

describe('ReportesPagina (503): consultar', () => {
  it('escribe el pedido, muestra «Preparando el reporte…» y luego el resultado (criterios 3, 8 y 11)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: 'Cobros vencidos de este año' }, { demora: 30 }),
      historial(),
    ]);
    await pedir('Cobros vencidos de este año');
    expect(await screen.findByText('Preparando el reporte…')).toBeTruthy();

    const resultado = within(await screen.findByRole('region', { name: 'Resultado del reporte' }));
    expect(resultado.getByRole('heading', { name: 'Cobros' })).toBeTruthy();
    expect(resultado.getByText('Hay 1 cobro vencido por Bs 12 500.')).toBeTruthy();
    expect(resultado.getByText('Estado: Vencido')).toBeTruthy();
    expect(resultado.getByText('Bs 12.500,00')).toBeTruthy();
    expect(screen.queryByText('Preparando el reporte…')).toBeNull();
  });

  it('un reporte común se pide con su atajo, sin texto (criterio 4)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ atajo: 'COBROS_VENCIDOS' }, { datos: { texto: null, atajo: 'COBROS_VENCIDOS' } }),
      historial(),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Cobros vencidos' }));
    const resultado = within(await screen.findByRole('region', { name: 'Resultado del reporte' }));
    expect(resultado.getByText('Pedido: Cobros vencidos')).toBeTruthy();
    expect(cuadro()).toBeTruthy();
  });

  it('si pasan 60 segundos sin respuesta avisa «El reporte tardó demasiado; intenta de nuevo» (criterio 11)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: 'Cobros vencidos de este año' }, { demora: 120_000 }),
    ]);
    await pedir('Cobros vencidos de este año');
    expect(await screen.findByText('Preparando el reporte…')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(await screen.findByText('El reporte tardó demasiado; intenta de nuevo')).toBeTruthy();
  });
});

describe('ReportesPagina (503): mensajes por código', () => {
  it.each(['INTENCION_NO_RECONOCIDA', 'RECETA_INVALIDA'])(
    '%s muestra «No encontré un reporte para tu pedido» con los conjuntos, sus ejemplos y los reportes comunes',
    async (codigo) => {
      sesion();
      dibujar('/supervision/reportes', [catalogo(), historial(), consultar({ texto: 'el clima de mañana' }, { codigo }), historial()]);
      await pedir('el clima de mañana');
      expect(await screen.findByText('No encontré un reporte para tu pedido')).toBeTruthy();
      expect(screen.getByText('Material usado')).toBeTruthy();
      expect(screen.getByText(/Número, monto, emisión/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cobros vencidos' })).toBeTruthy();

      // Un ejemplo pasa al cuadro de texto para consultarlo
      fireEvent.click(screen.getByRole('button', { name: 'Material usado por zona este año' }));
      expect((cuadro() as HTMLTextAreaElement).value).toBe('Material usado por zona este año');
    },
  );

  it.each([
    ['DEMASIADAS_CONSULTAS', 'Demasiadas consultas; espera un momento'],
    ['REPORTES_NO_DISPONIBLES', 'El servicio de reportes no está disponible; intenta de nuevo'],
    ['SERVICIO_NO_DISPONIBLE', 'El servicio de reportes no está disponible; intenta de nuevo'],
    ['TIEMPO_AGOTADO', 'El reporte tardó demasiado; intenta de nuevo'],
  ])('%s muestra «%s»', async (codigo, mensaje) => {
    sesion();
    dibujar('/supervision/reportes', [catalogo(), historial(), consultar({ texto: 'Cobros vencidos' }, { codigo }), historial()]);
    await pedir('Cobros vencidos');
    expect(await screen.findByText(mensaje)).toBeTruthy();
    expect(screen.queryByText(/Mientras tanto puedes usar los reportes comunes/)).toBeNull();
  });

  it('LLM_NO_DISPONIBLE sugiere los reportes comunes, que funcionan sin el modelo', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: 'Cobros vencidos' }, { codigo: 'LLM_NO_DISPONIBLE' }),
      historial(),
      consultar({ atajo: 'COBROS_VENCIDOS' }, { datos: { texto: null, atajo: 'COBROS_VENCIDOS' } }),
    ]);
    await pedir('Cobros vencidos');
    expect(await screen.findByText('El servicio de reportes no está disponible; intenta de nuevo')).toBeTruthy();
    expect(screen.getByText(/Mientras tanto puedes usar los reportes comunes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cobros vencidos' }));
    expect(await screen.findByRole('region', { name: 'Resultado del reporte' })).toBeTruthy();
  });
});

describe('ReportesPagina (503): historial', () => {
  const ANTERIORES = [
    {
      id: 'h1',
      texto: 'Planillas observadas de la zona norte',
      atajo: null,
      conjunto: 'PLANILLAS',
      resultado: 'OK',
      resumen: '…',
      totalFilas: 3,
      creadaEn: '2027-03-20T13:00:00Z',
    },
    {
      id: 'h2',
      texto: null,
      atajo: 'COBROS_VENCIDOS',
      conjunto: 'COBROS',
      resultado: 'OK',
      resumen: '…',
      totalFilas: 1,
      creadaEn: '2027-03-20T12:00:00Z',
    },
    {
      id: 'h3',
      texto: 'el clima de mañana',
      atajo: null,
      conjunto: null,
      resultado: 'NO_RECONOCIDA',
      resumen: null,
      totalFilas: null,
      creadaEn: '2027-03-20T11:00:00Z',
    },
  ];

  it('muestra las últimas consultas y al pulsar una vuelve a consultar con su texto o su atajo (criterio 16)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(ANTERIORES),
      consultar({ texto: 'Planillas observadas de la zona norte' }),
      historial(ANTERIORES),
      consultar({ atajo: 'COBROS_VENCIDOS' }, { datos: { texto: null, atajo: 'COBROS_VENCIDOS' } }),
    ]);
    const lista = within(await screen.findByRole('region', { name: 'Últimas consultas' }));
    expect(await lista.findByText('Planillas observadas de la zona norte')).toBeTruthy();
    expect(lista.getByText('20/03/2027 09:00 · 3 filas')).toBeTruthy();
    expect(await lista.findByText('Cobros vencidos')).toBeTruthy();
    expect(lista.getByText('20/03/2027 07:00 · No reconocida')).toBeTruthy();

    fireEvent.click(lista.getByText('Planillas observadas de la zona norte'));
    expect(await screen.findByRole('region', { name: 'Resultado del reporte' })).toBeTruthy();
    // 505: el pedido queda en la conversación y el cuadro de texto, libre
    const conversacion = within(screen.getByRole('list', { name: 'Conversación' }));
    expect(conversacion.getByText('Planillas observadas de la zona norte')).toBeTruthy();
    expect((cuadro() as HTMLTextAreaElement).value).toBe('');

    fireEvent.click(lista.getByText('Cobros vencidos'));
    expect(await screen.findByText('Pedido: Cobros vencidos')).toBeTruthy();
  });

  it('sin consultas avisa que aún no hay', async () => {
    sesion();
    dibujar('/supervision/reportes', [catalogo(), historial([])]);
    expect(await screen.findByText('Aún no hiciste consultas.')).toBeTruthy();
  });
});

describe('ReportesPagina (503): exportar y sin micrófono', () => {
  function capturarDescargas() {
    const descargas: { nombre: string; contenido: Blob }[] = [];
    const urls = new Map<string, Blob>();
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      const url = `blob:x/${urls.size}`;
      urls.set(url, b as Blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargas.push({ nombre: this.download, contenido: urls.get(this.href)! });
    });
    return descargas;
  }

  async function conResultado() {
    sesion();
    dibujar('/supervision/reportes', [catalogo(), historial(), consultar({ texto: 'Cobros vencidos de este año' }), historial()]);
    await pedir('Cobros vencidos de este año');
    await screen.findByRole('region', { name: 'Resultado del reporte' });
  }

  // La exportación carga `xlsx` con `import()` al pulsar el botón; con la máquina ocupada pasa del segundo por defecto.
  const ESPERA_DESCARGA = { timeout: 5000 };

  it('«Exportar a CSV» descarga la tabla en UTF-8 con BOM, sin pasar por el servidor', async () => {
    const descargas = capturarDescargas();
    await conResultado();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a CSV' }));
    await vi.waitFor(() => expect(descargas).toHaveLength(1), ESPERA_DESCARGA);
    expect(descargas[0].nombre).toBe('reporte-cobros-2027-03-20-1000.csv');
    const bytes = new Uint8Array(await descargas[0].contenido.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('Número,Monto neto\r\nCB-0001,12500');
  });

  it('«Exportar a Excel» descarga un .xlsx con las hojas «Datos» y «Consulta»', async () => {
    const descargas = capturarDescargas();
    await conResultado();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }));
    await vi.waitFor(() => expect(descargas).toHaveLength(1), ESPERA_DESCARGA);
    expect(descargas[0].nombre).toBe('reporte-cobros-2027-03-20-1000.xlsx');
    const XLSX = await import('xlsx');
    const libro = XLSX.read(await descargas[0].contenido.arrayBuffer());
    expect(libro.SheetNames).toEqual(['Datos', 'Consulta']);
    expect(libro.Sheets['Datos']['B2']).toMatchObject({ t: 'n', v: 12500 });
    expect(XLSX.utils.sheet_to_json<string[]>(libro.Sheets['Consulta'], { header: 1 }).at(-1)).toEqual([
      'Usuario',
      'Ana Gerente',
    ]);
  });

  it('sin micrófono en el navegador el pedido se escribe y se consulta igual (criterio 1)', async () => {
    sesion();
    dibujar('/supervision/reportes', [catalogo(), historial(), consultar({ texto: 'Cobros vencidos de este año' }), historial()]);
    expect(
      await screen.findByText('El dictado no está disponible en este navegador; puedes escribir el texto.'),
    ).toBeTruthy();
    await pedir('Cobros vencidos de este año');
    expect(await screen.findByRole('region', { name: 'Resultado del reporte' })).toBeTruthy();
  });

  it('sin conexión muestra el catálogo y el historial guardados en el equipo (104)', async () => {
    sesion();
    const guardado = { guardadoEn: '2027-03-19T22:00:00Z' };
    window.plataforma!.conexion = { enLinea: false, reportarFallo: vi.fn() };
    window.plataforma!.almacen = {
      guardarConsulta: vi.fn().mockResolvedValue(undefined),
      leerConsulta: vi.fn(async (clave: string) =>
        clave.startsWith('CatalogoReportes')
          ? { datos: { catalogoReportes: CATALOGO }, ...guardado }
          : { datos: { consultasReporte: [] }, ...guardado },
      ) as never,
    };
    dibujar('/supervision/reportes');
    expect(await screen.findByText('Sin conexión · datos del 19/03/2027 18:00')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Cobros vencidos' })).toBeTruthy();
    expect(screen.getByText('Aún no hiciste consultas.')).toBeTruthy();
  });
});

describe('ReportesPagina (505): conversación', () => {
  const PREGUNTA = '«cemento» coincide con dos materiales. ¿Cuál?';
  const OPCIONES = ['Cemento IP-30', 'Cemento cola', 'Todos'];
  const CONSUMO = {
    id: 'c2',
    texto: 'Cemento IP-30',
    conjunto: 'CONSUMO_MATERIAL',
    tituloConjunto: 'Material usado',
    aplicado: [{ __typename: 'ElementoAplicado', nombre: 'Material', valor: 'Cemento IP-30' }],
    resumen: 'Se usaron 120 bolsas de Cemento IP-30.',
    columnas: [
      { __typename: 'ColumnaReporte', clave: 'material', titulo: 'Material', tipo: 'TEXTO' },
      { __typename: 'ColumnaReporte', clave: 'cantidad', titulo: 'Cantidad', tipo: 'NUMERO' },
    ],
    filas: [['Cemento IP-30', '120']],
  };
  const TORRE_NORTE = { ...CONSUMO, id: 'c3', texto: '¿y en Torre Norte?', resumen: 'En Torre Norte se usaron 40 bolsas.' };

  const conversacion = () => within(screen.getByRole('list', { name: 'Conversación' }));
  const turnos = () => Array.from(screen.getByRole('list', { name: 'Conversación' }).children);
  const botonConsultar = () => screen.getByRole('button', { name: 'Consultar' }) as HTMLButtonElement;

  async function escribir(texto: string) {
    fireEvent.change(await screen.findByRole('textbox', { name: 'Pedido del reporte' }), { target: { value: texto } });
  }

  it('una pregunta con opciones en botones: al pulsar una se envía en la conversación y llega el reporte (criterios 1, 2 y 5)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: '¿Cuánto cemento se usó?' }, { aclaracion: { pregunta: PREGUNTA, opciones: OPCIONES } }),
      consultar({ texto: 'Cemento IP-30', conversacionId: 'conv-1' }, { datos: CONSUMO }),
    ]);
    await pedir('¿Cuánto cemento se usó?');

    const pregunta = within(await screen.findByRole('region', { name: 'Pregunta del asistente' }));
    expect(pregunta.getByText(PREGUNTA)).toBeTruthy();
    const opciones = within(pregunta.getByRole('group', { name: 'Opciones de respuesta' })).getAllByRole('button');
    expect(opciones.map((b) => b.textContent)).toEqual(OPCIONES);
    // El pedido queda en la conversación y el cuadro se vacía para responder
    expect(conversacion().getByText('¿Cuánto cemento se usó?')).toBeTruthy();
    expect((cuadro() as HTMLTextAreaElement).value).toBe('');

    fireEvent.click(pregunta.getByRole('button', { name: 'Cemento IP-30' }));
    const resultado = within(await screen.findByRole('region', { name: 'Resultado del reporte' }));
    expect(resultado.getByRole('heading', { name: 'Material usado' })).toBeTruthy();
    expect(resultado.getByText('Pedido: ¿Cuánto cemento se usó? · Cemento IP-30')).toBeTruthy();
    expect(resultado.getByText('Se usaron 120 bolsas de Cemento IP-30.')).toBeTruthy();

    // Todo queda a la vista, en orden; la pregunta ya respondida no se puede volver a pulsar
    expect(turnos()).toHaveLength(4);
    expect(within(turnos()[2] as HTMLElement).getByText('Cemento IP-30')).toBeTruthy();
    expect((pregunta.getByRole('button', { name: 'Cemento cola' }) as HTMLButtonElement).disabled).toBe(true);
    // La respuesta nueva recibe el foco (el botón pulsado ya no sirve)
    expect(document.activeElement).toBe(turnos()[3]);
  });

  it('después de un reporte, el seguimiento va con el conversacionId y se suma a la conversación (criterio 6)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: 'Cemento usado este mes' }, { datos: CONSUMO }),
      consultar({ texto: '¿y en Torre Norte?', conversacionId: 'conv-1' }, { datos: TORRE_NORTE }),
    ]);
    await pedir('Cemento usado este mes');
    await screen.findByRole('region', { name: 'Resultado del reporte' });

    await pedir('¿y en Torre Norte?');
    expect(await screen.findByText('En Torre Norte se usaron 40 bolsas.')).toBeTruthy();
    const resultados = screen.getAllByRole('region', { name: 'Resultado del reporte' });
    expect(resultados).toHaveLength(2);
    expect(within(resultados[1]).getByText('Pedido: ¿y en Torre Norte?')).toBeTruthy();
    expect(within(resultados[0]).getByText('Se usaron 120 bolsas de Cemento IP-30.')).toBeTruthy();
  });

  it('«Nueva consulta» borra la conversación y el siguiente pedido empieza otra; un reporte común también (criterio 7)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: 'Cemento usado este mes' }, { datos: CONSUMO }),
      consultar({ texto: 'Cobros vencidos de este año' }, { conversacionId: 'conv-2' }),
      consultar({ atajo: 'COBROS_VENCIDOS' }, { datos: { id: 'c4', texto: null, atajo: 'COBROS_VENCIDOS' }, conversacionId: 'conv-3' }),
    ]);
    expect(screen.queryByRole('button', { name: 'Nueva consulta' })).toBeNull();
    await pedir('Cemento usado este mes');
    await screen.findByRole('region', { name: 'Resultado del reporte' });

    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(screen.queryByRole('list', { name: 'Conversación' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Resultado del reporte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nueva consulta' })).toBeNull();
    // Sin conversación vuelve el mínimo de 3 caracteres
    await escribir('sí');
    expect(botonConsultar().disabled).toBe(true);

    // Sin conversacionId: el mock solo responde a las variables sin él
    await pedir('Cobros vencidos de este año');
    expect(await screen.findByText('Hay 1 cobro vencido por Bs 12 500.')).toBeTruthy();
    expect(conversacion().queryByText('Cemento usado este mes')).toBeNull();

    // Un reporte común empieza otra conversación, aunque haya una abierta
    fireEvent.click(screen.getByRole('button', { name: 'Cobros vencidos' }));
    expect(await screen.findByText('Pedido: Cobros vencidos')).toBeTruthy();
    expect(conversacion().queryByText('Cobros vencidos de este año')).toBeNull();
  });

  it('con la conversación expirada avisa «La conversación expiró: vuelve a hacer el pedido» y empieza una nueva (criterio 8)', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar({ texto: '¿Cuánto cemento se usó?' }, { aclaracion: { pregunta: PREGUNTA, opciones: OPCIONES } }),
      consultar({ texto: 'Todos', conversacionId: 'conv-1' }, { codigo: 'CONVERSACION_NO_ENCONTRADA' }),
      consultar({ texto: '¿Cuánto cemento se usó en total?' }, { datos: CONSUMO, conversacionId: 'conv-2' }),
    ]);
    await pedir('¿Cuánto cemento se usó?');
    fireEvent.click(await screen.findByRole('button', { name: 'Todos' }));

    expect(await screen.findByText('La conversación expiró: vuelve a hacer el pedido')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Conversación' })).toBeNull();
    // El texto vuelve al cuadro; sin conversación pide de 3 a 500 caracteres
    expect((cuadro() as HTMLTextAreaElement).value).toBe('Todos');

    await pedir('¿Cuánto cemento se usó en total?');
    expect(await screen.findByRole('region', { name: 'Resultado del reporte' })).toBeTruthy();
    expect(screen.queryByText('La conversación expiró: vuelve a hacer el pedido')).toBeNull();
  });

  it('responde desde 1 carácter solo con una conversación abierta', async () => {
    sesion();
    dibujar('/supervision/reportes', [
      catalogo(),
      historial(),
      consultar(
        { texto: 'Planillas del periodo' },
        { aclaracion: { pregunta: '¿De qué periodo? Escribe el número de la opción.', opciones: [] } },
      ),
      consultar({ texto: '2', conversacionId: 'conv-1' }, { datos: { id: 'c5' } }),
    ]);
    await escribir('x');
    expect(botonConsultar().disabled).toBe(true);
    expect(screen.getByText('El pedido debe tener entre 3 y 500 caracteres.')).toBeTruthy();

    await pedir('Planillas del periodo');
    const pregunta = within(await screen.findByRole('region', { name: 'Pregunta del asistente' }));
    expect(pregunta.queryByRole('group', { name: 'Opciones de respuesta' })).toBeNull();

    await escribir('2');
    expect(botonConsultar().disabled).toBe(false);
    expect(screen.queryByText(/El pedido debe tener entre/)).toBeNull();
    fireEvent.click(botonConsultar());
    expect(await screen.findByRole('region', { name: 'Resultado del reporte' })).toBeTruthy();
  });
});
