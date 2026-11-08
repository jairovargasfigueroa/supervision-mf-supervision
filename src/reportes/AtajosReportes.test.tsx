import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AtajosReportes } from './AtajosReportes';
import type { AtajoDisponible } from './reportes.graphql';

afterEach(cleanup);

const ATAJOS: AtajoDisponible[] = [
  { atajo: 'COBROS_VENCIDOS', titulo: 'Cobros vencidos', descripcion: 'Cobros en estado vencido' },
  {
    atajo: 'COBROS_POR_VENCER',
    titulo: 'Cobros que vencen en los próximos 30 días',
    descripcion: 'Pendientes que vencen pronto',
  },
];

describe('AtajosReportes (503, criterio 4)', () => {
  it('muestra un botón por atajo y al pulsarlo pide su reporte', () => {
    const alElegir = vi.fn();
    render(<AtajosReportes atajos={ATAJOS} alElegir={alElegir} />);
    const seccion = within(screen.getByRole('region', { name: 'Reportes comunes' }));
    expect(seccion.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(seccion.getByRole('button', { name: 'Cobros que vencen en los próximos 30 días' }));
    expect(alElegir).toHaveBeenCalledWith('COBROS_POR_VENCER');
  });

  it('mientras se prepara un reporte los botones quedan desactivados', () => {
    render(<AtajosReportes atajos={ATAJOS} ocupado alElegir={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Cobros vencidos' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('sin catálogo avisa «No disponible por el momento»', () => {
    render(<AtajosReportes atajos={undefined} noDisponible alElegir={vi.fn()} />);
    expect(screen.getByText('No disponible por el momento')).toBeTruthy();
  });
});
