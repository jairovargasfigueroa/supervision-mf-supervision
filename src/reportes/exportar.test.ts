import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import * as jspdf from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import * as docx from 'docx';
import {
  crearLibroExcel,
  crearPdf,
  crearWord,
  documentoReporte,
  fechaIso,
  nombreArchivo,
  protegerTexto,
  textoCsv,
} from './exportar';
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

/** Consulta de 2 columnas (va en vertical), recortada a 100 filas. */
const ANGOSTA: ConsultaReporte = {
  ...CONSULTA,
  conjunto: 'COBROS',
  tituloConjunto: 'Cobros',
  aplicado: [],
  avisos: [],
  truncado: true,
  columnas: [
    { clave: 'numero', titulo: 'Número', tipo: 'TEXTO' },
    { clave: 'monto', titulo: 'Monto neto', tipo: 'MONTO' },
  ],
  filas: [['CB-0001', '12500.00']],
};

describe('documentoReporte (505, criterio 18)', () => {
  it('lleva el título, la fecha, el pedido, lo que se aplicó, el resumen, los avisos y la tabla formateada como en la pantalla', () => {
    const documento = documentoReporte(CONSULTA, CONTEXTO);
    expect(documento.titulo).toBe('Movimientos de material');
    expect(documento.datos).toEqual([
      { nombre: 'Fecha', valor: '20/03/2027 10:05' },
      { nombre: 'Pedido', valor: 'Movimientos de material de este mes' },
      { nombre: 'Lo que se aplicó', valor: 'Periodo: 2027-03; Orden: Fecha (mayor a menor)' },
      { nombre: 'Resumen', valor: 'Hubo 2 salidas de cemento en marzo.' },
      { nombre: 'Avisos', valor: 'Nombres de materiales no disponibles' },
    ]);
    expect(documento.columnas.map((c) => c.numerica)).toEqual([false, false, true, true, true, false, false]);
    expect(documento.filas).toEqual([
      ['18/03/2027', 'Edificio Las Palmas', '40,5', 'Bs 2.511,00', '32,5 %', 'Sí', '=HYPERLINK("http://x")'],
      ['02/03/2027', '@Obra rara', '-3', '—', '—', 'No', '—'],
    ]);
    // 7 columnas: en horizontal
    expect(documento.horizontal).toBe(true);
  });

  it('sin nada aplicado muestra «—», el recorte de filas va en los avisos y con pocas columnas queda en vertical', () => {
    const documento = documentoReporte(ANGOSTA, { pedido: 'Cobros vencidos', usuario: 'Ana' });
    expect(documento.datos.find((d) => d.nombre === 'Lo que se aplicó')?.valor).toBe('—');
    expect(documento.datos.at(-1)).toEqual({ nombre: 'Avisos', valor: 'Se muestran las primeras 100 filas' });
    expect(documento.horizontal).toBe(false);
  });
});

describe('exportarPdf (505, criterio 18)', () => {
  it('arma un PDF con el título, los datos de la consulta y la tabla; en horizontal si hay muchas columnas', () => {
    const pdf = crearPdf(jspdf, autoTable, documentoReporte(CONSULTA, CONTEXTO));
    const ancho = pdf.internal.pageSize.getWidth();
    const alto = pdf.internal.pageSize.getHeight();
    expect(ancho).toBeGreaterThan(alto);
    // jsPDF escribe el texto sin comprimir, en Latin-1
    const contenido = pdf.output();
    expect(contenido.startsWith('%PDF-')).toBe(true);
    for (const texto of [
      'Movimientos de material',
      '20/03/2027 10:05',
      'Movimientos de material de este mes',
      'Lo que se aplicó',
      'Periodo: 2027-03; Orden: Fecha \\(mayor a menor\\)',
      'Hubo 2 salidas de cemento en marzo.',
      'Nombres de materiales no disponibles',
      'Superó el stock',
      'Bs 2.511,00',
      '32,5 %',
      '18/03/2027',
    ]) {
      expect(contenido).toContain(texto);
    }
  });

  it('con pocas columnas va en vertical y nombra el archivo .pdf', () => {
    const pdf = crearPdf(jspdf, autoTable, documentoReporte(ANGOSTA, { pedido: 'Cobros vencidos', usuario: 'Ana' }));
    expect(pdf.internal.pageSize.getWidth()).toBeLessThan(pdf.internal.pageSize.getHeight());
    expect(pdf.output()).toContain('Bs 12.500,00');
    expect(nombreArchivo(ANGOSTA, 'pdf')).toBe('reporte-cobros-2027-03-20-1005.pdf');
  });
});

describe('exportarWord (505, criterio 18)', () => {
  /** Arma el .docx y devuelve el XML del cuerpo (`word/document.xml` dentro del zip). */
  async function cuerpo(consulta: ConsultaReporte) {
    const bytes = await docx.Packer.toArrayBuffer(crearWord(docx, documentoReporte(consulta, CONTEXTO)));
    const zip = XLSX.CFB.read(new Uint8Array(bytes), { type: 'array' });
    const archivo = XLSX.CFB.find(zip, '/word/document.xml');
    return new TextDecoder().decode(archivo.content as Uint8Array);
  }

  it('arma un .docx con el título, los datos de la consulta y la tabla con encabezado; en horizontal si hay muchas columnas', async () => {
    const xml = await cuerpo(CONSULTA);
    for (const texto of [
      '>Movimientos de material<',
      '>Fecha: <',
      '>20/03/2027 10:05<',
      '>Lo que se aplicó: <',
      '>Periodo: 2027-03; Orden: Fecha (mayor a menor)<',
      '>Hubo 2 salidas de cemento en marzo.<',
      '>Nombres de materiales no disponibles<',
      '>Superó el stock<',
      '>Bs 2.511,00<',
      '>=HYPERLINK(&quot;http://x&quot;)<',
    ]) {
      expect(xml).toContain(texto);
    }
    expect(xml).toContain('w:orient="landscape"');
    expect(xml).toContain('<w:tblHeader/>');
  });

  it('con pocas columnas queda en vertical y nombra el archivo .docx', async () => {
    const xml = await cuerpo(ANGOSTA);
    expect(xml).not.toContain('w:orient="landscape"');
    expect(xml).toContain('>Bs 12.500,00<');
    expect(nombreArchivo(ANGOSTA, 'docx')).toBe('reporte-cobros-2027-03-20-1005.docx');
  });
});
