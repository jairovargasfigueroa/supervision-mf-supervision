import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { EstadoChip } from '../compartido/EstadoChip';
import { EstadoError } from '../compartido/EstadoError';
import { ayudanteColumnas, TablaDatos } from '../compartido/TablaDatos';
import { formatearFechaHora } from '../nucleo/formato';
import {
  ESTADO_EJECUCION,
  LIMITE_EJECUCIONES,
  NOMBRE_AGENTE,
  ORIGEN_EJECUCION,
  useEjecuciones,
  type Agente,
  type EjecucionCorta,
  type EstadoEjecucion,
  type FiltroEjecuciones,
} from './agentes.graphql';
import { DetalleEjecucion } from './DetalleEjecucion';

// Historial de ejecuciones de los agentes (502, criterio 16; solo `admin` y `gerente`): las últimas 20, con filtros
// por agente y estado; al pulsar una se abre su detalle con los pasos y los hallazgos.

const TODOS = 'TODOS';
const columna = ayudanteColumnas<EjecucionCorta>();

interface Props {
  agentes: { agente: Agente; nombre: string }[] | undefined;
}

export function HistorialEjecuciones({ agentes }: Props) {
  const [agente, setAgente] = useState<Agente | typeof TODOS>(TODOS);
  const [estado, setEstado] = useState<EstadoEjecucion | typeof TODOS>(TODOS);
  const [elegida, setElegida] = useState<string>();
  const filtro: FiltroEjecuciones = {
    ...(agente !== TODOS && { agente }),
    ...(estado !== TODOS && { estado }),
    limite: LIMITE_EJECUCIONES,
  };
  const consulta = useEjecuciones(filtro);
  const nombre = (a: Agente) => agentes?.find((x) => x.agente === a)?.nombre ?? NOMBRE_AGENTE[a];

  const columnas = useMemo(
    () => [
      columna.accessor('agente', { header: 'Agente', sortFn: 'text', cell: ({ getValue }) => nombre(getValue()) }),
      columna.accessor('origen', { header: 'Origen', sortFn: 'text', cell: ({ getValue }) => ORIGEN_EJECUCION[getValue()] }),
      columna.accessor('estado', {
        header: 'Estado',
        sortFn: 'text',
        cell: ({ getValue }) => (
          <EstadoChip etiqueta={ESTADO_EJECUCION[getValue()].etiqueta} tono={ESTADO_EJECUCION[getValue()].tono} />
        ),
      }),
      columna.accessor('iniciadaEn', { header: 'Inició', sortFn: 'alphanumeric', cell: ({ getValue }) => formatearFechaHora(getValue()) }),
      columna.accessor((e) => e.terminadaEn ?? '', {
        id: 'terminadaEn',
        header: 'Terminó',
        sortFn: 'alphanumeric',
        cell: ({ getValue }) => (getValue() ? formatearFechaHora(getValue()) : '—'),
      }),
      columna.accessor('cantidadHallazgos', { header: 'Hallazgos', sortFn: 'basic', meta: { numerica: true } }),
    ],
    [agentes],
  );

  const tabla = () => {
    if (consulta.sinDatosGuardados) return <AvisoSinConexion consulta={consulta} />;
    const lista = consulta.data?.ejecucionesAgente;
    if (!lista) {
      if (consulta.error) {
        return <EstadoError texto="No disponible por el momento" alReintentar={() => void consulta.refetch().catch(() => undefined)} />;
      }
      return <LinearProgress aria-label="Cargando ejecuciones" />;
    }
    return (
      <TablaDatos
        etiqueta="Ejecuciones de los agentes"
        columnas={columnas}
        filas={lista}
        idFila={(e) => e.id}
        alPulsarFila={(e) => setElegida(e.id)}
        etiquetaFila={(e) => `Ver la ejecución de ${nombre(e.agente)} del ${formatearFechaHora(e.iniciadaEn)}`}
        vacio={<Typography sx={{ color: 'text.secondary', p: 2 }}>No hay ejecuciones con estos filtros.</Typography>}
      />
    );
  };

  return (
    <Box component="section" aria-label="Historial de ejecuciones" sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h2">Historial de ejecuciones</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Agente de la ejecución"
            value={agente}
            onChange={(e) => setAgente(e.target.value as Agente | typeof TODOS)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value={TODOS}>Todos</MenuItem>
            {(agentes ?? []).map((a) => (
              <MenuItem key={a.agente} value={a.agente}>
                {a.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Estado de la ejecución"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoEjecucion | typeof TODOS)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={TODOS}>Todos</MenuItem>
            <MenuItem value="EN_CURSO">En curso</MenuItem>
            <MenuItem value="TERMINADA">Terminadas</MenuItem>
            <MenuItem value="FALLIDA">Fallidas</MenuItem>
          </TextField>
        </Box>
      </Box>
      {consulta.desdeEquipo && <AvisoSinConexion consulta={consulta} />}
      {tabla()}
      {elegida && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <DetalleEjecucion key={elegida} id={elegida} />
        </Paper>
      )}
    </Box>
  );
}
