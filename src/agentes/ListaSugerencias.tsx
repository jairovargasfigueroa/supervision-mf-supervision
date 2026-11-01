import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { EstadoChip } from '../compartido/EstadoChip';
import { EstadoError } from '../compartido/EstadoError';
import { formatearFechaHora } from '../nucleo/formato';
import {
  ESTADO_SUGERENCIA,
  LIMITE_SUGERENCIAS,
  NOMBRE_AGENTE,
  useHallazgos,
  useSugerencias,
  type Agente,
  type EstadoSugerencia,
  type FiltroSugerencias,
  type Hallazgo,
  type Sugerencia,
} from './agentes.graphql';
import { DialogoDecision, type ModoDecision } from './DialogoDecision';

// Sugerencias de los agentes (502, criterios 10 a 16): filtros por agente y estado (por defecto, pendientes); cada
// una con su obra, la acción, la descripción y el hallazgo que la originó, y «Aprobar» o «Rechazar» si está
// pendiente. La lista solo trae lo que el usuario puede ver (el residente: sus obras y nunca Control de cobros).

const TODOS = 'TODOS';

/** Hallazgos de la misma ejecución y obra que la sugerencia (el contrato no trae el índice del hallazgo). */
export function hallazgosDe(sugerencia: Sugerencia, hallazgos: Hallazgo[] | undefined): Hallazgo[] {
  return (hallazgos ?? []).filter((h) => h.ejecucionId === sugerencia.ejecucionId && h.obraId === sugerencia.obraId);
}

function Decision({ s }: { s: Sugerencia }) {
  if (s.estado === 'PENDIENTE' || !s.decididaEn) return null;
  const quien = s.decididaPor?.nombre;
  const verbo = s.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada';
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {verbo}
      {quien ? ` por ${quien}` : ''} el {formatearFechaHora(s.decididaEn)}
      {s.comentario ? ` · ${s.estado === 'APROBADA' ? 'Comentario' : 'Motivo'}: ${s.comentario}` : ''}
    </Typography>
  );
}

interface Props {
  /** Agentes que ve el usuario (para el filtro). */
  agentes: { agente: Agente; nombre: string }[] | undefined;
  /** Se decidió una sugerencia: hay que actualizar los contadores de las tarjetas. */
  alDecidir: () => void;
}

export function ListaSugerencias({ agentes, alDecidir }: Props) {
  const [agente, setAgente] = useState<Agente | typeof TODOS>(TODOS);
  const [estado, setEstado] = useState<EstadoSugerencia | typeof TODOS>('PENDIENTE');
  const [decidiendo, setDecidiendo] = useState<{ sugerencia: Sugerencia; modo: ModoDecision }>();

  const filtro: FiltroSugerencias = {
    ...(estado !== TODOS && { estado }),
    ...(agente !== TODOS && { agente }),
    limite: LIMITE_SUGERENCIAS,
  };
  const consulta = useSugerencias(filtro);
  const hallazgos = useHallazgos();
  const sugerencias = consulta.data?.sugerencias;
  const nombre = (a: Agente) => agentes?.find((x) => x.agente === a)?.nombre ?? NOMBRE_AGENTE[a];

  const recargar = () => {
    void consulta.refetch().catch(() => undefined);
    void hallazgos.refetch().catch(() => undefined);
  };

  const lista = () => {
    if (consulta.sinDatosGuardados) return <AvisoSinConexion consulta={consulta} />;
    if (!sugerencias) {
      if (consulta.error) return <EstadoError texto="No disponible por el momento" alReintentar={recargar} />;
      return <LinearProgress aria-label="Cargando sugerencias" />;
    }
    if (sugerencias.length === 0) {
      return <Typography sx={{ color: 'text.secondary', py: 2 }}>No hay sugerencias con estos filtros.</Typography>;
    }
    return (
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
        {sugerencias.map((s) => {
          const origen = hallazgosDe(s, hallazgos.data?.hallazgos);
          return (
            <Paper key={s.id} component="li" variant="outlined" aria-label={`Sugerencia para ${s.obraNombre}`} sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600 }}>{s.obraNombre}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  · {nombre(s.agente)} · {formatearFechaHora(s.creadaEn)}
                </Typography>
                <Box sx={{ ml: 'auto' }}>
                  <EstadoChip etiqueta={ESTADO_SUGERENCIA[s.estado].etiqueta} tono={ESTADO_SUGERENCIA[s.estado].tono} />
                </Box>
              </Box>
              <Typography sx={{ mt: 0.5 }}>{s.accionTexto}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {s.descripcion}
              </Typography>
              {origen.map((h, i) => (
                <Typography key={i} variant="body2" sx={{ mt: 0.5 }}>
                  Hallazgo: {h.situacion}
                </Typography>
              ))}
              <Decision s={s} />
              {s.estado === 'PENDIENTE' && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button size="small" variant="contained" onClick={() => setDecidiendo({ sugerencia: s, modo: 'aprobar' })}>
                    Aprobar
                  </Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => setDecidiendo({ sugerencia: s, modo: 'rechazar' })}>
                    Rechazar
                  </Button>
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>
    );
  };

  return (
    <Box component="section" aria-label="Sugerencias">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="h2">Sugerencias</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Agente"
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
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoSugerencia | typeof TODOS)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="PENDIENTE">Pendientes</MenuItem>
            <MenuItem value="APROBADA">Aprobadas</MenuItem>
            <MenuItem value="RECHAZADA">Rechazadas</MenuItem>
            <MenuItem value={TODOS}>Todas</MenuItem>
          </TextField>
        </Box>
      </Box>
      {consulta.desdeEquipo && (
        <Box sx={{ mb: 1 }}>
          <AvisoSinConexion consulta={consulta} />
        </Box>
      )}
      {lista()}
      {decidiendo && (
        <DialogoDecision
          sugerencia={decidiendo.sugerencia}
          modo={decidiendo.modo}
          alCerrar={() => setDecidiendo(undefined)}
          alDecidir={() => {
            recargar();
            alDecidir();
          }}
        />
      )}
    </Box>
  );
}
