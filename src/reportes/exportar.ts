import type { CellObject, WorkBook, WorkSheet } from 'xlsx';
import type { jsPDF as JsPdf } from 'jspdf';
import type { Document as DocumentoWord } from 'docx';
import { formatearFecha, formatearFechaHora } from '../nucleo/formato';
import type { ConsultaReporte, TipoColumna } from './reportes.graphql';
import { AVISO_TRUNCADO, formatearCelda } from './ResultadoReporte';

// Exportación del reporte en el navegador (503, criterios 12 a 14; 505, criterio 18): el archivo se arma aquí y se
// descarga sin pasar por el servidor. Excel y CSV con SheetJS 0.20.3; PDF con jspdf + jspdf-autotable y Word con
// docx (505). Cada librería se carga recién al pulsar su botón.

type Xlsx = typeof import('xlsx');
type Jspdf = typeof import('jspdf');
type AutoTable = (typeof import('jspdf-autotable'))['autoTable'];
type Docx = typeof import('docx');

/** Lo que el archivo cuenta de la consulta además de la tabla. */
export interface ContextoExportacion {
  /** Texto pedido o título del reporte común. */
  pedido: string;
  /** Nombre del usuario de la sesión. */
  usuario: string;
}

const PARECE_FORMULA = /^[=+\-@]/;

/** Un texto que empieza con `=`, `+`, `-` o `@` lleva un apóstrofo delante, para que no se tome como fórmula. */
export function protegerTexto(texto: string): string {
  return PARECE_FORMULA.test(texto) ? `'${texto}` : texto;
}

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` de un valor de fecha (un instante se lleva a la fecha de La Paz). */
export function fechaIso(valor: string): string {
  if (SOLO_FECHA.test(valor)) return valor;
  const [dia, mes, anio] = formatearFecha(valor).split('/');
  return `${anio}-${mes}-${dia}`;
}

/** `reporte-<conjunto>-<AAAA-MM-DD-HHmm>.<extension>`, con la hora de la consulta en La Paz. */
export function nombreArchivo(
  consulta: Pick<ConsultaReporte, 'conjunto' | 'creadaEn'>,
  extension: 'xlsx' | 'csv' | 'pdf' | 'docx',
): string {
  const [fecha, hora] = formatearFechaHora(consulta.creadaEn).split(' ');
  const [dia, mes, anio] = fecha.split('/');
  return `reporte-${consulta.conjunto.toLowerCase()}-${anio}-${mes}-${dia}-${hora.replace(':', '')}.${extension}`;
}

const FORMATO_NUMERO: Partial<Record<TipoColumna, string>> = { MONTO: '#,##0.00', PORCENTAJE: '0.0' };

/** Celda de la hoja «Datos»: números como número, fechas como fecha, booleanos «Sí»/«No» y textos protegidos. */
export function celdaExcel(valor: string | null, tipo: TipoColumna): CellObject | undefined {
  if (valor === null || valor === '') return undefined;
  switch (tipo) {
    case 'NUMERO':
    case 'MONTO':
    case 'PORCENTAJE': {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) return { t: 's', v: protegerTexto(valor) };
      const z = FORMATO_NUMERO[tipo];
      return z ? { t: 'n', v: numero, z } : { t: 'n', v: numero };
    }
    case 'FECHA': {
      if (Number.isNaN(Date.parse(valor))) return { t: 's', v: protegerTexto(valor) };
      const [anio, mes, dia] = fechaIso(valor).split('-').map(Number);
      // Medianoche local: SheetJS guarda la fecha del calendario sin correrla de día
      return { t: 'd', v: new Date(anio, mes - 1, dia), z: 'dd/mm/yyyy' };
    }
    case 'BOOLEANO':
      return { t: 's', v: valor === 'true' ? 'Sí' : valor === 'false' ? 'No' : protegerTexto(valor) };
    default:
      return { t: 's', v: protegerTexto(valor) };
  }
}

function hojaDesdeCeldas(xlsx: Xlsx, filas: (CellObject | undefined)[][]): WorkSheet {
  const hoja: WorkSheet = {};
  let columnas = 0;
  filas.forEach((fila, r) => {
    columnas = Math.max(columnas, fila.length);
    fila.forEach((celda, c) => {
      if (celda) hoja[xlsx.utils.encode_cell({ r, c })] = celda;
    });
  });
  hoja['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(filas.length - 1, 0), c: Math.max(columnas - 1, 0) } });
  return hoja;
}

const texto = (v: string): CellObject => ({ t: 's', v: protegerTexto(v) });

/** Libro con las hojas «Datos» (la tabla) y «Consulta» (qué se pidió y qué se aplicó). */
export function crearLibroExcel(xlsx: Xlsx, consulta: ConsultaReporte, contexto: ContextoExportacion): WorkBook {
  const datos = hojaDesdeCeldas(xlsx, [
    consulta.columnas.map((c) => texto(c.titulo)),
    ...consulta.filas.map((fila) => consulta.columnas.map((c, i) => celdaExcel(fila[i] ?? null, c.tipo))),
  ]);
  datos['!cols'] = consulta.columnas.map((c) => ({ wch: Math.max(12, c.titulo.length + 2) }));

  const resumen = hojaDesdeCeldas(xlsx, [
    [texto('Pedido'), texto(contexto.pedido)],
    [texto('Conjunto'), texto(consulta.tituloConjunto)],
    [texto('Aplicado'), texto(consulta.aplicado.map((a) => `${a.nombre}: ${a.valor}`).join('; ') || '—')],
    [texto('Resumen'), texto(consulta.resumen)],
    [texto('Avisos'), texto(consulta.avisos.join('; ') || '—')],
    [texto('Fecha'), texto(formatearFechaHora(consulta.creadaEn))],
    [texto('Usuario'), texto(contexto.usuario)],
  ]);
  resumen['!cols'] = [{ wch: 12 }, { wch: 100 }];

  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, datos, 'Datos');
  xlsx.utils.book_append_sheet(libro, resumen, 'Consulta');
  return libro;
}

/** Genera y descarga el `.xlsx` (criterio 12). */
export async function exportarExcel(consulta: ConsultaReporte, contexto: ContextoExportacion): Promise<void> {
  const xlsx = await import('xlsx');
  xlsx.writeFile(crearLibroExcel(xlsx, consulta, contexto), nombreArchivo(consulta, 'xlsx'), { compression: true });
}

/** Celda para el CSV: números con punto decimal, fechas `AAAA-MM-DD`, booleanos «Sí»/«No» y textos protegidos. */
function celdaCsv(valor: string | null, tipo: TipoColumna): CellObject | undefined {
  if (valor === null || valor === '') return undefined;
  if (tipo === 'FECHA' && !Number.isNaN(Date.parse(valor))) return { t: 's', v: fechaIso(valor) };
  if (tipo === 'NUMERO' || tipo === 'MONTO' || tipo === 'PORCENTAJE') {
    const numero = Number(valor);
    return Number.isFinite(numero) ? { t: 'n', v: numero } : { t: 's', v: protegerTexto(valor) };
  }
  return celdaExcel(valor, tipo);
}

/** Marca de orden de bytes: así Excel lee el CSV como UTF-8 (con tildes). */
export const BOM = '﻿';

/** Texto del CSV: solo la tabla, separada por comas, con BOM (criterio 13). */
export function textoCsv(xlsx: Xlsx, consulta: ConsultaReporte): string {
  const hoja = hojaDesdeCeldas(xlsx, [
    consulta.columnas.map((c) => texto(c.titulo)),
    ...consulta.filas.map((fila) => consulta.columnas.map((c, i) => celdaCsv(fila[i] ?? null, c.tipo))),
  ]);
  return BOM + xlsx.utils.sheet_to_csv(hoja, { FS: ',', RS: '\r\n' });
}

/** Descarga un archivo armado en el navegador. */
function descargar(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.style.display = 'none';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Genera y descarga el `.csv` en UTF-8 (criterio 13). */
export async function exportarCsv(consulta: ConsultaReporte): Promise<void> {
  const xlsx = await import('xlsx');
  descargar(new Blob([textoCsv(xlsx, consulta)], { type: 'text/csv;charset=utf-8' }), nombreArchivo(consulta, 'csv'));
}

// 505: PDF y Word. Llevan lo mismo que la pantalla, en este orden: título, fecha, pedido, lo que se aplicó, resumen,
// avisos y la tabla, con las celdas formateadas como en la pantalla (montos «Bs», fechas dd/mm/aaaa, «Sí»/«No», «—»).

/** Con más columnas que estas, el PDF y el Word van en horizontal. */
export const MAXIMO_COLUMNAS_VERTICAL = 6;

const NUMERICAS: TipoColumna[] = ['NUMERO', 'MONTO', 'PORCENTAJE'];

/** Lo que llevan el PDF y el Word, ya en texto. */
export interface DocumentoReporte {
  titulo: string;
  /** Datos de la consulta, en orden: «Fecha», «Pedido», «Lo que se aplicó», «Resumen» y «Avisos» (si hay). */
  datos: { nombre: string; valor: string }[];
  columnas: { titulo: string; numerica: boolean }[];
  filas: string[][];
  horizontal: boolean;
}

/** Arma el contenido del PDF y el Word a partir de la consulta. */
export function documentoReporte(consulta: ConsultaReporte, contexto: ContextoExportacion): DocumentoReporte {
  const avisos = [...consulta.avisos, ...(consulta.truncado ? [AVISO_TRUNCADO] : [])];
  const datos = [
    { nombre: 'Fecha', valor: formatearFechaHora(consulta.creadaEn) },
    { nombre: 'Pedido', valor: contexto.pedido },
    { nombre: 'Lo que se aplicó', valor: consulta.aplicado.map((a) => `${a.nombre}: ${a.valor}`).join('; ') || '—' },
    { nombre: 'Resumen', valor: consulta.resumen },
    ...(avisos.length > 0 ? [{ nombre: 'Avisos', valor: avisos.join('\n') }] : []),
  ];
  return {
    titulo: consulta.tituloConjunto,
    datos,
    columnas: consulta.columnas.map((c) => ({ titulo: c.titulo, numerica: NUMERICAS.includes(c.tipo) })),
    filas: consulta.filas.map((fila) => consulta.columnas.map((c, i) => formatearCelda(fila[i] ?? null, c.tipo))),
    horizontal: consulta.columnas.length > MAXIMO_COLUMNAS_VERTICAL,
  };
}

type Rgb = [number, number, number];

/** Colores del tema (docs/diseno-visual.md): primario, texto, texto secundario y borde. */
const PRIMARIO: Rgb = [14, 77, 92];
const TEXTO: Rgb = [20, 35, 42];
const TEXTO_SECUNDARIO: Rgb = [86, 103, 111];
const BORDE: Rgb = [218, 226, 229];

/** PDF A4 en puntos: título, los datos de la consulta y la tabla (jspdf-autotable reparte las páginas). */
export function crearPdf({ jsPDF }: Jspdf, autoTable: AutoTable, documento: DocumentoReporte): JsPdf {
  const pdf = new jsPDF({ orientation: documento.horizontal ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  pdf.setProperties({ title: documento.titulo });
  const margen = 40;
  const ancho = pdf.internal.pageSize.getWidth() - 2 * margen;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...PRIMARIO);
  const titulo = pdf.splitTextToSize(documento.titulo, ancho) as string[];
  pdf.text(titulo, margen, margen + 16);
  const despuesDelTitulo = margen + 12 + titulo.length * 20;

  const margenes = { left: margen, right: margen, top: margen, bottom: margen };
  autoTable(pdf, {
    startY: despuesDelTitulo,
    theme: 'plain',
    margin: margenes,
    styles: { font: 'helvetica', fontSize: 10, textColor: TEXTO, cellPadding: { top: 2, bottom: 2, left: 0, right: 8 } },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110, textColor: TEXTO_SECUNDARIO } },
    body: documento.datos.map((d) => [d.nombre, d.valor]),
  });
  const despuesDeLosDatos = (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? despuesDelTitulo;

  if (documento.columnas.length > 0) {
    const numericas = new Set(documento.columnas.flatMap((c, i) => (c.numerica ? [i] : [])));
    autoTable(pdf, {
      startY: despuesDeLosDatos + 12,
      theme: 'grid',
      margin: margenes,
      styles: {
        font: 'helvetica',
        fontSize: documento.horizontal ? 8 : 9,
        textColor: TEXTO,
        lineColor: BORDE,
        lineWidth: 0.5,
        cellPadding: 4,
        overflow: 'linebreak',
      },
      headStyles: { fillColor: PRIMARIO, textColor: 255, fontStyle: 'bold' },
      head: [documento.columnas.map((c) => c.titulo)],
      body: documento.filas,
      // Números alineados a la derecha, como en la pantalla
      didParseCell: (dato) => {
        if (numericas.has(dato.column.index)) dato.cell.styles.halign = 'right';
      },
    });
  }
  return pdf;
}

/** Genera y descarga el `.pdf` (505, criterio 18). */
export async function exportarPdf(consulta: ConsultaReporte, contexto: ContextoExportacion): Promise<void> {
  const [jspdf, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = crearPdf(jspdf, autoTable, documentoReporte(consulta, contexto));
  descargar(pdf.output('blob'), nombreArchivo(consulta, 'pdf'));
}

/** Tipo del archivo de Word. */
export const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Ancho útil de la página A4 en twips con márgenes de media pulgada (720), en vertical y en horizontal. */
const ANCHO_UTIL_TWIPS = { vertical: 11906 - 1440, horizontal: 16838 - 1440 };

const hex = (rgb: Rgb) => rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Documento de Word: título, los datos de la consulta (nombre en negrita) y la tabla con el encabezado repetido. */
export function crearWord(docx: Docx, documento: DocumentoReporte): DocumentoWord {
  const { AlignmentType, Document, HeadingLevel, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } =
    docx;

  // Los saltos de línea del texto (resumen, avisos) se respetan
  const lineas = (texto: string) =>
    texto.split('\n').map((linea, i) => new TextRun({ text: linea, break: i > 0 ? 1 : undefined }));

  const datos = documento.datos.map(
    (d) =>
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `${d.nombre}: `, bold: true, color: hex(TEXTO_SECUNDARIO) }), ...lineas(d.valor)],
      }),
  );

  const anchoUtil = documento.horizontal ? ANCHO_UTIL_TWIPS.horizontal : ANCHO_UTIL_TWIPS.vertical;
  const anchoColumna = Math.floor(anchoUtil / Math.max(documento.columnas.length, 1));
  const celda = (texto: string, numerica: boolean, encabezado = false) =>
    new TableCell({
      shading: encabezado ? { type: ShadingType.CLEAR, color: 'auto', fill: hex(PRIMARIO) } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: numerica ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text: texto, bold: encabezado, color: encabezado ? 'FFFFFF' : undefined })],
        }),
      ],
    });
  const tabla =
    documento.columnas.length > 0
      ? [
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: documento.columnas.map(() => anchoColumna),
            rows: [
              new TableRow({ tableHeader: true, children: documento.columnas.map((c) => celda(c.titulo, c.numerica, true)) }),
              ...documento.filas.map(
                (fila) => new TableRow({ children: documento.columnas.map((c, i) => celda(fila[i] ?? '', c.numerica)) }),
              ),
            ],
          }),
        ]
      : [];

  return new Document({
    title: documento.titulo,
    styles: { default: { document: { run: { font: 'Arial', size: 20, color: hex(TEXTO) } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: documento.horizontal ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 160 },
            children: [new TextRun({ text: documento.titulo, bold: true, size: 32, color: hex(PRIMARIO) })],
          }),
          ...datos,
          ...tabla,
        ],
      },
    ],
  });
}

/** Genera y descarga el `.docx` (505, criterio 18). */
export async function exportarWord(consulta: ConsultaReporte, contexto: ContextoExportacion): Promise<void> {
  const docx = await import('docx');
  const bytes = await docx.Packer.toArrayBuffer(crearWord(docx, documentoReporte(consulta, contexto)));
  descargar(new Blob([bytes], { type: TIPO_DOCX }), nombreArchivo(consulta, 'docx'));
}
