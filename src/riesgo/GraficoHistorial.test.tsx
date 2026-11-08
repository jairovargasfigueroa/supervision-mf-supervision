import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GraficoHistorial, puntosGrafico } from './GraficoHistorial';
import type { PuntoRiesgo } from './riesgo.graphql';

afterEach(cleanup);

const punto = (dia: number, probabilidad: number): PuntoRiesgo => ({
  probabilidad,
  calculadaEn: new Date(Date.UTC(2026, 9, dia, 5)).toISOString(),
});

const TREINTA = Array.from({ length: 30 }, (_, i) => punto(i + 1, (i + 1) / 40));

describe('GraficoHistorial (402, criterio 8)', () => {
  it('puntosGrafico: un punto queda al centro; varios, de izquierda a derecha y más arriba cuanto más riesgo', () => {
    const [unico] = puntosGrafico([punto(1, 0.5)]);
    expect(unico.x).toBe(44 + (600 - 44 - 16) / 2);
    expect(unico.etiqueta).toBe('01/10/2026: 50 %');

    const puntos = puntosGrafico(TREINTA);
    expect(puntos).toHaveLength(30);
    expect(puntos[0].x).toBe(44);
    expect(puntos[29].x).toBe(600 - 16);
    expect(puntos[29].y).toBeLessThan(puntos[0].y);
    expect(puntosGrafico([punto(1, 0)])[0].y).toBe(200 - 28);
    expect(puntosGrafico([punto(1, 1)])[0].y).toBe(12);
  });

  it('con 1 punto dibuja solo el punto, sin línea', () => {
    const { container } = render(<GraficoHistorial historial={[punto(15, 0.72)]} obra="Condominio Las Lomas" />);
    expect(screen.getByRole('img', { name: 'Historial del riesgo de Condominio Las Lomas: 1 cálculo' })).toBeTruthy();
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.querySelector('circle title')?.textContent).toBe('15/10/2026: 72 %');
  });

  it('con 30 puntos dibuja la línea, los 30 puntos, los umbrales y las fechas de los extremos', () => {
    const { container } = render(<GraficoHistorial historial={TREINTA} obra="Edificio Las Palmeras" />);
    expect(screen.getByRole('img', { name: 'Historial del riesgo de Edificio Las Palmeras: 30 cálculos' })).toBeTruthy();
    expect(container.querySelectorAll('circle')).toHaveLength(30);
    expect(container.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(30);
    const textos = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(textos).toEqual(expect.arrayContaining(['0 %', '30 %', '60 %', '100 %', '01/10/2026', '30/10/2026']));
    expect(container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(2);
  });

  it('sin cálculos lo dice', () => {
    render(<GraficoHistorial historial={[]} obra="X" />);
    expect(screen.getByText('Todavía no hay cálculos del riesgo de esta obra.')).toBeTruthy();
  });
});
