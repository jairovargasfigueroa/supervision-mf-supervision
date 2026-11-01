import { useMemo, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { EstadoChip } from '../compartido/EstadoChip';
import { EstadoError } from '../compartido/EstadoError';
import { ayudanteColumnas, TablaDatos } from '../compartido/TablaDatos';
import { codigoDeError, mensajeDeError, mensajeErrorEjecucion, mensajeErrorPaso, NOMBRE_SERVICIO, type Servicio } from '../nucleo/errores';
import { formatearCantidad, formatearFechaHora } from '../nucleo/formato';
import {
  ESTADO_EJECUCION,
  NOMBRE_AGENTE,
  ORIGEN_EJECUCION,
  SEVERIDAD,
  textoTipoHallazgo,
  useEjecucion,
  type Hallazgo,
  type PasoEjecucion,
} from './agentes.graphql';

// Detalle de una ejecución (502, criterios 5 a 8 y 16; solo `admin` y `gerente`): proveedor y modelo de lenguaje,
// resumen o error, cada paso con su servidor MCP, herramienta, argumentos (JSON con formato), resultado, hora y
// duración, y los hallazgos con su evidencia. Todo lo que escribió el agente se muestra como texto.

const PROVEEDOR: Record<string, string> = { ollama: 'Ollama', anthropic: 'Anthropic' };

/** `ollama` + `qwen3:8b` → «Ollama · qwen3:8b». */
export function textoModelo(proveedor: string, modelo: string): string {
  return `${PROVEEDOR[proveedor] ?? proveedor} · ${modelo}`;
}

/** Nombre del servidor MCP de un paso: Obras, Materiales, Finanzas o IA. */
export function textoServidor(servidor: string): string {
  return NOMBRE_SERVICIO[servidor as Servicio] ?? servidor;
}

/** Argumentos del paso como JSON con formato (si no es JSON, tal cual). */
export function argumentosConFormato(argumentos: string): string {
  try {
    return JSON.stringify(JSON.parse(argumentos), null, 2);
  } catch {
    return argumentos;
  }
}

const columna = ayudanteColumnas<PasoEjecucion>();

const COLUMNAS_PASOS = [
  columna.accessor('numero', { header: 'N.º', sortFn: 'basic', meta: { numerica: true } }),
  columna.accessor('servidor', { header: 'Servidor', sortFn: 'text', cell: ({ getValue }) => textoServidor(getValue()) }),
  columna.accessor('herramienta', { header: 'Herramienta', sortFn: 'text' }),
  columna.display({
    id: 'argumentos',
    header: 'Argumentos',
    cell: ({ row }) => (
      <Box component="pre" sx={{ m: 0, fontSize: '0.75rem', fontFamily: '"IBM Plex Mono", ui-monospace, monospace', whiteSpace: 'pre-wrap', maxWidth: 280 }}>
        {argumentosConFormato(row.original.argumentos)}
      </Box>
    ),
  }),
  columna.accessor('resultadoResumen', {
    header: 'Resultado',
    enableSorting: false,
    cell: ({ getValue }) => <Box sx={{ maxWidth: 320, overflowWrap: 'anywhere' }}>{getValue()}</Box>,
  }),
  columna.accessor('en', { header: 'Hora', sortFn: 'alphanumeric', cell: ({ getValue }) => formatearFechaHora(getValue()) }),
  columna.accessor('duracionMs', {
    header: 'Duración',
    sortFn: 'basic',
    meta: { numerica: true },
    cell: ({ getValue }) => `${formatearCantidad(getValue())} ms`,
  }),
  columna.accessor((p) => p.error ?? '', {
    id: 'error',
    header: 'Error',
    sortFn: 'text',
    cell: ({ getValue }) => (getValue() ? mensajeErrorPaso(getValue()) : '—'),
  }),
];

function Hallazgos({ hallazgos }: { hallazgos: Hallazgo[] }) {
  if (hallazgos.length === 0) return <Typography sx={{ color: 'text.secondary' }}>Sin hallazgos.</Typography>;
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
      {hallazgos.map((h, i) => (
        <Box component="li" key={i} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 600 }}>{h.obraNombre}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              · {textoTipoHallazgo(h.tipo)}
            </Typography>
            <EstadoChip etiqueta={SEVERIDAD[h.severidad].etiqueta} tono={SEVERIDAD[h.severidad].tono} />
          </Box>
          <Typography sx={{ mt: 0.5 }}>{h.situacion}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Causa probable: {h.causaProbable}
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {h.evidencia.map((e, j) => (
              <li key={j}>
                <Typography variant="body2">
                  {e.herramienta}: {e.dato}
                </Typography>
              </li>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600 }}>
        {etiqueta}
      </Typography>
      <Box sx={{ fontSize: '0.875rem' }}>{children}</Box>
    </Box>
  );
}

export function DetalleEjecucion({ id }: { id: string }) {
  const consulta = useEjecucion(id);
  const ejecucion = consulta.data?.ejecucionAgente;
  const pasos = useMemo(() => ejecucion?.pasos ?? [], [ejecucion]);

  if (consulta.sinDatosGuardados) return <AvisoSinConexion consulta={consulta} />;
  if (!ejecucion) {
    if (consulta.loading) return <LinearProgress aria-label="Cargando la ejecución" />;
    if (consulta.error && codigoDeError(consulta.error) === 'EJECUCION_NO_ENCONTRADA') {
      return <Alert severity="info">{mensajeDeError(consulta.error)}</Alert>;
    }
    return <EstadoError texto="No disponible por el momento" alReintentar={() => void consulta.refetch().catch(() => undefined)} />;
  }

  const estado = ESTADO_EJECUCION[ejecucion.estado];
  return (
    <Box component="section" aria-label="Detalle de la ejecución" sx={{ display: 'grid', gap: 2 }}>
      {consulta.desdeEquipo && <AvisoSinConexion consulta={consulta} />}
      <Typography variant="h3" sx={{ fontSize: '1rem', fontWeight: 600 }}>
        {NOMBRE_AGENTE[ejecucion.agente]} · {formatearFechaHora(ejecucion.iniciadaEn)}
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
        <Dato etiqueta="Estado">
          <EstadoChip etiqueta={estado.etiqueta} tono={estado.tono} />
        </Dato>
        <Dato etiqueta="Origen">
          {ORIGEN_EJECUCION[ejecucion.origen]}
          {ejecucion.solicitadaPor ? ` · ${ejecucion.solicitadaPor.nombre}` : ''}
        </Dato>
        <Dato etiqueta="Terminó">{ejecucion.terminadaEn ? formatearFechaHora(ejecucion.terminadaEn) : '—'}</Dato>
        <Dato etiqueta="Modelo de lenguaje">{textoModelo(ejecucion.proveedorLlm, ejecucion.modelo)}</Dato>
      </Box>
      {ejecucion.error && (
        <Alert severity="error">{mensajeErrorEjecucion(ejecucion.error.codigo, ejecucion.error.mensaje)}</Alert>
      )}
      {ejecucion.resumen && (
        <Dato etiqueta="Resumen">
          <Typography aria-label="Resumen de la ejecución" sx={{ whiteSpace: 'pre-line' }}>
            {ejecucion.resumen}
          </Typography>
        </Dato>
      )}
      <Box>
        <Typography variant="caption" component="h4" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
          Pasos
        </Typography>
        <TablaDatos
          etiqueta="Pasos de la ejecución"
          columnas={COLUMNAS_PASOS}
          filas={pasos}
          idFila={(p) => String(p.numero)}
          ordenInicial={[{ id: 'numero', desc: false }]}
          vacio={<Typography sx={{ color: 'text.secondary', p: 2 }}>Sin pasos registrados.</Typography>}
        />
      </Box>
      <Box>
        <Typography variant="caption" component="h4" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
          Hallazgos
        </Typography>
        <Hallazgos hallazgos={ejecucion.hallazgos} />
      </Box>
    </Box>
  );
}
