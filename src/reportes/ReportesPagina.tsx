import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import AddCommentIcon from '@mui/icons-material/AddCommentOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import {
  codigoDeError,
  esConversacionExpirada,
  esPedidoNoReconocido,
  mensajeErrorReporte,
} from '../nucleo/errores';
import { useSesion } from '../nucleo/sesion';
import { AtajosReportes } from './AtajosReportes';
import { pedidoDelReporte, type Turno } from './conversacion';
import { exportarCsv, exportarExcel } from './exportar';
import { HistorialConsultas } from './HistorialConsultas';
import { PanelPedido } from './PanelPedido';
import { PreguntaAclaracion } from './PreguntaAclaracion';
import {
  CONSULTAR_REPORTE,
  LARGO_MINIMO_PEDIDO,
  LARGO_MINIMO_RESPUESTA,
  TIEMPO_MAXIMO_MS,
  useCatalogoReportes,
  useHistorialConsultas,
  type AtajoReporte,
  type CatalogoReportes,
  type ConsultaReporte,
  type PedidoReporte,
  type VariablesConsultarReporte,
} from './reportes.graphql';
import { ResultadoReporte } from './ResultadoReporte';

// Pantalla «Reportes» (503 y 505): pedir un reporte hablando o escribiendo, o con un reporte común; el asistente
// responde con un reporte (resumen y tabla, exportable) o con una pregunta de aclaración, y la conversación queda
// a la vista (pedidos y respuestas, en orden). El campo del pedido queda debajo de la conversación; «Nueva
// consulta», un reporte común o una consulta del historial empiezan una conversación nueva. Solo `admin` y
// `gerente` (la ruta la protege router.tsx). El catálogo y el historial usan el respaldo sin conexión de la 104; la
// consulta, no.

/** Textos de docs/mensajes.md («Reportes (503)» y 505). */
export const MENSAJE_PREPARANDO = 'Preparando el reporte…';
export const SUGERENCIA_ATAJOS = 'Mientras tanto puedes usar los reportes comunes, que no necesitan interpretar el pedido.';
export const AYUDA_ATAJOS = 'Elige un ejemplo para cambiar tu pedido o usa uno de los reportes comunes.';
export const NUEVA_CONSULTA = 'Nueva consulta';

/** Código propio del límite de 60 s del navegador; se muestra igual que TIEMPO_AGOTADO. */
const TIEMPO_AGOTADO = 'TIEMPO_AGOTADO';

/** Conversación en pantalla: sin `id`, el próximo pedido empieza una nueva en IA. */
interface Conversacion {
  id: string | null;
  turnos: Turno[];
}

const SIN_CONVERSACION: Conversacion = { id: null, turnos: [] };

/** Solo para lectores de pantalla: se anuncia sin verse. */
const OCULTO = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/** «No encontré un reporte para tu pedido» con los conjuntos, sus ejemplos y los reportes comunes (criterio 6). */
function AyudaCatalogo({
  catalogo,
  alElegirEjemplo,
}: {
  catalogo: CatalogoReportes | undefined;
  alElegirEjemplo: (ejemplo: string) => void;
}) {
  return (
    <Box>
      {catalogo && catalogo.conjuntos.length > 0 && (
        <>
          <Typography variant="h3" sx={{ mt: 2, mb: 1 }}>
            Puedes consultar
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {catalogo.conjuntos.map((c) => (
              <li key={c.conjunto}>
                <Typography component="span" sx={{ fontWeight: 600 }}>
                  {c.titulo}
                </Typography>
                <Typography component="span" sx={{ color: 'text.secondary' }}>
                  {' '}
                  · {c.descripcion}
                </Typography>
                {c.ejemplos.length > 0 && (
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {c.ejemplos.map((e) => (
                      <li key={e}>
                        <Link component="button" type="button" onClick={() => alElegirEjemplo(e)} sx={{ textAlign: 'left' }}>
                          {e}
                        </Link>
                      </li>
                    ))}
                  </Box>
                )}
              </li>
            ))}
          </Box>
        </>
      )}
      <Typography sx={{ mt: 2, color: 'text.secondary' }}>{AYUDA_ATAJOS}</Typography>
    </Box>
  );
}

/** Lo que se anuncia a los lectores de pantalla cuando llega una respuesta (los errores ya se anuncian solos). */
function anuncio(turno: Turno | undefined): string {
  if (turno?.rol !== 'asistente') return '';
  if (turno.tipo === 'reporte') {
    const { tituloConjunto, totalFilas } = turno.consulta;
    return `${tituloConjunto} · ${totalFilas === 1 ? '1 fila' : `${totalFilas} filas`}`;
  }
  if (turno.tipo === 'aclaracion') return turno.aclaracion.pregunta;
  return '';
}

/**
 * El foco no está en algo con lo que el usuario siga trabajando: en el cuerpo, en un botón que se desactivó o en
 * una respuesta anterior de la conversación (la opción pulsada o la respuesta que recibió el foco antes).
 */
function focoPerdido(respuesta: HTMLElement): boolean {
  const raiz = respuesta.getRootNode() as Document | ShadowRoot;
  const activo = raiz.activeElement as HTMLElement | null;
  if (!activo || activo === respuesta.ownerDocument.body) return true;
  return (activo as HTMLButtonElement).disabled === true || !!respuesta.parentElement?.contains(activo);
}

export function ReportesPagina() {
  const sesion = useSesion();
  const catalogo = useCatalogoReportes();
  const historial = useHistorialConsultas();
  const datosCatalogo = catalogo.data?.catalogoReportes;
  const atajos = datosCatalogo?.atajos;
  const [texto, setTexto] = useState('');
  const [conversacion, setConversacion] = useState<Conversacion>(SIN_CONVERSACION);
  const [preparando, setPreparando] = useState(false);
  /** «La conversación expiró: vuelve a hacer el pedido» (505, criterio 8). */
  const [aviso, setAviso] = useState<string | null>(null);
  const [mutar] = useMutation(CONSULTAR_REPORTE);
  const ultimoPedido = useRef(0);
  const siguienteTurno = useRef(0);
  const ultimaRespuesta = useRef<HTMLLIElement>(null);

  const { turnos } = conversacion;
  const ultimoTurno = turnos.at(-1);

  // Al llegar una respuesta se la lleva a la vista; si el foco se perdió (el botón pulsado se desactivó), pasa a
  // la respuesta para seguir con el teclado desde ahí
  const idUltimaRespuesta = ultimoTurno?.rol === 'asistente' ? ultimoTurno.id : undefined;
  useEffect(() => {
    const elemento = ultimaRespuesta.current;
    if (idUltimaRespuesta === undefined || !elemento) return;
    elemento.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    if (focoPerdido(elemento)) elemento.focus({ preventScroll: true });
  }, [idUltimaRespuesta]);

  const tituloAtajo = (atajo: AtajoReporte) => atajos?.find((a) => a.atajo === atajo)?.titulo ?? atajo;

  /**
   * Envía un turno. `nueva`: empieza una conversación (reportes comunes, historial o sin conversación abierta);
   * si no, continúa la actual con su `conversacionId` (505, criterios 5 y 6).
   */
  const consultar = async (pedido: PedidoReporte, nueva: boolean) => {
    const numero = ++ultimoPedido.current;
    const conversacionId = !nueva && 'texto' in pedido ? conversacion.id : null;
    const turnoUsuario: Turno = {
      id: ++siguienteTurno.current,
      rol: 'usuario',
      texto: 'texto' in pedido ? pedido.texto : tituloAtajo(pedido.atajo),
    };
    const enviados = [...(conversacionId ? conversacion.turnos : []), turnoUsuario];
    setConversacion({ id: conversacionId, turnos: enviados });
    setAviso(null);
    setPreparando(true);
    setTexto('');

    const responder = (turno: Turno, id: string | null) =>
      setConversacion((actual) => ({ id, turnos: [...actual.turnos, turno] }));
    const variables: VariablesConsultarReporte = conversacionId ? { ...pedido, conversacionId } : pedido;

    let reloj: ReturnType<typeof setTimeout> | undefined;
    // Todo el proceso tarda como máximo 60 s (503, criterio 11): pasado ese tiempo se avisa y se ignora la respuesta
    const limite = new Promise<never>((_, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error(TIEMPO_AGOTADO)), TIEMPO_MAXIMO_MS);
    });
    try {
      const respuesta = await Promise.race([mutar({ variables }), limite]);
      if (numero !== ultimoPedido.current) return;
      const r = respuesta.data?.consultarReporte;
      const id = ++siguienteTurno.current;
      if (r?.tipo === 'REPORTE' && r.consulta) {
        responder({ id, rol: 'asistente', tipo: 'reporte', consulta: r.consulta, pedido: pedidoDelReporte(enviados) }, r.conversacionId);
      } else if (r?.tipo === 'ACLARACION' && r.aclaracion) {
        responder({ id, rol: 'asistente', tipo: 'aclaracion', aclaracion: r.aclaracion }, r.conversacionId);
      } else {
        responder({ id, rol: 'asistente', tipo: 'error' }, r?.conversacionId ?? conversacionId);
      }
    } catch (error) {
      if (numero !== ultimoPedido.current) return;
      const local = error instanceof Error && error.message === TIEMPO_AGOTADO;
      const codigo = local ? TIEMPO_AGOTADO : codigoDeError(error);
      if (esConversacionExpirada(codigo)) {
        // La conversación ya no existe en IA: se empieza una nueva (505, criterio 8)
        setConversacion(SIN_CONVERSACION);
        setAviso(mensajeErrorReporte(error, codigo));
      } else {
        responder({ id: ++siguienteTurno.current, rol: 'asistente', tipo: 'error', codigo, error }, conversacionId);
      }
      // El texto vuelve al cuadro para reintentarlo o corregirlo, si no se escribió otro mientras tanto
      if ('texto' in pedido) setTexto((actual) => actual || pedido.texto);
    } finally {
      clearTimeout(reloj);
      if (numero === ultimoPedido.current) setPreparando(false);
    }
    // IA guarda también las no reconocidas y las fallidas (503, criterio 15)
    void historial.refetch().catch(() => undefined);
  };

  const nuevaConsulta = () => {
    ++ultimoPedido.current;
    setConversacion(SIN_CONVERSACION);
    setAviso(null);
    setPreparando(false);
  };

  const conConversacion = conversacion.id !== null;
  const hayAlgo = turnos.length > 0 || aviso !== null;
  const sinCatalogo = !!catalogo.error || catalogo.sinDatosGuardados;

  const reportesComunes = (
    <AtajosReportes
      atajos={atajos}
      noDisponible={sinCatalogo}
      ocupado={preparando}
      alElegir={(atajo) => void consultar({ atajo }, true)}
    />
  );

  const respuestaError = (turno: Extract<Turno, { tipo: 'error' }>, ultimo: boolean): ReactNode => {
    const { codigo } = turno;
    const mensaje = mensajeErrorReporte(turno.error, codigo);
    if (esPedidoNoReconocido(codigo)) {
      return (
        <Box>
          <Alert severity="info">{mensaje}</Alert>
          {ultimo && <AyudaCatalogo catalogo={datosCatalogo} alElegirEjemplo={setTexto} />}
        </Box>
      );
    }
    return (
      <Box>
        <Alert severity="error">{mensaje}</Alert>
        {ultimo && codigo === 'LLM_NO_DISPONIBLE' && (
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>{SUGERENCIA_ATAJOS}</Typography>
        )}
      </Box>
    );
  };

  const respuestaReporte = (consulta: ConsultaReporte, pedido: string): ReactNode => {
    const contexto = { pedido, usuario: sesion?.usuario.nombre ?? '' };
    return (
      <ResultadoReporte
        consulta={consulta}
        pedido={pedido}
        acciones={
          <>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => void exportarExcel(consulta, contexto)}>
              Exportar a Excel
            </Button>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => void exportarCsv(consulta)}>
              Exportar a CSV
            </Button>
          </>
        }
      />
    );
  };

  const turnoEnPantalla = (turno: Turno, ultimo: boolean): ReactNode => {
    if (turno.rol === 'usuario') {
      return (
        <Box component="section" aria-label="Pedido" sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Box
            sx={{
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              px: 2,
              py: 1,
              maxWidth: { xs: '100%', sm: '80%' },
            }}
          >
            <Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{turno.texto}</Typography>
          </Box>
        </Box>
      );
    }
    if (turno.tipo === 'reporte') return respuestaReporte(turno.consulta, turno.pedido);
    if (turno.tipo === 'aclaracion') {
      return (
        <PreguntaAclaracion
          aclaracion={turno.aclaracion}
          activa={ultimo && !preparando}
          alElegir={(opcion) => void consultar({ texto: opcion }, false)}
        />
      );
    }
    return respuestaError(turno, ultimo);
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 2 }}>
        Reportes
      </Typography>
      {(catalogo.desdeEquipo || historial.desdeEquipo) && (
        <Box sx={{ mb: 2 }}>
          <AvisoSinConexion consulta={catalogo.desdeEquipo ? catalogo : historial} />
        </Box>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '8fr 4fr' }, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          {hayAlgo && (
            <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
              {aviso && (
                <Alert severity="warning" sx={{ mb: turnos.length > 0 ? 2 : 0 }}>
                  {aviso}
                </Alert>
              )}
              {turnos.length > 0 && (
                <Box component="ol" aria-label="Conversación" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, minWidth: 0 }}>
                  {turnos.map((turno, i) => {
                    const ultimo = i === turnos.length - 1;
                    const respuesta = turno.rol === 'asistente';
                    return (
                      <Box
                        component="li"
                        key={turno.id}
                        ref={respuesta && ultimo ? ultimaRespuesta : undefined}
                        tabIndex={respuesta && ultimo ? -1 : undefined}
                        sx={{ minWidth: 0, scrollMarginTop: 16 }}
                      >
                        {turnoEnPantalla(turno, ultimo)}
                      </Box>
                    );
                  })}
                </Box>
              )}
              {preparando && (
                <Box role="status" sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary', mb: 1 }}>{MENSAJE_PREPARANDO}</Typography>
                  <LinearProgress aria-label={MENSAJE_PREPARANDO} sx={{ maxWidth: 320, mx: 'auto' }} />
                </Box>
              )}
              <Box aria-live="polite" sx={OCULTO}>
                {preparando ? '' : anuncio(ultimoTurno)}
              </Box>
            </Paper>
          )}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <PanelPedido
              texto={texto}
              onCambio={setTexto}
              alConsultar={(t) => void consultar({ texto: t }, !conConversacion)}
              ocupado={preparando}
              minimo={conConversacion ? LARGO_MINIMO_RESPUESTA : LARGO_MINIMO_PEDIDO}
              acciones={
                hayAlgo && (
                  <Button variant="outlined" startIcon={<AddCommentIcon />} disabled={preparando} onClick={nuevaConsulta} sx={{ minHeight: 44 }}>
                    {NUEVA_CONSULTA}
                  </Button>
                )
              }
            />
            <Box sx={{ mt: 2 }}>{reportesComunes}</Box>
          </Paper>
        </Box>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <HistorialConsultas
            consultas={historial.data?.consultasReporte}
            tituloAtajo={tituloAtajo}
            noDisponible={!!historial.error || historial.sinDatosGuardados}
            ocupado={preparando}
            alElegir={(pedido) => void consultar(pedido, true)}
          />
        </Paper>
      </Box>
    </Box>
  );
}
