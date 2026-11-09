import { withNativeFederation, shareAll } from '@softarc/native-federation/config';
import { REACT_SKIP_LIST } from '@softarc/native-federation-esbuild/frameworks/react';

export default withNativeFederation({
  name: 'mf-supervision',

  // El shell del ERP carga este archivo; registra el elemento <mf-supervision>
  exposes: {
    './Bootstrap': './src/bootstrap.tsx',
  },

  shared: {
    ...shareAll(
      {
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      },
      {
        // transformers.js (302) va solo dentro del worker del dictado (build.mjs) y SheetJS (503) solo en este
        // microfrontend (se instala desde su CDN, sin versión del registro de npm): no se comparten con el shell.
        // jspdf, jspdf-autotable y docx (505) tampoco: solo se usan aquí y se cargan al exportar
        skipList: [...REACT_SKIP_LIST, '@huggingface/transformers', 'xlsx', 'jspdf', 'jspdf-autotable', 'docx'],
        overrides: {
          react: {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: { keepAll: true },
          },
          'react-dom': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },

  features: {
    ignoreUnusedDeps: true,
  },
});
