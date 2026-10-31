import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { AvisoSinConexion } from '../compartido/AvisoSinConexion';
import { avisoNoDisponible, codigoDeError, MENSAJE_MODELO_NO_DISPONIBLE } from '../nucleo/errores';
import { formatearCantidad, formatearFecha } from '../nucleo/formato';
import { porcentajeRiesgo } from './ChipRiesgo';
import { useModeloRiesgo, type ModeloRiesgo } from './riesgo.graphql';

// Panel «Sobre el modelo» de la pantalla «Riesgo de retraso» (402, criterio 9): versión, fecha de entrenamiento,
// métricas sobre el 20 % de prueba, origen de los datos y el aviso de que es una estimación de apoyo, distinto según
// el modelo se entrenó con datos sintéticos o reales.

export const AVISO_DATOS_SINTETICOS =
  'Modelo entrenado con datos sintéticos; es una estimación de apoyo, no reemplaza la revisión de la obra';

export const AVISO_DATOS_REALES =
  'Modelo entrenado con datos reales; es una estimación de apoyo, no reemplaza la revisión de la obra';

/** Aviso del criterio 9 según el origen de los datos del modelo (`SINTETICOS` o `REALES`). */
export function avisoModelo(datos: string): string {
  return datos === 'REALES' ? AVISO_DATOS_REALES : AVISO_DATOS_SINTETICOS;
}

/** Advertencia del diseño de la 402 («Métricas mínimas»), que se repite en la pantalla. */
export const ADVERTENCIA_METRICAS =
  'Estas métricas muestran que el modelo aprende las relaciones simuladas; no prueban que acierte con obras reales.';

const decimal = (valor: number) => formatearCantidad(Math.round(valor * 100) / 100);

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <>
      <Typography component="dt" sx={{ color: 'text.secondary' }}>
        {etiqueta}
      </Typography>
      <Typography component="dd" sx={{ m: 0, fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
    </>
  );
}

function Contenido({ modelo }: { modelo: ModeloRiesgo }) {
  const { metricas } = modelo;
  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        {avisoModelo(modelo.datos)}
      </Alert>
      <Box
        component="dl"
        sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 0.75, m: 0 }}
      >
        <Dato etiqueta="Versión" valor={modelo.versionModelo} />
        <Dato etiqueta="Entrenado el" valor={formatearFecha(modelo.entrenadoEn)} />
        <Dato
          etiqueta="Origen de los datos"
          valor={`${modelo.datos === 'REALES' ? 'Datos reales' : 'Datos sintéticos'} · ${formatearCantidad(modelo.filasEntrenamiento)} filas de entrenamiento`}
        />
        <Dato
          etiqueta="Niveles"
          valor={`Medio desde ${porcentajeRiesgo(modelo.umbralMedio)} · Alto desde ${porcentajeRiesgo(modelo.umbralAlto)}`}
        />
        <Dato etiqueta="AUC-ROC" valor={`${decimal(metricas.aucRoc)} (regla actual: ${decimal(metricas.aucRocRegla)})`} />
        <Dato etiqueta="Sensibilidad (Medio o más)" valor={decimal(metricas.recallMedio)} />
        <Dato etiqueta="Precisión (Alto)" valor={decimal(metricas.precisionAlto)} />
        <Dato etiqueta="Brier" valor={decimal(metricas.brier)} />
      </Box>
      {/* La advertencia habla de relaciones simuladas: solo vale para el modelo entrenado con datos sintéticos */}
      {modelo.datos !== 'REALES' && (
        <Typography variant="caption" component="p" sx={{ mt: 2, color: 'text.secondary' }}>
          {ADVERTENCIA_METRICAS}
        </Typography>
      )}
    </>
  );
}

export function PanelModelo() {
  const consulta = useModeloRiesgo();
  const { data, error, loading } = consulta;
  const modelo = data?.modeloRiesgo;

  const cuerpo = () => {
    if (consulta.sinDatosGuardados) return <AvisoSinConexion consulta={consulta} />;
    if (modelo) return <Contenido modelo={modelo} />;
    if (loading) return <Typography sx={{ color: 'text.secondary' }}>Cargando…</Typography>;
    if (codigoDeError(error) === 'MODELO_NO_DISPONIBLE') {
      return <Typography sx={{ color: 'text.secondary' }}>{MENSAJE_MODELO_NO_DISPONIBLE}</Typography>;
    }
    // IA no responde (o el campo llegó en null): «—» con su aviso (criterio 12)
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
    <Paper variant="outlined" component="section" aria-label="Sobre el modelo" sx={{ p: 2 }}>
      <Typography variant="h2" sx={{ mb: 1.5 }}>
        Sobre el modelo
      </Typography>
      {consulta.desdeEquipo && (
        <Box sx={{ mb: 2 }}>
          <AvisoSinConexion consulta={consulta} />
        </Box>
      )}
      {cuerpo()}
    </Paper>
  );
}
