import { useCallback, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { EstadoError } from '../compartido/EstadoError';
import { puedeAdministrarAgentes, useRoles } from '../nucleo/permisos';
import { useAgentes } from './agentes.graphql';
import { HistorialEjecuciones } from './HistorialEjecuciones';
import { ListaSugerencias } from './ListaSugerencias';
import { TarjetasAgentes } from './TarjetasAgentes';

// Vista «Agentes» (502, criterio 16): una tarjeta por agente, las sugerencias para aprobar o rechazar y, para
// `admin` y `gerente`, el historial de ejecuciones con el detalle de sus pasos. Aprobar solo registra la decisión.
// Si IA no responde, cada sección muestra «No disponible por el momento» (criterio 21).

/** Texto de docs/mensajes.md (502, criterio 21). */
export const NO_DISPONIBLE = 'No disponible por el momento';

/** Sección que no llegó: «No disponible por el momento» con «Reintentar». */
export function SeccionNoDisponible({ alReintentar }: { alReintentar: () => void }) {
  return (
    <Paper variant="outlined">
      <EstadoError texto={NO_DISPONIBLE} alReintentar={alReintentar} />
    </Paper>
  );
}

export function AgentesPagina() {
  const administra = puedeAdministrarAgentes(useRoles());
  const agentes = useAgentes();
  const refetchAgentes = agentes.refetch;

  const actualizar = useCallback(() => {
    void refetchAgentes().catch(() => undefined);
  }, [refetchAgentes]);

  const tarjetas = (): ReactNode => {
    if (agentes.sinDatosGuardados) {
      return (
        <Paper variant="outlined">
          <AvisoSinConexion consulta={agentes} />
        </Paper>
      );
    }
    const lista = agentes.data?.agentes;
    if (lista) return <TarjetasAgentes agentes={lista} puedeEjecutar={administra} alActualizar={actualizar} />;
    if (agentes.error) return <SeccionNoDisponible alReintentar={actualizar} />;
    return <LinearProgress aria-label="Cargando agentes" />;
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1 }}>
        Agentes
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 2 }}>
        Revisan cada día las obras, los materiales y los cobros, y sugieren acciones. Ninguna sugerencia se ejecuta sola:
        aprobarla solo registra tu decisión.
      </Typography>
      {agentes.desdeEquipo && (
        <Box sx={{ mb: 2 }}>
          <AvisoSinConexion consulta={agentes} />
        </Box>
      )}
      <Box component="section" aria-label="Agentes disponibles" sx={{ mb: 3 }}>
        {tarjetas()}
      </Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <ListaSugerencias agentes={agentes.data?.agentes} alDecidir={actualizar} />
      </Paper>
      {administra && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <HistorialEjecuciones agentes={agentes.data?.agentes} />
        </Paper>
      )}
    </Box>
  );
}
