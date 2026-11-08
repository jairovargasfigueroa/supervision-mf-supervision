import { useEffect, useState } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { EstadoVacio } from './compartido/EstadoVacio';
import { obtenerClienteApollo } from './nucleo/apollo';
import { useSesion } from './nucleo/sesion';
import { crearRouter, type RouterSupervision } from './router';

interface Props {
  /** Historial del router; por defecto el del navegador (las pruebas pasan uno en memoria). */
  historial?: RouterHistory;
}

// Raíz del área: cliente GraphQL con el token del shell y rutas internas. Sin la sesión del shell (abierto solo
// en su puerto) solo muestra el aviso.
export function App({ historial }: Props) {
  const sesion = useSesion();

  if (!sesion) {
    return <EstadoVacio texto="Abre esta pantalla desde el ERP" />;
  }

  return (
    <ApolloProvider client={obtenerClienteApollo()}>
      <Rutas historial={historial} />
    </ApolloProvider>
  );
}

function Rutas({ historial }: Props) {
  const [router, setRouter] = useState<RouterSupervision>();

  // El historial del navegador intercepta pushState (así se entera de la navegación del shell);
  // al desmontar se destruye para devolver window.history a su estado original.
  useEffect(() => {
    const nuevo = crearRouter(historial);
    setRouter(nuevo);
    return () => nuevo.history.destroy();
  }, [historial]);

  return router ? <RouterProvider router={router} /> : null;
}
