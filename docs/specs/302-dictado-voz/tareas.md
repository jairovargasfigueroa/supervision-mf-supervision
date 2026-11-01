# 302 · Dictado por voz en el navegador · tareas de `frontend/mf-supervision`

Requisitos y diseño: `docs/specs/302-dictado-voz/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Instalar `@huggingface/transformers` 4; entrada aparte del worker en `build.mjs` y prueba de que el worker carga dentro del shell
- [x] `whisper.worker.ts` (WebGPU o WASM, `q8`, español, avance de descarga) y `grabador.ts` (MediaRecorder → Float32Array 16 kHz); pruebas del grabador
- [x] `useDictado` con su máquina de estados y `soporte.ts`; pruebas con worker y grabador simulados
- [x] `CampoDictado` con mensajes de error y texto agregado al final; pruebas del componente
- [x] Pantalla `/supervision/dictado` con «Copiar texto» y enlace en el menú interno
- [ ] Prueba manual en Chrome y Edge con las 5 frases de obra (WER y tiempos anotados aquí)
  - Pendiente: la tiene que hacer una persona hablando al micrófono (anotar aquí WER y tiempos de las 5 frases).
  - Hecho el 31/10/2026 (prueba de humo, sin descargar el modelo): con el `dist/` servido en 4203 y una página en otro origen (4299, como el shell), `new Worker(url)` directo es rechazado con `SecurityError` y el puente `blob:` de `crearWorkerWhisper` carga `whisper.worker.js` sin errores.
