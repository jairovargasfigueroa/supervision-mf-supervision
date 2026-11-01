import { gql, type TypedDocumentNode } from '@apollo/client';
import { useConsultaConRespaldo } from '../nucleo/consulta-respaldo';
import type { TonoEstado } from '../compartido/EstadoChip';

// Operaciones de la vista «Agentes» (502; docs/contratos.md y SDL del diseño de la 502). Todo lo que escribe un
// agente (resumen, situación, causa, descripción, argumentos) es texto: la pantalla lo muestra como texto.

export type Agente = 'SEGUIMIENTO_OBRAS' | 'CONTROL_MATERIALES' | 'CONTROL_COBROS';
export type OrigenEjecucion = 'PROGRAMADA' | 'MANUAL';
export type EstadoEjecucion = 'EN_CURSO' | 'TERMINADA' | 'FALLIDA';
export type EstadoSugerencia = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type Severidad = 'ALTA' | 'MEDIA' | 'BAJA';

export interface UsuarioCorto {
  id: string;
  nombre: string;
}

export interface EjecucionCorta {
  id: string;
  agente: Agente;
  origen: OrigenEjecucion;
  estado: EstadoEjecucion;
  iniciadaEn: string;
  terminadaEn: string | null;
  cantidadHallazgos: number;
}

export interface AgenteInfo {
  agente: Agente;
  nombre: string;
  mision: string;
  herramientas: string[];
  ultimaEjecucion: EjecucionCorta | null;
  sugerenciasPendientes: number;
}

export interface Evidencia {
  herramienta: string;
  dato: string;
}

export interface Hallazgo {
  ejecucionId: string;
  agente: Agente;
  obraId: string;
  obraNombre: string;
  tipo: string;
  severidad: Severidad;
  situacion: string;
  causaProbable: string;
  evidencia: Evidencia[];
  detectadoEn: string;
}

export interface PasoEjecucion {
  numero: number;
  /** `obras`, `materiales`, `finanzas` o `ia`. */
  servidor: string;
  herramienta: string;
  /** JSON en texto. */
  argumentos: string;
  resultadoResumen: string;
  en: string;
  duracionMs: number;
  error: string | null;
}

export interface EjecucionAgente {
  id: string;
  agente: Agente;
  origen: OrigenEjecucion;
  estado: EstadoEjecucion;
  solicitadaPor: UsuarioCorto | null;
  iniciadaEn: string;
  terminadaEn: string | null;
  proveedorLlm: string;
  modelo: string;
  resumen: string | null;
  error: { codigo: string; mensaje: string } | null;
  pasos: PasoEjecucion[];
  hallazgos: Hallazgo[];
}

export interface Sugerencia {
  id: string;
  ejecucionId: string;
  agente: Agente;
  obraId: string;
  obraNombre: string;
  accion: string;
  accionTexto: string;
  descripcion: string;
  estado: EstadoSugerencia;
  creadaEn: string;
  decididaPor: UsuarioCorto | null;
  decididaEn: string | null;
  comentario: string | null;
}

/** «Ejecutar ahora»: se consulta la ejecución cada 3 s, hasta 5 minutos (502, criterio 2). */
export const INTERVALO_SEGUIMIENTO_MS = 3000;
export const SEGUIMIENTO_MAXIMO_MS = 5 * 60_000;

/** Largos de la decisión (502, criterios 12 y 13). */
export const COMENTARIO_MAXIMO = 300;
export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;

export const LIMITE_SUGERENCIAS = 50;
export const LIMITE_EJECUCIONES = 20;

export const NOMBRE_AGENTE: Record<Agente, string> = {
  SEGUIMIENTO_OBRAS: 'Seguimiento de obras',
  CONTROL_MATERIALES: 'Control de materiales',
  CONTROL_COBROS: 'Control de cobros',
};

export const ESTADO_EJECUCION: Record<EstadoEjecucion, { etiqueta: string; tono: TonoEstado }> = {
  EN_CURSO: { etiqueta: 'En curso…', tono: 'atencion' },
  TERMINADA: { etiqueta: 'Terminada', tono: 'exito' },
  FALLIDA: { etiqueta: 'Fallida', tono: 'error' },
};

export const ESTADO_SUGERENCIA: Record<EstadoSugerencia, { etiqueta: string; tono: TonoEstado }> = {
  PENDIENTE: { etiqueta: 'Pendiente', tono: 'atencion' },
  APROBADA: { etiqueta: 'Aprobada', tono: 'exito' },
  RECHAZADA: { etiqueta: 'Rechazada', tono: 'neutro' },
};

export const SEVERIDAD: Record<Severidad, { etiqueta: string; tono: TonoEstado }> = {
  ALTA: { etiqueta: 'Alta', tono: 'error' },
  MEDIA: { etiqueta: 'Media', tono: 'atencion' },
  BAJA: { etiqueta: 'Baja', tono: 'neutro' },
};

export const ORIGEN_EJECUCION: Record<OrigenEjecucion, string> = { PROGRAMADA: 'Programada', MANUAL: 'Manual' };

const TIPO_HALLAZGO: Record<string, string> = {
  ATRASO: 'Atraso',
  RIESGO_DE_ATRASO: 'Riesgo de atraso',
  SIN_REGISTRO_DIARIO: 'Sin registro diario',
  PLANILLA_PENDIENTE: 'Planilla pendiente',
  STOCK_BAJO: 'Stock bajo',
  STOCK_JUSTO: 'Stock justo',
  CONSUMO_EXCEDIDO: 'Consumo excedido',
  SALIDA_SIN_STOCK: 'Salida sin stock',
  CONSUMO_ATIPICO: 'Consumo atípico',
  COBRO_VENCIDO: 'Cobro vencido',
  COBRO_POR_VENCER: 'Cobro por vencer',
  PLANILLA_SIN_RESPUESTA: 'Planilla sin respuesta',
  PLANILLA_OBSERVADA_SIN_CORREGIR: 'Planilla observada sin corregir',
};

/** Nombre del tipo de hallazgo para la persona. */
export function textoTipoHallazgo(tipo: string): string {
  return TIPO_HALLAZGO[tipo] ?? tipo;
}

const CAMPOS_EJECUCION_CORTA = `
  id
  agente
  origen
  estado
  iniciadaEn
  terminadaEn
  cantidadHallazgos
`;

const CAMPOS_HALLAZGO = `
  ejecucionId
  agente
  obraId
  obraNombre
  tipo
  severidad
  situacion
  causaProbable
  evidencia {
    herramienta
    dato
  }
  detectadoEn
`;

const CAMPOS_SUGERENCIA = `
  id
  ejecucionId
  agente
  obraId
  obraNombre
  accion
  accionTexto
  descripcion
  estado
  creadaEn
  decididaPor {
    id
    nombre
  }
  decididaEn
  comentario
`;

export const AGENTES: TypedDocumentNode<{ agentes: AgenteInfo[] }, Record<string, never>> = gql`
  query Agentes {
    agentes {
      agente
      nombre
      mision
      herramientas
      ultimaEjecucion {
        ${CAMPOS_EJECUCION_CORTA}
      }
      sugerenciasPendientes
    }
  }
`;

export interface FiltroSugerencias {
  estado?: EstadoSugerencia;
  agente?: Agente;
  limite: number;
}

export const SUGERENCIAS: TypedDocumentNode<{ sugerencias: Sugerencia[] }, FiltroSugerencias> = gql`
  query Sugerencias($estado: EstadoSugerencia, $agente: Agente, $limite: Int) {
    sugerencias(estado: $estado, agente: $agente, limite: $limite) {
      ${CAMPOS_SUGERENCIA}
    }
  }
`;

export const HALLAZGOS: TypedDocumentNode<{ hallazgos: Hallazgo[] }, Record<string, never>> = gql`
  query Hallazgos {
    hallazgos {
      ${CAMPOS_HALLAZGO}
    }
  }
`;

export interface FiltroEjecuciones {
  agente?: Agente;
  estado?: EstadoEjecucion;
  limite: number;
}

export const EJECUCIONES_AGENTE: TypedDocumentNode<{ ejecucionesAgente: EjecucionCorta[] }, FiltroEjecuciones> = gql`
  query EjecucionesAgente($agente: Agente, $estado: EstadoEjecucion, $limite: Int) {
    ejecucionesAgente(agente: $agente, estado: $estado, limite: $limite) {
      ${CAMPOS_EJECUCION_CORTA}
    }
  }
`;

export const EJECUCION_AGENTE: TypedDocumentNode<{ ejecucionAgente: EjecucionAgente | null }, { id: string }> = gql`
  query EjecucionAgente($id: ID!) {
    ejecucionAgente(id: $id) {
      id
      agente
      origen
      estado
      solicitadaPor {
        id
        nombre
      }
      iniciadaEn
      terminadaEn
      proveedorLlm
      modelo
      resumen
      error {
        codigo
        mensaje
      }
      pasos {
        numero
        servidor
        herramienta
        argumentos
        resultadoResumen
        en
        duracionMs
        error
      }
      hallazgos {
        ${CAMPOS_HALLAZGO}
      }
    }
  }
`;

/** Solo el estado, para seguir una ejecución en curso. */
export const ESTADO_EJECUCION_AGENTE: TypedDocumentNode<
  { ejecucionAgente: { id: string; estado: EstadoEjecucion } | null },
  { id: string }
> = gql`
  query EstadoEjecucionAgente($id: ID!) {
    ejecucionAgente(id: $id) {
      id
      estado
    }
  }
`;

export const EJECUTAR_AGENTE: TypedDocumentNode<{ ejecutarAgente: EjecucionCorta }, { agente: Agente }> = gql`
  mutation EjecutarAgente($agente: Agente!) {
    ejecutarAgente(agente: $agente) {
      ${CAMPOS_EJECUCION_CORTA}
    }
  }
`;

export const APROBAR_SUGERENCIA: TypedDocumentNode<
  { aprobarSugerencia: Sugerencia },
  { id: string; comentario?: string }
> = gql`
  mutation AprobarSugerencia($id: ID!, $comentario: String) {
    aprobarSugerencia(id: $id, comentario: $comentario) {
      ${CAMPOS_SUGERENCIA}
    }
  }
`;

export const RECHAZAR_SUGERENCIA: TypedDocumentNode<{ rechazarSugerencia: Sugerencia }, { id: string; motivo: string }> = gql`
  mutation RechazarSugerencia($id: ID!, $motivo: String!) {
    rechazarSugerencia(id: $id, motivo: $motivo) {
      ${CAMPOS_SUGERENCIA}
    }
  }
`;

export function useAgentes() {
  return useConsultaConRespaldo(AGENTES);
}

export function useSugerencias(filtro: FiltroSugerencias) {
  return useConsultaConRespaldo(SUGERENCIAS, { variables: filtro });
}

export function useHallazgos() {
  return useConsultaConRespaldo(HALLAZGOS);
}

export function useEjecuciones(filtro: FiltroEjecuciones, omitir = false) {
  return useConsultaConRespaldo(EJECUCIONES_AGENTE, { variables: filtro, omitir });
}

export function useEjecucion(id: string | undefined) {
  return useConsultaConRespaldo(EJECUCION_AGENTE, { variables: { id: id ?? '' }, omitir: !id });
}
