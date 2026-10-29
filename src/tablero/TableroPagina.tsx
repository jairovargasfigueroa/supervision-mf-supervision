import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { EstadoError } from '../compartido/EstadoError';
import { formatearCantidad, formatearMonto } from '../nucleo/formato';
import { usePuedeVerCobros } from '../nucleo/permisos';
import { TablaObras } from './TablaObras';
import { TarjetaIndicador } from './TarjetaIndicador';
import { useTablero } from './tablero.graphql';

const cifra = (valor: number | null | undefined) => (valor == null ? null : formatearCantidad(valor));
const tono = (valor: number | null | undefined) => (valor ? 'error' : undefined);

// Tablero de obras (009): cuatro indicadores y la tabla de obras en ejecución. Cobros vencidos: solo admin y gerente.
export function TableroPagina() {
  const { data, error, loading, refetch } = useTablero();
  const verCobros = usePuedeVerCobros();
  const tablero = data?.tablero;
  const indicadores = tablero?.indicadores;
  const cobros = indicadores?.cobrosVencidos;

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 2 }}>
        Tablero de obras
      </Typography>

      {loading && <LinearProgress aria-label="Cargando tablero" sx={{ mb: 2 }} />}

      {!tablero && error ? (
        <Paper variant="outlined">
          <EstadoError alReintentar={() => void refetch()} />
        </Paper>
      ) : (
        tablero && (
          <>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                mb: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: `repeat(${verCobros ? 4 : 3}, 1fr)` },
              }}
            >
              <TarjetaIndicador titulo="Obras en ejecución" valor={cifra(indicadores?.obrasEnEjecucion)} />
              <TarjetaIndicador
                titulo="Obras en riesgo"
                valor={cifra(indicadores?.obrasEnRiesgo)}
                tono={tono(indicadores?.obrasEnRiesgo) && 'atencion'}
              />
              <TarjetaIndicador
                titulo="Materiales bajos"
                valor={cifra(indicadores?.materialesBajos)}
                tono={tono(indicadores?.materialesBajos)}
              />
              {verCobros && (
                <TarjetaIndicador
                  titulo="Cobros vencidos"
                  valor={cifra(cobros?.cantidad)}
                  detalle={cobros ? formatearMonto(cobros.monto) : undefined}
                  tono={tono(cobros?.cantidad)}
                />
              )}
            </Box>

            <Paper variant="outlined">
              <Typography variant="h2" sx={{ px: 2, pt: 2, pb: 1 }}>
                Obras en ejecución
              </Typography>
              {tablero.obras ? (
                <TablaObras filas={tablero.obras} />
              ) : (
                <Typography sx={{ px: 2, pb: 2 }}>—</Typography>
              )}
            </Paper>
          </>
        )
      )}
    </Box>
  );
}
