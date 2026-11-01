import { useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { codigoDeError, mensajeDeError } from '../nucleo/errores';
import { useSesion } from '../nucleo/sesion';
import { AtajosReportes } from './AtajosReportes';
import { exportarCsv, exportarExcel } from './exportar';
import { PanelPedido } from './PanelPedido';
import {
  CONSULTAR_REPORTE,
  TIEMPO_MAXIMO_MS,
  useCatalogoReportes,
  type AtajoReporte,
  type ConsultaReporte,
} from './reportes.graphql';
import { ResultadoReporte } from './ResultadoReporte';

// Pantalla «Reportes» (503): pedir un reporte hablando o escribiendo, o con un reporte común; ver el resumen y la
// tabla, y exportarlo a Excel o CSV. Solo `admin` y `gerente` (la ruta la protege router.tsx).

/** Textos de docs/mensajes.md («Reportes (503)» y errores de IA). */
export const MENSAJE_PREPARANDO = 'Preparando el reporte…';
export const MENSAJE_TARDO = 'El reporte tardó demasiado; intenta de nuevo';

export type Pedido = { texto: string } | { atajo: AtajoReporte };

type Estado =
  | { tipo: 'inicial' }
  | { tipo: 'preparando' }
  | { tipo: 'resultado'; consulta: ConsultaReporte; pedido: Pedido }
  | { tipo: 'error'; codigo?: string; error?: unknown };

const TIEMPO_AGOTADO_LOCAL = 'TIEMPO_AGOTADO';

export function ReportesPagina() {
  const sesion = useSesion();
  const catalogo = useCatalogoReportes();
  const atajos = catalogo.data?.catalogoReportes.atajos;
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' });
  const [mutar] = useMutation(CONSULTAR_REPORTE);
  const ultimoPedido = useRef(0);

  const tituloAtajo = (atajo: AtajoReporte) => atajos?.find((a) => a.atajo === atajo)?.titulo ?? atajo;

  const consultar = async (pedido: Pedido) => {
    const numero = ++ultimoPedido.current;
    setEstado({ tipo: 'preparando' });
    let reloj: ReturnType<typeof setTimeout> | undefined;
    // Todo el proceso tarda como máximo 60 s (criterio 11): pasado ese tiempo se avisa y se ignora la respuesta
    const limite = new Promise<never>((_, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error(TIEMPO_AGOTADO_LOCAL)), TIEMPO_MAXIMO_MS);
    });
    try {
      const respuesta = await Promise.race([mutar({ variables: pedido }), limite]);
      if (numero !== ultimoPedido.current) return;
      const consulta = respuesta.data?.consultarReporte;
      setEstado(consulta ? { tipo: 'resultado', consulta, pedido } : { tipo: 'error' });
    } catch (error) {
      if (numero !== ultimoPedido.current) return;
      const local = error instanceof Error && error.message === TIEMPO_AGOTADO_LOCAL;
      setEstado({ tipo: 'error', codigo: local ? TIEMPO_AGOTADO_LOCAL : codigoDeError(error), error });
    } finally {
      clearTimeout(reloj);
    }
  };

  const preparando = estado.tipo === 'preparando';

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
      return (
        <Alert severity="error">
          {estado.codigo === TIEMPO_AGOTADO_LOCAL ? MENSAJE_TARDO : mensajeDeError(estado.error)}
        </Alert>
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
      {catalogo.desdeEquipo && (
        <Box sx={{ mb: 2 }}>
          <AvisoSinConexion consulta={catalogo} />
        </Box>
      )}
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <PanelPedido texto={texto} onCambio={setTexto} alConsultar={(t) => void consultar({ texto: t })} ocupado={preparando} />
          <Box sx={{ mt: 2 }}>
            <AtajosReportes
              atajos={atajos}
              noDisponible={!!catalogo.error || catalogo.sinDatosGuardados}
              ocupado={preparando}
              alElegir={(atajo) => void consultar({ atajo })}
            />
          </Box>
        </Paper>
        {estado.tipo !== 'inicial' && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            {contenido()}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
