import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { SortingState } from '@tanstack/react-table';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { EstadoError } from '../compartido/EstadoError';
import { EstadoVacio } from '../compartido/EstadoVacio';
import { ayudanteColumnas, TablaDatos } from '../compartido/TablaDatos';
import { avisoNoDisponible } from '../nucleo/errores';
import { formatearFechaHora } from '../nucleo/formato';
import { usePuedeVerCobros } from '../nucleo/permisos';
import { tableroVisible } from '../tablero/datos-parciales';
import { useTablero, type FilaTablero } from '../tablero/tablero.graphql';
import { ChipRiesgo, ordenRiesgo } from './ChipRiesgo';
import { GraficoHistorial } from './GraficoHistorial';
import { PanelModelo } from './PanelModelo';
import { useHistorialRiesgo } from './riesgo.graphql';

// Pantalla «Riesgo de retraso» (402, criterios 8 y 9): las obras del tablero ordenadas de mayor a menor
// probabilidad con nivel, factores y fecha de cálculo; al elegir una, su historial en un gráfico; y el panel
// «Sobre el modelo». Si IA no responde, el riesgo se ve «—» con «Datos de IA no disponibles» (criterio 12).

export const ORDEN_RIESGO: SortingState = [{ id: 'riesgo', desc: true }];

const columna = ayudanteColumnas<FilaTablero>();

function Factores({ fila }: { fila: FilaTablero }) {
  const factores = fila.riesgoRetraso?.nivel === 'SIN_DATOS' ? [] : (fila.riesgoRetraso?.factores ?? []);
  if (factores.length === 0) {
    return (
      <Typography component="span" sx={{ color: 'text.secondary' }}>
        —
      </Typography>
    );
  }
  return (
    <Box component="ul" sx={{ m: 0, pl: 2 }}>
      {factores.map((factor) => (
        <li key={factor.variable}>{factor.descripcion}</li>
      ))}
    </Box>
  );
}

function HistorialObra({ fila, aviso }: { fila: FilaTablero; aviso?: string }) {
  const consulta = useHistorialRiesgo(fila.obraId);
  const { data, loading } = consulta;
  const historial = data?.obra?.historialRiesgo;

  const grafico = () => {
    if (consulta.sinDatosGuardados) return <AvisoSinConexion consulta={consulta} />;
    if (historial) return <GraficoHistorial historial={historial} obra={fila.nombre} />;
    if (loading) return <Typography sx={{ color: 'text.secondary' }}>Cargando historial…</Typography>;
    return (
      <Box role="status">
        <Typography sx={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1.3 }}>—</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {avisoNoDisponible('ia')}
        </Typography>
      </Box>
    );
  };

  return (
    <Paper variant="outlined" component="section" aria-label={`Riesgo de ${fila.nombre}`} sx={{ p: 2 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>
        {fila.nombre}
      </Typography>
      <Box sx={{ mb: 1.5 }}>
        <ChipRiesgo riesgo={fila.riesgoRetraso} aviso={aviso} />
      </Box>
      <Factores fila={fila} />
      <Typography variant="caption" component="h3" sx={{ display: 'block', mt: 2, mb: 0.5, fontWeight: 600 }}>
        Historial de la probabilidad
      </Typography>
      {consulta.desdeEquipo && <AvisoSinConexion consulta={consulta} />}
      {grafico()}
    </Paper>
  );
}

export function RiesgoPagina() {
  const consulta = useTablero();
  const { data, error, loading, refetch } = consulta;
  const verCobros = usePuedeVerCobros();
  const tablero = data?.tablero;
  const visible = tablero && tableroVisible(tablero, error, verCobros);
  const avisoRiesgo = visible?.avisoRiesgoFilas;
  const [elegida, setElegida] = useState<string>();

  const columnas = useMemo(
    () => [
      columna.accessor('nombre', {
        header: 'Obra',
        sortFn: 'text',
        cell: ({ getValue }) => <Typography sx={{ fontWeight: 500 }}>{getValue()}</Typography>,
      }),
      columna.accessor((f) => ordenRiesgo(f.riesgoRetraso), {
        id: 'riesgo',
        header: 'Riesgo (modelo)',
        sortFn: 'basic',
        cell: ({ row: { original: f } }) => <ChipRiesgo riesgo={f.riesgoRetraso} aviso={avisoRiesgo} />,
      }),
      columna.display({
        id: 'factores',
        header: 'Factores',
        cell: ({ row: { original: f } }) => <Factores fila={f} />,
      }),
      columna.accessor((f) => f.riesgoRetraso?.calculadaEn ?? '', {
        id: 'calculadaEn',
        header: 'Calculado',
        sortFn: 'alphanumeric',
        cell: ({ getValue }) => (getValue() ? formatearFechaHora(getValue()) : '—'),
      }),
    ],
    [avisoRiesgo],
  );

  const contenido = () => {
    if (consulta.sinDatosGuardados) {
      return (
        <Paper variant="outlined">
          <AvisoSinConexion consulta={consulta} />
        </Paper>
      );
    }
    if (!visible) {
      return error && !loading ? (
        <Paper variant="outlined">
          <EstadoError alReintentar={() => void refetch().catch(() => undefined)} />
        </Paper>
      ) : null;
    }
    const { obras } = visible;
    const fila = 'valor' in obras ? obras.valor.find((f) => f.obraId === elegida) : undefined;
    return (
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, alignItems: 'start' }}>
        <Paper variant="outlined">
          <Typography variant="h2" sx={{ px: 2, pt: 2, pb: 1 }}>
            Obras en ejecución
          </Typography>
          {'valor' in obras ? (
            <>
              {avisoRiesgo && (
                <Alert severity="warning" sx={{ mx: 2, mb: 1 }}>
                  {avisoRiesgo}
                </Alert>
              )}
              <TablaDatos
                etiqueta="Riesgo de retraso por obra"
                columnas={columnas}
                filas={obras.valor}
                idFila={(f) => f.obraId}
                ordenInicial={ORDEN_RIESGO}
                alPulsarFila={(f) => setElegida(f.obraId)}
                etiquetaFila={(f) => `Ver el historial de ${f.nombre}`}
                vacio={<EstadoVacio texto="Aún no hay obras en ejecución." />}
              />
            </>
          ) : (
            <Box role="status" sx={{ px: 2, pb: 3 }}>
              <Typography sx={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1.3 }}>—</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {obras.aviso}
              </Typography>
            </Box>
          )}
        </Paper>
        <Box sx={{ display: 'grid', gap: 2 }}>
          {fila ? (
            <HistorialObra key={fila.obraId} fila={fila} aviso={avisoRiesgo} />
          ) : (
            <Paper variant="outlined">
              <EstadoVacio texto="Elige una obra para ver su historial." />
            </Paper>
          )}
          <PanelModelo />
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 2 }}>
        Riesgo de retraso
      </Typography>
      <Box sx={{ height: 4, mb: 2 }}>{loading && <LinearProgress aria-label="Cargando obras" />}</Box>
      {consulta.desdeEquipo && (
        <Box sx={{ mb: 2 }}>
          <AvisoSinConexion consulta={consulta} />
        </Box>
      )}
      {contenido()}
    </Box>
  );
}
