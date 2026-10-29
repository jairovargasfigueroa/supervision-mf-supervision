import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import type { KeyboardEvent, ReactNode } from 'react';

// Tabla común del microfrontend: la lógica es de TanStack Table (orden por columna) y el dibujo, de la Table
// de MUI (filas compactas, docs/diseno-visual.md). Las columnas numéricas se alinean a la derecha. Debajo de
// 600 px la tabla se desplaza a lo ancho con la primera columna fija (docs/diseno-visual.md, «Pantallas chicas»).

export const caracteristicasTabla = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
});

export type CaracteristicasTabla = typeof caracteristicasTabla;

// `any`: cada columna tiene su propio tipo de valor (como en ColumnDef de TanStack Table)
export type ColumnaTabla<T extends RowData> = ColumnDef<CaracteristicasTabla, T, any>;

/** Ayudante para declarar columnas tipadas de una fila. */
export function ayudanteColumnas<T extends RowData>() {
  return createColumnHelper<CaracteristicasTabla, T>();
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TFeatures, TData, TValue> {
    /** Columna numérica: a la derecha y con cifras tabulares. */
    numerica?: boolean;
  }
}

interface Props<T extends RowData> {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  /** Nombre de la tabla para lectores de pantalla. */
  etiqueta: string;
  /** Identificador estable de cada fila. */
  idFila: (fila: T) => string;
  /** Lo que se muestra si no hay filas. */
  vacio?: ReactNode;
  /** Orden con el que se abre la tabla; luego se ordena pulsando el encabezado de cualquier columna. */
  ordenInicial?: SortingState;
  /** Acción al pulsar una fila (o Enter sobre ella); la fila queda enfocable con el teclado. */
  alPulsarFila?: (fila: T) => void;
  /** Nombre de la fila pulsable para lectores de pantalla. */
  etiquetaFila?: (fila: T) => string;
}

const estiloNumero = {
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
} as const;

const estiloColumnaFija = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  bgcolor: 'background.paper',
} as const;

export function TablaDatos<T extends RowData>({
  columnas,
  filas,
  etiqueta,
  idFila,
  vacio,
  ordenInicial,
  alPulsarFila,
  etiquetaFila,
}: Props<T>) {
  const celular = useMediaQuery((tema: Theme) => tema.breakpoints.down('sm'));
  const tabla = useTable({
    features: caracteristicasTabla,
    columns: columnas,
    data: filas,
    getRowId: (fila) => idFila(fila),
    enableSortingRemoval: true,
    initialState: ordenInicial ? { sorting: ordenInicial } : undefined,
  });

  const filasVisibles = tabla.getRowModel().rows;
  const fija = (indice: number) => (celular && indice === 0 ? estiloColumnaFija : undefined);

  return (
    <TableContainer>
      <Table size="small" aria-label={etiqueta}>
        <TableHead>
          {tabla.getHeaderGroups().map((grupo) => (
            <TableRow key={grupo.id}>
              {grupo.headers.map((encabezado, indice) => {
                const columna = encabezado.column;
                const numerica = columna.columnDef.meta?.numerica;
                const orden = columna.getIsSorted();
                return (
                  <TableCell
                    key={encabezado.id}
                    align={numerica ? 'right' : 'left'}
                    sortDirection={orden || false}
                    sx={{ fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap', ...fija(indice) }}
                  >
                    {encabezado.isPlaceholder ? null : columna.getCanSort() ? (
                      <TableSortLabel
                        active={!!orden}
                        direction={orden || 'asc'}
                        onClick={columna.getToggleSortingHandler()}
                      >
                        <tabla.FlexRender header={encabezado} />
                      </TableSortLabel>
                    ) : (
                      <tabla.FlexRender header={encabezado} />
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {filasVisibles.map((fila) => (
            <TableRow
              key={fila.id}
              hover
              sx={{ height: 40, ...(alPulsarFila && { cursor: 'pointer' }) }}
              {...(alPulsarFila && {
                tabIndex: 0,
                'aria-label': etiquetaFila?.(fila.original),
                onClick: () => alPulsarFila(fila.original),
                onKeyDown: (evento: KeyboardEvent) => {
                  if (evento.key === 'Enter') alPulsarFila(fila.original);
                },
              })}
            >
              {fila.getAllCells().map((celda, indice) => {
                const numerica = celda.column.columnDef.meta?.numerica;
                return (
                  <TableCell
                    key={celda.id}
                    align={numerica ? 'right' : 'left'}
                    sx={{ ...(numerica && estiloNumero), ...fija(indice) }}
                  >
                    <tabla.FlexRender cell={celda} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {filasVisibles.length === 0 && vacio && (
            <TableRow>
              <TableCell colSpan={columnas.length} sx={{ p: 0, border: 0 }}>
                {vacio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
