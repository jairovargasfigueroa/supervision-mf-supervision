// Dictado por voz en el navegador (302).

/** URL del worker del dictado, junto al código del propio microfrontend (no del shell que lo carga). */
export function urlWorkerDictado(base: string = import.meta.url): URL {
  return new URL('./whisper.worker.js', base);
}

/**
 * Crea el worker de Whisper. Dentro del shell el microfrontend viene de otro origen (4203 dentro de 4200) y el
 * navegador no deja crear un worker con una URL de otro origen: se crea entonces un worker local (`blob:`) que
 * importa el del microfrontend, lo que sí se permite porque el servidor del microfrontend tiene CORS abierto.
 */
export function crearWorkerWhisper(url: URL = urlWorkerDictado(), origen: string = window.location.origin): Worker {
  if (url.origin === origen) return new Worker(url, { type: 'module' });
  const puente = new Blob([`import ${JSON.stringify(url.href)};\n`], { type: 'text/javascript' });
  return new Worker(URL.createObjectURL(puente), { type: 'module' });
}
