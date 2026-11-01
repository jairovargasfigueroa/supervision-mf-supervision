import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { crearLibroExcel, fechaIso, nombreArchivo, protegerTexto, textoCsv } from './exportar';
import type { ConsultaReporte } from './reportes.graphql';

const CONSULTA: ConsultaReporte = {
  id: 'c1',
  texto: 'Movimientos de material de este mes',
  atajo: null,
  conjunto: 'MOVIMIENTOS',
  tituloConjunto: 'Movimientos de material',
  aplicado: [
    { nombre: 'Periodo', valor: '2027-03' },
    { nombre: 'Orden', valor: 'Fecha (mayor a menor)' },
  ],
  resumen: 'Hubo 2 salidas de cemento en marzo.',
  resumenPlantilla: false,
  avisos: ['Nombres de materiales no disponibles'],
  columnas: [
    { clave: 'fecha', titulo: 'Fecha', tipo: 'FECHA' },
    { clave: 'obra', titulo: 'Obra', tipo: 'TEXTO' },
    { clave: 'cantidad', titulo: 'Cantidad', tipo: 'NUMERO' },
    { clave: 'monto', titulo: 'Monto neto', tipo: 'MONTO' },
    { clave: 'avance', titulo: 'Avance %', tipo: 'PORCENTAJE' },
    { clave: 'supera_stock', titulo: 'Superó el stock', tipo: 'BOOLEANO' },
    { clave: 'motivo', titulo: 'Último motivo', tipo: 'TEXTO' },
  ],
  filas: [
    ['2027-03-18', 'Edificio Las Palmas', '40.500', '2511.00', '32.5', 'true', '=HYPERLINK("http://x")'],
    ['2027-03-02T15:30:00Z', '@Obra rara', '-3', null, null, 'false', null],
  ],
  totalFilas: 2,
  truncado: false,
  creadaEn: '2027-03-20T14:05:00Z',
};

const CONTEXTO = { pedido: 'Movimientos de material de este mes', usuario: 'Ana Gerente' };

/** Escribe el libro como .xlsx y lo vuelve a leer, como lo abriría Excel. */
function releer() {
  const bytes = XLSX.write(crearLibroExcel(XLSX, CONSULTA, CONTEXTO), { type: 'array', bookType: 'xlsx' });
  return XLSX.read(bytes, { cellDates: true, cellNF: true });
}

describe('exportarExcel (503, criterios 12 y 14)', () => {
  it('genera las hojas «Datos» y «Consulta»', () => {
    expect(releer().SheetNames).toEqual(['Datos', 'Consulta']);
  });

  it('en «Datos» los encabezados son los títulos y los tipos de celda siguen el tipo de la columna', () => {
    const hoja = releer().Sheets['Datos'];
    expect(['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'].map((c) => hoja[c].v)).toEqual([
      'Fecha',
      'Obra',
      'Cantidad',
      'Monto neto',
      'Avance %',
      'Superó el stock',
      'Último motivo',
    ]);
    // Fechas como fecha
    expect(hoja['A2'].t).toBe('d');
    expect(hoja['A2'].w).toBe('18/03/2027');
    expect(hoja['A3'].w).toBe('02/03/2027');
    // Números como número
    expect(hoja['C2'].t).toBe('n');
    expect(hoja['C2'].v).toBe(40.5);
    expect(hoja['C3'].v).toBe(-3);
    expect(hoja['D2'].t).toBe('n');
    expect(hoja['D2'].v).toBe(2511);
    expect(hoja['D2'].z).toBe('#,##0.00');
    expect(hoja['E2'].v).toBe(32.5);
    // Booleanos como «Sí»/«No» y textos como texto
    expect(hoja['F2']).toMatchObject({ t: 's', v: 'Sí' });
    expect(hoja['F3']).toMatchObject({ t: 's', v: 'No' });
    expect(hoja['B2']).toMatchObject({ t: 's', v: 'Edificio Las Palmas' });
    // Vacíos
    expect(hoja['D3']).toBeUndefined();
    expect(hoja['!ref']).toBe('A1:G3');
  });

  it('a los textos tipo fórmula les antepone un apóstrofo y no quedan como fórmula', () => {
    const hoja = releer().Sheets['Datos'];
    expect(hoja['G2']).toMatchObject({ t: 's', v: `'=HYPERLINK("http://x")` });
    expect(hoja['G2'].f).toBeUndefined();
    expect(hoja['B3'].v).toBe("'@Obra rara");
  });

  it('en «Consulta» van el pedido, el conjunto, lo aplicado, el resumen, los avisos, la fecha y el usuario', () => {
    const hoja = releer().Sheets['Consulta'];
    const filas = XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1 });
    expect(filas).toEqual([
      ['Pedido', 'Movimientos de material de este mes'],
      ['Conjunto', 'Movimientos de material'],
      ['Aplicado', 'Periodo: 2027-03; Orden: Fecha (mayor a menor)'],
      ['Resumen', 'Hubo 2 salidas de cemento en marzo.'],
      ['Avisos', 'Nombres de materiales no disponibles'],
      ['Fecha', '20/03/2027 10:05'],
      ['Usuario', 'Ana Gerente'],
    ]);
  });

  it('nombra el archivo con el conjunto y la hora de la consulta en La Paz', () => {
    expect(nombreArchivo(CONSULTA, 'xlsx')).toBe('reporte-movimientos-2027-03-20-1005.xlsx');
  });

  it('protege solo los textos que empiezan con =, +, - o @', () => {
    expect(['=1+1', '+591', '-x', '@a', 'a=b', ''].map(protegerTexto)).toEqual(["'=1+1", "'+591", "'-x", "'@a", 'a=b', '']);
    expect(fechaIso('2027-03-02T03:30:00Z')).toBe('2027-03-01');
  });
});

describe('exportarCsv (503, criterios 13 y 14)', () => {
  it('genera solo la tabla, en UTF-8 con BOM, con punto decimal, fechas AAAA-MM-DD y textos tipo fórmula protegidos', () => {
    const csv = textoCsv(XLSX, CONSULTA);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Fecha,Obra,Cantidad,Monto neto,Avance %,Superó el stock,Último motivo',
      `2027-03-18,Edificio Las Palmas,40.5,2511,32.5,Sí,"'=HYPERLINK(""http://x"")"`,
      "2027-03-02,'@Obra rara,-3,,,No,",
    ]);
    expect(nombreArchivo(CONSULTA, 'csv')).toBe('reporte-movimientos-2027-03-20-1005.csv');
  });

  it('las tildes sobreviven a la codificación UTF-8', async () => {
    const bytes = new TextEncoder().encode(textoCsv(XLSX, CONSULTA));
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain('Superó el stock');
  });
});
