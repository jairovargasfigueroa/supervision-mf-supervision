// Lo que el navegador necesita para dictar (302, criterio 8): micrófono (getUserMedia y MediaRecorder, que piden
// contexto seguro: http://localhost o HTTPS), AudioContext para pasar el audio a 16 kHz, WebAssembly y Web Workers.
// Si falta algo, el botón del micrófono se desactiva y el campo sigue sirviendo para escribir.

export interface EntornoDictado {
  navigator?: { mediaDevices?: { getUserMedia?: unknown } };
  MediaRecorder?: unknown;
  AudioContext?: unknown;
  WebAssembly?: unknown;
  Worker?: unknown;
}

export function dictadoSoportado(entorno: EntornoDictado = globalThis as EntornoDictado): boolean {
  return (
    typeof entorno.navigator?.mediaDevices?.getUserMedia === 'function' &&
    typeof entorno.MediaRecorder === 'function' &&
    typeof entorno.AudioContext === 'function' &&
    typeof entorno.WebAssembly === 'object' &&
    typeof entorno.Worker === 'function'
  );
}
