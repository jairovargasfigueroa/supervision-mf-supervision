import { useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { codigoDeError, esPedidoNoReconocido, mensajeErrorReporte } from '../nucleo/errores';
import { useSesion } from '../nucleo/sesion';
import { AtajosReportes } from './AtajosReportes';
import { exportarCsv, exportarExcel } from './exportar';
import { HistorialConsultas } from './HistorialConsultas';
import { PanelPedido } from './PanelPedido';
import {
  CONSULTAR_REPORTE,
  TIEMPO_MAXIMO_MS,
  useCatalogoReportes,
  useHistorialConsultas,
  type AtajoReporte,
  type CatalogoReportes,
  type ConsultaReporte,
  type PedidoReporte,
} from './reportes.graphql';
import { ResultadoReporte } from './ResultadoReporte';

// Pantalla «Reportes» (503): pedir un reporte hablando o escribiendo, o con un reporte común; ver el resumen y la
// tabla, exportarlo a Excel o CSV y volver a pedir una de las últimas consultas. Solo `admin` y `gerente` (la ruta
// la protege router.tsx). El catálogo y el historial usan el respaldo sin conexión de la 104; la consulta, no.

/** Textos de docs/mensajes.md («Reportes (503)»). */
export const MENSAJE_PREPARANDO = 'Preparando el reporte…';
export const SUGERENCIA_ATAJOS = 'Mientras tanto puedes usar los reportes comunes, que no necesitan interpretar el pedido.';
export const AYUDA_ATAJOS = 'Elige un ejemplo para cambiar tu pedido o usa uno de los reportes comunes.';

type Estado =
  | { tipo: 'inicial' }
  | { tipo: 'preparando' }
  | { tipo: 'resultado'; consulta: ConsultaReporte; pedido: PedidoReporte }
  | { tipo: 'error'; codigo?: string; error?: unknown };

/** Código propio del límite de 60 s del navegador; se muestra igual que TIEMPO_AGOTADO. */
const TIEMPO_AGOTADO = 'TIEMPO_AGOTADO';

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

export function ReportesPagina() {
  const sesion = useSesion();
  const catalogo = useCatalogoReportes();
  const historial = useHistorialConsultas();
  const datosCatalogo = catalogo.data?.catalogoReportes;
  const atajos = datosCatalogo?.atajos;
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' });
  const [mutar] = useMutation(CONSULTAR_REPORTE);
  const ultimoPedido = useRef(0);

  const tituloAtajo = (atajo: AtajoReporte) => atajos?.find((a) => a.atajo === atajo)?.titulo ?? atajo;

  const consultar = async (pedido: PedidoReporte) => {
    const numero = ++ultimoPedido.current;
    setEstado({ tipo: 'preparando' });
    let reloj: ReturnType<typeof setTimeout> | undefined;
    // Todo el proceso tarda como máximo 60 s (criterio 11): pasado ese tiempo se avisa y se ignora la respuesta
    const limite = new Promise<never>((_, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error(TIEMPO_AGOTADO)), TIEMPO_MAXIMO_MS);
    });
    try {
      const respuesta = await Promise.race([mutar({ variables: pedido }), limite]);
      if (numero !== ultimoPedido.current) return;
      const consulta = respuesta.data?.consultarReporte;
      setEstado(consulta ? { tipo: 'resultado', consulta, pedido } : { tipo: 'error' });
    } catch (error) {
      if (numero !== ultimoPedido.current) return;
      const local = error instanceof Error && error.message === TIEMPO_AGOTADO;
      setEstado({ tipo: 'error', codigo: local ? TIEMPO_AGOTADO : codigoDeError(error), error });
    } finally {
      clearTimeout(reloj);
    }
    // IA guarda también las no reconocidas y las fallidas (criterio 15)
    void historial.refetch().catch(() => undefined);
  };

  const repetir = (pedido: PedidoReporte) => {
    if ('texto' in pedido) setTexto(pedido.texto);
    void consultar(pedido);
  };

  const preparando = estado.tipo === 'preparando';
  const sinCatalogo = !!catalogo.error || catalogo.sinDatosGuardados;

  const reportesComunes = (
    <AtajosReportes atajos={atajos} noDisponible={sinCatalogo} ocupado={preparando} alElegir={(atajo) => void consultar({ atajo })} />
  );

  const contenido = (): ReactNode => {
    if (preparando) {
      return (
        <Box role="status" sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary', mb: 1 }}>{MENSAJE_PREPARANDO}</Typography>
          <LinearProgress aria-label={MENSAJE_PREPARANDO} sx={{ maxWidth: 320, mx: 'auto' }} />
        </Box>
      );
    }
    if (estado.tipo === 'error') {
      const { codigo } = estado;
      const mensaje = mensajeErrorReporte(estado.error, codigo);
      if (esPedidoNoReconocido(codigo)) {
        return (
          <Box>
            <Alert severity="info">{mensaje}</Alert>
            <AyudaCatalogo catalogo={datosCatalogo} alElegirEjemplo={setTexto} />
          </Box>
        );
      }
      return (
        <Box>
          <Alert severity="error">{mensaje}</Alert>
          {codigo === 'LLM_NO_DISPONIBLE' && (
            <Typography sx={{ mt: 2, color: 'text.secondary' }}>{SUGERENCIA_ATAJOS}</Typography>
          )}
        </Box>
      );
    }
    if (estado.tipo === 'resultado') {
      const { consulta, pedido } = estado;
      const textoPedido = 'texto' in pedido ? pedido.texto : tituloAtajo(pedido.atajo);
      const contexto = { pedido: textoPedido, usuario: sesion?.usuario.nombre ?? '' };
      return (
        <ResultadoReporte
          consulta={consulta}
          pedido={textoPedido}
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
    }
    return null;
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
          <Paper variant="outlined" sx={{ p: 2 }}>
            <PanelPedido texto={texto} onCambio={setTexto} alConsultar={(t) => void consultar({ texto: t })} ocupado={preparando} />
            <Box sx={{ mt: 2 }}>{reportesComunes}</Box>
          </Paper>
          {estado.tipo !== 'inicial' && (
            <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
              {contenido()}
            </Paper>
          )}
        </Box>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <HistorialConsultas
            consultas={historial.data?.consultasReporte}
            tituloAtajo={tituloAtajo}
            noDisponible={!!historial.error || historial.sinDatosGuardados}
            ocupado={preparando}
            alElegir={repetir}
          />
        </Paper>
      </Box>
    </Box>
  );
}
