// Formatos de pantalla según docs/diseno-visual.md («Formatos»).
// Intl con es-BO pone un espacio duro entre «Bs» y el número, pega el «%» al número
// y separa fecha y hora con «, »; por eso se arma la salida a mano. es-BO ya agrupa
// los miles desde 4 cifras (1.250); las pruebas lo comprueban.

const ZONA_HORARIA = 'America/La_Paz';

const numeroMonto = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numeroCantidad = new Intl.NumberFormat('es-BO', {
  maximumFractionDigits: 3,
});

const numeroPorcentaje = new Intl.NumberFormat('es-BO', {
  maximumFractionDigits: 1,
});

const fechaHoraLaPaz = new Intl.DateTimeFormat('es-BO', {
  timeZone: ZONA_HORARIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `1250000` → `Bs 1.250.000,00` */
export function formatearMonto(monto: number): string {
  return `Bs ${numeroMonto.format(monto)}`;
}

/** `120.5, 'm²'` → `120,5 m²` (hasta 3 decimales; sin unidad, solo el número) */
export function formatearCantidad(cantidad: number, unidad?: string): string {
  const numero = numeroCantidad.format(cantidad);
  return unidad ? `${numero} ${unidad}` : numero;
}

/** `32.5` (escala 0–100, como `avancePct`) → `32,5 %` */
export function formatearPorcentaje(porcentaje: number): string {
  return `${numeroPorcentaje.format(porcentaje)} %`;
}

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function partesLaPaz(fecha: Date): Record<string, string> {
  const partes: Record<string, string> = {};
  for (const { type, value } of fechaHoraLaPaz.formatToParts(fecha)) partes[type] = value;
  return partes;
}

/**
 * `2026-11-15` → `15/11/2026`. Una fecha sin hora se muestra tal cual (no se corre de día);
 * un instante ISO (`2026-11-15T18:30:00Z`) se muestra en hora de La Paz.
 */
export function formatearFecha(fecha: string | Date): string {
  if (typeof fecha === 'string') {
    const soloFecha = SOLO_FECHA.exec(fecha);
    if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;
  }
  const p = partesLaPaz(new Date(fecha));
  return `${p.day}/${p.month}/${p.year}`;
}

/** `2026-11-15T18:30:00Z` → `15/11/2026 14:30` (hora de La Paz) */
export function formatearFechaHora(fecha: string | Date): string {
  const p = partesLaPaz(new Date(fecha));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
