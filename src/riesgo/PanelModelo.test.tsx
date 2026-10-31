import { describe, expect, it } from 'vitest';
import { AVISO_DATOS_REALES, AVISO_DATOS_SINTETICOS, avisoModelo } from './PanelModelo';

describe('avisoModelo (402, criterio 9)', () => {
  it('depende del origen de los datos del modelo', () => {
    expect(avisoModelo('SINTETICOS')).toBe(AVISO_DATOS_SINTETICOS);
    expect(AVISO_DATOS_SINTETICOS).toBe(
      'Modelo entrenado con datos sintéticos; es una estimación de apoyo, no reemplaza la revisión de la obra',
    );
    expect(avisoModelo('REALES')).toBe(
      'Modelo entrenado con datos reales; es una estimación de apoyo, no reemplaza la revisión de la obra',
    );
    expect(AVISO_DATOS_REALES).toBe(avisoModelo('REALES'));
  });
});
