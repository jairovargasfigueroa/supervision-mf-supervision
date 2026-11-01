import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { AtajoDisponible, AtajoReporte } from './reportes.graphql';

// Reportes comunes (503, criterio 4): un botón por atajo de `catalogoReportes.atajos`. Al pulsarlo se ejecuta su
// receta fija con `consultarReporte(atajo)`, sin interpretar texto (funciona aunque el modelo de lenguaje no esté).

interface Props {
  atajos: AtajoDisponible[] | undefined;
  /** El catálogo no llegó (IA caída o error). */
  noDisponible?: boolean;
  ocupado?: boolean;
  alElegir: (atajo: AtajoReporte) => void;
}

export function AtajosReportes({ atajos, noDisponible = false, ocupado = false, alElegir }: Props) {
  return (
    <Box component="section" aria-label="Reportes comunes">
      <Typography variant="h2" sx={{ mb: 1 }}>
        Reportes comunes
      </Typography>
      {noDisponible && !atajos ? (
        <Typography sx={{ color: 'text.secondary' }}>No disponible por el momento</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {(atajos ?? []).map((a) => (
            <Tooltip key={a.atajo} title={a.descripcion}>
              <span>
                <Button variant="outlined" size="small" disabled={ocupado} onClick={() => alElegir(a.atajo)}>
                  {a.titulo}
                </Button>
              </span>
            </Tooltip>
          ))}
        </Box>
      )}
    </Box>
  );
}
