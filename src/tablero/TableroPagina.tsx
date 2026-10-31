import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { EstadoError } from '../compartido/EstadoError';
import { formatearCantidad, formatearMonto } from '../nucleo/formato';
import { irAlErp, rutaDetalleObra } from '../nucleo/navegacion';
import { usePuedeVerCobros } from '../nucleo/permisos';
import { tableroVisible, type Dato } from './datos-parciales';
import { TablaObras } from './TablaObras';
import { TarjetaIndicador } from './TarjetaIndicador';
import { useTablero } from './tablero.graphql';

/** Props de una tarjeta a partir de un dato numérico: la cifra, o «—» con su aviso. */
function cifra(dato: Dato<number>) {
  return 'valor' in dato ? { valor: formatearCantidad(dato.valor) } : { valor: null, aviso: dato.aviso };
}

// Tablero de obras (009): indicadores (con «Riesgo alto (modelo)», 402) y la tabla de obras en ejecución; se pide al abrir la pantalla y con
// «Actualizar». Lo que un servicio no entrega se ve como «—» con su aviso y el resto se ve normal (criterio 5).
export function TableroPagina() {
  const consulta = useTablero();
  const { data, error, loading, refetch } = consulta;
  const verCobros = usePuedeVerCobros();
  const tablero = data?.tablero;
  const visible = tablero && tableroVisible(tablero, error, verCobros);

  const actualizar = () => void refetch().catch(() => undefined);

  const contenido = () => {
    // Sin ninguna parte del tablero (gateway caído, sin conexión): estado de error con «Reintentar»
    if (!visible) {
      return error && !loading ? (
        <Paper variant="outlined">
          <EstadoError alReintentar={actualizar} />
        </Paper>
      ) : null;
    }
    const { obrasEnEjecucion, obrasEnRiesgo, materialesBajos, cobrosVencidos, obrasRiesgoAlto, obras } = visible;
    const hay = (dato: Dato<number>) => 'valor' in dato && dato.valor > 0;
    const tarjetas = cobrosVencidos ? 5 : 4;
    return (
      <>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            mb: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: `repeat(${tarjetas}, 1fr)`,
            },
          }}
        >
          <TarjetaIndicador titulo="Obras en ejecución" {...cifra(obrasEnEjecucion)} />
          <TarjetaIndicador
            titulo="Obras en riesgo"
            {...cifra(obrasEnRiesgo)}
            tono={hay(obrasEnRiesgo) ? 'atencion' : undefined}
          />
          <TarjetaIndicador
            titulo="Materiales bajos"
            {...cifra(materialesBajos)}
            tono={hay(materialesBajos) ? 'error' : undefined}
          />
          {cobrosVencidos &&
            ('valor' in cobrosVencidos ? (
              <TarjetaIndicador
                titulo="Cobros vencidos"
                valor={formatearCantidad(cobrosVencidos.valor.cantidad)}
                detalle={formatearMonto(cobrosVencidos.valor.monto)}
                tono={cobrosVencidos.valor.cantidad > 0 ? 'error' : undefined}
              />
            ) : (
              <TarjetaIndicador titulo="Cobros vencidos" valor={null} aviso={cobrosVencidos.aviso} />
            ))}
          {/* 402: obras en nivel ALTO según el modelo; otra señal que «Obras en riesgo» (la regla) */}
          <TarjetaIndicador
            titulo="Riesgo alto (modelo)"
            {...cifra(obrasRiesgoAlto)}
            tono={hay(obrasRiesgoAlto) ? 'error' : undefined}
          />
        </Box>

        <Paper variant="outlined">
          <Typography variant="h2" sx={{ px: 2, pt: 2, pb: 1 }}>
            Obras en ejecución
          </Typography>
          {'valor' in obras ? (
            <>
              {[visible.avisoMaterialesFilas, visible.avisoRiesgoFilas].map(
                (aviso) =>
                  aviso && (
                    <Alert key={aviso} severity="warning" sx={{ mx: 2, mb: 1 }}>
                      {aviso}
                    </Alert>
                  ),
              )}
              <TablaObras
                filas={obras.valor}
                avisoMateriales={visible.avisoMaterialesFilas}
                avisoRiesgo={visible.avisoRiesgoFilas}
                alPulsarObra={(fila) => irAlErp(rutaDetalleObra(fila.obraId))}
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
      </>
    );
  };

  return (
    <Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      >
        <Typography variant="h1">Tablero de obras</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={actualizar} disabled={loading}>
          Actualizar
        </Button>
      </Stack>

      <Box sx={{ height: 4, mb: 2 }}>{loading && <LinearProgress aria-label="Cargando tablero" />}</Box>
      {/* 104: tablero guardado en el equipo con su fecha, o que nunca se abrió en este equipo */}
      {consulta.desdeEquipo && (
        <Box sx={{ mb: 2 }}>
          <AvisoSinConexion consulta={consulta} />
        </Box>
      )}
      {consulta.sinDatosGuardados ? (
        <Paper variant="outlined">
          <AvisoSinConexion consulta={consulta} />
        </Paper>
      ) : (
        contenido()
      )}
    </Box>
  );
}
