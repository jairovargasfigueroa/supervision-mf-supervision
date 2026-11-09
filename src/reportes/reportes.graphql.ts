import { gql, type TypedDocumentNode } from '@apollo/client';
import { useConsultaConRespaldo } from '../nucleo/consulta-respaldo';

// Operaciones de la pantalla «Reportes» (503; docs/contratos.md y SDL del diseño de la 503). La receta no se expone
// por GraphQL: la persona ve `aplicado`. 505: `consultarReporte` responde con un reporte o con una pregunta de
// aclaración, dentro de una conversación (`conversacionId`).

export type ConjuntoReporte = 'OBRAS' | 'CONSUMO_MATERIAL' | 'MOVIMIENTOS' | 'COBROS' | 'PLANILLAS' | 'CONSUMOS_ATIPICOS';

export type AtajoReporte =
  | 'AVANCE_OBRAS'
  | 'OBRAS_EN_RIESGO'
  | 'CONSUMO_MATERIAL_MES'
  | 'SALIDAS_SIN_STOCK'
  | 'COBROS_VENCIDOS'
  | 'COBROS_POR_VENCER'
  | 'COBRADO_POR_OBRA'
  | 'PLANILLAS_OBSERVADAS'
  | 'PLANILLAS_APROBADAS'
  | 'CONSUMOS_ATIPICOS_PENDIENTES';

export type TipoColumna = 'TEXTO' | 'NUMERO' | 'MONTO' | 'PORCENTAJE' | 'FECHA' | 'BOOLEANO';

export type ResultadoConsultaReporte = 'OK' | 'NO_RECONOCIDA' | 'RECETA_INVALIDA' | 'ERROR';

export interface ColumnaReporte {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
}

export interface ElementoAplicado {
  nombre: string;
  valor: string;
}

export interface ConsultaReporte {
  id: string;
  texto: string | null;
  atajo: AtajoReporte | null;
  conjunto: ConjuntoReporte;
  tituloConjunto: string;
  aplicado: ElementoAplicado[];
  resumen: string;
  resumenPlantilla: boolean;
  avisos: string[];
  columnas: ColumnaReporte[];
  /** Valores como texto: números con punto decimal, fechas ISO, booleanos `true`/`false`, nulos `null`. */
  filas: (string | null)[][];
  totalFilas: number;
  truncado: boolean;
  creadaEn: string;
}

export interface ConsultaReporteCorta {
  id: string;
  texto: string | null;
  atajo: AtajoReporte | null;
  conjunto: ConjuntoReporte | null;
  resultado: ResultadoConsultaReporte;
  resumen: string | null;
  totalFilas: number | null;
  creadaEn: string;
}

export interface ConjuntoDisponible {
  conjunto: ConjuntoReporte;
  titulo: string;
  descripcion: string;
  columnas: ColumnaReporte[];
  filtros: string[];
  agrupaciones: string[];
  ejemplos: string[];
}

export interface AtajoDisponible {
  atajo: AtajoReporte;
  titulo: string;
  descripcion: string;
}

export interface CatalogoReportes {
  conjuntos: ConjuntoDisponible[];
  atajos: AtajoDisponible[];
}

/** Lo que se envía: el texto del usuario o un reporte común (exactamente uno). */
export type PedidoReporte = { texto: string } | { atajo: AtajoReporte };

/** 505: tipo de respuesta de un turno de la conversación. */
export type TipoRespuestaReporte = 'REPORTE' | 'ACLARACION';

/** 505: pregunta del asistente cuando al pedido le falta algo o es ambiguo; las opciones salen de los datos reales. */
export interface AclaracionReporte {
  pregunta: string;
  opciones: string[];
  preguntasRestantes: number;
}

/** 505: respuesta de `consultarReporte`: `consulta` con `REPORTE`, `aclaracion` con `ACLARACION`. */
export interface RespuestaReporte {
  conversacionId: string;
  tipo: TipoRespuestaReporte;
  consulta: ConsultaReporte | null;
  aclaracion: AclaracionReporte | null;
}

/** Variables de `consultarReporte`: sin `conversacionId` empieza una conversación nueva (505). */
export type VariablesConsultarReporte = { texto?: string; atajo?: AtajoReporte; conversacionId?: string };

/** Largo permitido del pedido (503, criterio 3); dentro de una conversación, desde 1 carácter (505). */
export const LARGO_MINIMO_PEDIDO = 3;
export const LARGO_MINIMO_RESPUESTA = 1;
export const LARGO_MAXIMO_PEDIDO = 500;

/** Consultas del historial (503, criterio 16). */
export const LIMITE_HISTORIAL = 10;

/** Tiempo máximo de todo el proceso (503, criterio 11). */
export const TIEMPO_MAXIMO_MS = 60_000;

export const CATALOGO_REPORTES: TypedDocumentNode<{ catalogoReportes: CatalogoReportes }, Record<string, never>> = gql`
  query CatalogoReportes {
    catalogoReportes {
      conjuntos {
        conjunto
        titulo
        descripcion
        columnas {
          clave
          titulo
          tipo
        }
        filtros
        agrupaciones
        ejemplos
      }
      atajos {
        atajo
        titulo
        descripcion
      }
    }
  }
`;

export const CONSULTAS_REPORTE: TypedDocumentNode<{ consultasReporte: ConsultaReporteCorta[] }, { limite: number }> = gql`
  query ConsultasReporte($limite: Int) {
    consultasReporte(limite: $limite) {
      id
      texto
      atajo
      conjunto
      resultado
      resumen
      totalFilas
      creadaEn
    }
  }
`;

export const CONSULTAR_REPORTE: TypedDocumentNode<{ consultarReporte: RespuestaReporte }, VariablesConsultarReporte> = gql`
  mutation ConsultarReporte($texto: String, $atajo: AtajoReporte, $conversacionId: ID) {
    consultarReporte(texto: $texto, atajo: $atajo, conversacionId: $conversacionId) {
      conversacionId
      tipo
      consulta {
        id
        texto
        atajo
        conjunto
        tituloConjunto
        aplicado {
          nombre
          valor
        }
        resumen
        resumenPlantilla
        avisos
        columnas {
          clave
          titulo
          tipo
        }
        filas
        totalFilas
        truncado
        creadaEn
      }
      aclaracion {
        pregunta
        opciones
        preguntasRestantes
      }
    }
  }
`;

/** Conjuntos, ejemplos y reportes comunes (con el respaldo de la 104). */
export function useCatalogoReportes() {
  return useConsultaConRespaldo(CATALOGO_REPORTES);
}

/** Últimas 10 consultas del usuario (con el respaldo de la 104). */
export function useHistorialConsultas() {
  return useConsultaConRespaldo(CONSULTAS_REPORTE, { variables: { limite: LIMITE_HISTORIAL } });
}
