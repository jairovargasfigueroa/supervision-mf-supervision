import { env } from '@huggingface/transformers';

// Worker del dictado (302). Se compila aparte en build.mjs (dist/whisper.worker.js) con transformers.js dentro.
// Los modelos se guardan con la Cache API del navegador (valor por defecto de transformers.js).
env.useBrowserCache = true;
