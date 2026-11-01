import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { EstadoChip } from '../compartido/EstadoChip';
import { codigoDeError, mensajeDeError } from '../nucleo/errores';
import { formatearFechaHora } from '../nucleo/formato';
import {
  ESTADO_EJECUCION,
  ESTADO_EJECUCION_AGENTE,
  EJECUTAR_AGENTE,
  INTERVALO_SEGUIMIENTO_MS,
  ORIGEN_EJECUCION,
  SEGUIMIENTO_MAXIMO_MS,
  type AgenteInfo,
} from './agentes.graphql';

// Tarjetas de los agentes (502, criterios 2, 3 y 16): misión, última ejecución con su estado, sugerencias
// pendientes y «Ejecutar ahora» (solo `admin` y `gerente`). Tras ejecutar, la ejecución se consulta cada 3 s hasta
// que deja `EN_CURSO` (máximo 5 minutos) y se muestra «En curso…».

/** Consulta una ejecución en curso hasta que termina o pasan 5 minutos. No dibuja nada. */
function SeguirEjecucion({ id, alTerminar, alVencer }: { id: string; alTerminar: () => void; alVencer: () => void }) {
  const { data } = useQuery(ESTADO_EJECUCION_AGENTE, {
    variables: { id },
    fetchPolicy: 'network-only',
    pollInterval: INTERVALO_SEGUIMIENTO_MS,
  });
  const estado = data?.ejecucionAgente?.estado;
  const avisos = useRef({ alTerminar, alVencer });
  avisos.current = { alTerminar, alVencer };

  useEffect(() => {
    if (estado && estado !== 'EN_CURSO') avisos.current.alTerminar();
  }, [estado]);

  // El límite de 5 minutos corre desde que se empezó a seguir (no se reinicia con cada consulta)
  useEffect(() => {
    const reloj = setTimeout(() => avisos.current.alVencer(), SEGUIMIENTO_MAXIMO_MS);
    return () => clearTimeout(reloj);
  }, []);

  return null;
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);

interface PropsTarjeta {
  info: AgenteInfo;
  puedeEjecutar: boolean;
  /** Vuelve a pedir las tarjetas y las listas (al terminar una ejecución o al decidir). */
  alActualizar: () => void;
}

function TarjetaAgente({ info, puedeEjecutar, alActualizar }: PropsTarjeta) {
  const [ejecutar, { loading: pidiendo }] = useMutation(EJECUTAR_AGENTE);
  const [siguiendo, setSiguiendo] = useState<string>();
  const [vencidas, setVencidas] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string>();
  const ultima = info.ultimaEjecucion;

  // También se sigue una ejecución que ya estaba en curso al abrir la vista (por ejemplo, la programada)
  const enCursoListada = ultima?.estado === 'EN_CURSO' && puedeEjecutar && !vencidas.includes(ultima.id) ? ultima.id : undefined;
  const seguida = siguiendo ?? enCursoListada;
  const enCurso = !!seguida || ultima?.estado === 'EN_CURSO';
  const vencida = !seguida && !!ultima && ultima.estado === 'EN_CURSO' && vencidas.includes(ultima.id);

  const pedirEjecucion = async () => {
    setAviso(undefined);
    try {
      const { data } = await ejecutar({ variables: { agente: info.agente } });
      if (data) setSiguiendo(data.ejecutarAgente.id);
    } catch (error) {
      setAviso(mensajeDeError(error));
      if (codigoDeError(error) === 'EJECUCION_EN_CURSO') alActualizar();
    }
  };

  return (
    <Paper variant="outlined" component="section" aria-label={info.nombre} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="h2">{info.nombre}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {info.mision}
      </Typography>
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'text.secondary' }}>
          Última ejecución
        </Typography>
        {enCurso ? (
          <EstadoChip etiqueta={ESTADO_EJECUCION.EN_CURSO.etiqueta} tono={ESTADO_EJECUCION.EN_CURSO.tono} />
        ) : ultima ? (
          <EstadoChip etiqueta={ESTADO_EJECUCION[ultima.estado].etiqueta} tono={ESTADO_EJECUCION[ultima.estado].tono} />
        ) : (
          <Typography variant="body2">Sin ejecuciones todavía</Typography>
        )}
        {ultima && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {formatearFechaHora(ultima.iniciadaEn)} · {ORIGEN_EJECUCION[ultima.origen]}
            {ultima.estado === 'TERMINADA' && ` · ${plural(ultima.cantidadHallazgos, 'hallazgo', 'hallazgos')}`}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontWeight: 600, color: info.sugerenciasPendientes > 0 ? 'warning.main' : 'text.secondary' }}>
        {plural(info.sugerenciasPendientes, 'sugerencia pendiente', 'sugerencias pendientes')}
      </Typography>
      {aviso && (
        <Alert severity="warning" sx={{ py: 0 }}>
          {aviso}
        </Alert>
      )}
      {vencida && (
        <Button size="small" onClick={alActualizar} sx={{ alignSelf: 'flex-start' }}>
          Actualizar
        </Button>
      )}
      {puedeEjecutar && (
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          disabled={enCurso || pidiendo}
          onClick={() => void pedirEjecucion()}
          sx={{ mt: 'auto', alignSelf: 'flex-start' }}
        >
          Ejecutar ahora
        </Button>
      )}
      {seguida && (
        <SeguirEjecucion
          key={seguida}
          id={seguida}
          alTerminar={() => {
            setSiguiendo(undefined);
            alActualizar();
          }}
          alVencer={() => {
            setSiguiendo(undefined);
            setVencidas((v) => [...v, seguida]);
          }}
        />
      )}
    </Paper>
  );
}

interface Props {
  agentes: AgenteInfo[];
  puedeEjecutar: boolean;
  alActualizar: () => void;
}

export function TarjetasAgentes({ agentes, puedeEjecutar, alActualizar }: Props) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
      {agentes.map((a) => (
        <TarjetaAgente key={a.agente} info={a} puedeEjecutar={puedeEjecutar} alActualizar={alActualizar} />
      ))}
    </Box>
  );
}
