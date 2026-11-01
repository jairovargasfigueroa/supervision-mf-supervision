// Compila el microfrontend con Native Federation (adaptador esbuild).
// `node build.mjs` genera dist/; `node build.mjs --dev` recompila al guardar y sirve en el puerto PORT.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { context as contextoEsbuild } from 'esbuild';
import { runEsBuildBuilder } from '@softarc/native-federation-esbuild';

const isDev = process.argv.includes('--dev');
const port = Number(process.env.PORT ?? 4203);

const federation = await runEsBuildBuilder('federation.config.js', {
  outputPath: 'dist',
  tsConfig: 'tsconfig.json',
  dev: isDev,
  watch: isDev,
  entryPoints: ['src/bootstrap.tsx'],
  adapterConfig: { plugins: [] },
});

// Worker del dictado (302): entrada aparte, fuera de Native Federation. Lleva dentro transformers.js y solo se
// descarga cuando el usuario pulsa el micrófono por primera vez. Queda en dist/whisper.worker.js, junto al
// código del microfrontend, y se crea con new URL('./whisper.worker.js', import.meta.url).
// DICTADO_MODELO_URL (opcional): ruta propia de los modelos en lugar de Hugging Face; DICTADO_MODELO: el modelo
// (por defecto onnx-community/whisper-base; onnx-community/whisper-tiny para equipos lentos).
const worker = await contextoEsbuild({
  entryPoints: { 'whisper.worker': 'src/dictado/whisper.worker.ts' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: !isDev,
  sourcemap: isDev,
  logLevel: 'warning',
  define: {
    'process.env.DICTADO_MODELO_URL': JSON.stringify(process.env.DICTADO_MODELO_URL ?? ''),
    'process.env.DICTADO_MODELO': JSON.stringify(process.env.DICTADO_MODELO ?? ''),
  },
});

if (!isDev) {
  await worker.rebuild();
  await worker.dispose();
  await federation.close();
  console.log('Compilación terminada.');
} else {
  const tipos = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.map': 'application/json',
  };

  // Busca primero en dist/ (lo compilado) y luego en public/ (página de prueba)
  const buscar = (ruta) => {
    for (const base of ['dist', 'public']) {
      const archivo = normalize(join(base, ruta));
      if (archivo.startsWith(base) && existsSync(archivo) && statSync(archivo).isFile()) {
        return archivo;
      }
    }
    return null;
  };

  createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const archivo = buscar(ruta === '/' ? '/index.html' : ruta);
    // El shell del ERP carga este microfrontend desde otro puerto
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (!archivo) {
      res.writeHead(404).end('No encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': tipos[extname(archivo)] ?? 'application/octet-stream' });
    res.end(readFileSync(archivo));
  }).listen(port, () => console.log(`Sirviendo en http://localhost:${port}`));

  await worker.watch();

  const cerrar = async () => {
    await worker.dispose();
    await federation.close();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}
