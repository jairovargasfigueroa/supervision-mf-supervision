import { describe, expect, it } from 'vitest';
import {
  formatearCantidad,
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearPorcentaje,
} from './formato';

describe('formato', () => {
  it('formatea montos en bolivianos con 2 decimales', () => {
    expect(formatearMonto(1250000)).toBe('Bs 1.250.000,00');
    expect(formatearMonto(1250)).toBe('Bs 1.250,00');
    expect(formatearMonto(41881.8)).toBe('Bs 41.881,80');
    expect(formatearMonto(0)).toBe('Bs 0,00');
  });

  it('formatea cantidades con hasta 3 decimales y la unidad', () => {
    expect(formatearCantidad(120.5, 'm²')).toBe('120,5 m²');
    expect(formatearCantidad(1234.5678, 'kg')).toBe('1.234,568 kg');
    expect(formatearCantidad(300, 'm³')).toBe('300 m³');
    expect(formatearCantidad(12.25)).toBe('12,25');
  });

  it('formatea porcentajes con espacio antes del signo', () => {
    expect(formatearPorcentaje(32.5)).toBe('32,5 %');
    expect(formatearPorcentaje(41)).toBe('41 %');
    expect(formatearPorcentaje(35.29)).toBe('35,3 %');
  });

  it('formatea fechas sin hora sin correrlas de día', () => {
    expect(formatearFecha('2026-11-15')).toBe('15/11/2026');
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
  });

  it('formatea instantes en hora de La Paz', () => {
    // 02:00 UTC del 16 son las 22:00 del 15 en La Paz (UTC-4)
    expect(formatearFecha('2026-11-16T02:00:00Z')).toBe('15/11/2026');
    expect(formatearFechaHora('2026-11-15T18:30:00Z')).toBe('15/11/2026 14:30');
    expect(formatearFechaHora(new Date('2026-11-16T03:05:00Z'))).toBe('15/11/2026 23:05');
  });

  it('no usa espacios duros ni comas entre fecha y hora', () => {
    expect(formatearMonto(1250000)).not.toMatch(/ /);
    expect(formatearPorcentaje(32.5)).not.toMatch(/ /);
    expect(formatearFechaHora('2026-11-15T18:30:00Z')).not.toContain(',');
  });
});
