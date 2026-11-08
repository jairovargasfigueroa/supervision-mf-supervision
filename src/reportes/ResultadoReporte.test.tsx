import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { formatearCelda, ResultadoReporte } from './ResultadoReporte';
import type { ConsultaReporte } from './reportes.graphql';

afterEach(cleanup);

const CONSULTA_MATERIAL: ConsultaReporte = {
  id: 'c1',
  texto: '¿Cuánto cemento se usó en Las Palmas este trimestre?',
  atajo: null,
  conjunto: 'CONSUMO_MATERIAL',
  tituloConjunto: 'Material usado',
  aplicado: [
    { nombre: 'Obra', valor: 'contiene «Las Palmas»' },
    { nombre: 'Periodo', valor: '2027-01 a 2027-03' },
  ],
  resumen: 'En Edificio Las Palmas se usaron 1240 bolsas de cemento IP-30 entre enero y marzo.',
  resumenPlantilla: false,
  avisos: ['Nombres de clientes no disponibles'],
  columnas: [
    { clave: 'obra', titulo: 'Obra', tipo: 'TEXTO' },
    { clave: 'material', titulo: 'Material', tipo: 'TEXTO' },
    { clave: 'suma_cantidad', titulo: 'Total Cantidad', tipo: 'NUMERO' },
    { clave: 'suma_monto', titulo: 'Total Monto referencial', tipo: 'MONTO' },
    { clave: 'avance', titulo: 'Avance %', tipo: 'PORCENTAJE' },
    { clave: 'fecha', titulo: 'Última', tipo: 'FECHA' },
    { clave: 'supera', titulo: 'Superó el stock', tipo: 'BOOLEANO' },
  ],
  filas: [
    ['Edificio Las Palmas', 'Cemento IP-30', '1240.000', '76880.00', '32.5', '2027-03-18', 'true'],
    ['Condominio Las Lomas', null, '80', '4960', '10', null, 'false'],
  ],
  totalFilas: 2,
  truncado: false,
  creadaEn: '2027-03-20T14:00:00Z',
};

describe('ResultadoReporte (503, criterio 8)', () => {
  it('muestra el conjunto, lo aplicado, el resumen, los avisos y la tabla con formato por tipo', () => {
    render(<ResultadoReporte consulta={CONSULTA_MATERIAL} pedido={CONSULTA_MATERIAL.texto!} />);
    const seccion = within(screen.getByRole('region', { name: 'Resultado del reporte' }));
    expect(seccion.getByRole('heading', { name: 'Material usado' })).toBeTruthy();
    expect(seccion.getByText('Pedido: ¿Cuánto cemento se usó en Las Palmas este trimestre?')).toBeTruthy();
    expect(seccion.getByText('Obra: contiene «Las Palmas»')).toBeTruthy();
    expect(seccion.getByText('Periodo: 2027-01 a 2027-03')).toBeTruthy();
    expect(seccion.getByLabelText('Resumen').textContent).toMatch(/^En Edificio Las Palmas se usaron 1240 bolsas/);
    expect(seccion.getByText('Nombres de clientes no disponibles')).toBeTruthy();
    expect(seccion.queryByText('Se muestran las primeras 100 filas')).toBeNull();

    const tabla = within(screen.getByRole('table', { name: 'Reporte: Material usado' }));
    const encabezados = tabla.getAllByRole('columnheader').map((c) => c.textContent);
    expect(encabezados).toEqual([
      'Obra',
      'Material',
      'Total Cantidad',
      'Total Monto referencial',
      'Avance %',
      'Última',
      'Superó el stock',
    ]);
    const celdas = tabla.getAllByRole('row')[1].querySelectorAll('td');
    expect(Array.from(celdas).map((c) => c.textContent)).toEqual([
      'Edificio Las Palmas',
      'Cemento IP-30',
      '1.240',
      'Bs 76.880,00',
      '32,5 %',
      '18/03/2027',
      'Sí',
    ]);
    const segunda = Array.from(tabla.getAllByRole('row')[2].querySelectorAll('td')).map((c) => c.textContent);
    expect(segunda[1]).toBe('—');
    expect(segunda[5]).toBe('—');
    expect(segunda[6]).toBe('No');
  });

  it('con más de 100 filas avisa «Se muestran las primeras 100 filas»', () => {
    render(<ResultadoReporte consulta={{ ...CONSULTA_MATERIAL, truncado: true }} pedido="x" />);
    expect(screen.getByText('Se muestran las primeras 100 filas')).toBeTruthy();
  });

  it('sin filas muestra el resumen y la tabla vacía (criterio 9)', () => {
    render(
      <ResultadoReporte
        consulta={{ ...CONSULTA_MATERIAL, filas: [], totalFilas: 0, resumen: 'No hay datos para esos filtros.' }}
        pedido="x"
      />,
    );
    expect(screen.getByText('No hay datos para esos filtros.')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1);
  });

  it('un resumen con etiquetas HTML se muestra como texto', () => {
    render(<ResultadoReporte consulta={{ ...CONSULTA_MATERIAL, resumen: '<b>negrita</b><script>x</script>' }} pedido="x" />);
    expect(screen.getByLabelText('Resumen').textContent).toBe('<b>negrita</b><script>x</script>');
    expect(document.querySelector('b')).toBeNull();
  });

  it('formatea cada tipo de celda', () => {
    expect(formatearCelda('1250000', 'MONTO')).toBe('Bs 1.250.000,00');
    expect(formatearCelda('-12.5', 'NUMERO')).toBe('-12,5');
    expect(formatearCelda('2027-03-20T14:00:00Z', 'FECHA')).toBe('20/03/2027');
    expect(formatearCelda(null, 'TEXTO')).toBe('—');
    expect(formatearCelda('=SUMA(A1)', 'TEXTO')).toBe('=SUMA(A1)');
  });
});
