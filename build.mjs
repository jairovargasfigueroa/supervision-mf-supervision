// Compila el microfrontend con Native Federation (adaptador esbuild).
// `node build.mjs` genera dist/; `node build.mjs --dev` recompila al guardar y sirve en el puerto PORT.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
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

if (!isDev) {
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

  const cerrar = async () => {
    await federation.close();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}
