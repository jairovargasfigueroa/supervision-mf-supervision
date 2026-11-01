import type { CellObject, WorkBook, WorkSheet } from 'xlsx';
import { formatearFecha, formatearFechaHora } from '../nucleo/formato';
import type { ConsultaReporte, TipoColumna } from './reportes.graphql';

// Exportación del reporte en el navegador con SheetJS 0.20.3 (503, criterios 12 a 14): el archivo se arma aquí y
// se descarga sin pasar por el servidor. SheetJS se carga recién al exportar.

type Xlsx = typeof import('xlsx');

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
export function nombreArchivo(consulta: Pick<ConsultaReporte, 'conjunto' | 'creadaEn'>, extension: 'xlsx' | 'csv'): string {
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
