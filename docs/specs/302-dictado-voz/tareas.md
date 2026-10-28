# 302 · Dictado por voz en el navegador · tareas de `frontend/mf-supervision`

Requisitos y diseño: `docs/specs/302-dictado-voz/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Instalar `@huggingface/transformers` 4; entrada aparte del worker en `build.mjs` y prueba de que el worker carga dentro del shell
- [ ] `whisper.worker.ts` (WebGPU o WASM, `q8`, español, avance de descarga) y `grabador.ts` (MediaRecorder → Float32Array 16 kHz); pruebas del grabador
- [ ] `useDictado` con su máquina de estados y `soporte.ts`; pruebas con worker y grabador simulados
- [ ] `CampoDictado` con mensajes de error y texto agregado al final; pruebas del componente
- [ ] Pantalla `/supervision/dictado` con «Copiar texto» y enlace en el menú interno
- [ ] Prueba manual en Chrome y Edge con las 5 frases de obra (WER y tiempos anotados aquí)
