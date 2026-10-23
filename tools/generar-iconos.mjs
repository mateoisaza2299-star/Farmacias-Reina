import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = join(raiz, "assets/logo/logo.png");
const salida = join(raiz, "assets/icons");
const AZUL = { r: 0, g: 119, b: 213, alpha: 1 };
const BLANCO = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

async function existe(archivo) {
  try {
    await access(join(raiz, archivo));
    return true;
  } catch {
    return false;
  }
}

async function icono(tamano, fondo, archivo) {
  const imagen = await sharp(logo)
    .resize(tamano, tamano, { fit: "contain", background: fondo })
    .png()
    .toBuffer();
  await sharp({
    create: { width: tamano, height: tamano, channels: 4, background: fondo }
  })
    .composite([{ input: imagen, gravity: "centre" }])
    .png()
    .toFile(join(salida, archivo));
}

async function maskable() {
  const tamano = 512;
  const lado = Math.round(tamano * 0.7);
  const imagen = await sharp(logo)
    .resize(lado, lado, { fit: "contain", background: AZUL })
    .png()
    .toBuffer();
  await sharp({
    create: { width: tamano, height: tamano, channels: 4, background: AZUL }
  })
    .composite([{ input: imagen, gravity: "centre" }])
    .png()
    .toFile(join(salida, "icon-maskable-512.png"));
}

await mkdir(salida, { recursive: true });
await icono(192, TRANSPARENTE, "icon-192.png");
await icono(512, TRANSPARENTE, "icon-512.png");
await maskable();
await icono(180, BLANCO, "apple-touch-icon.png");

const accesos = [
  ["catalogo.html", "shortcut-catalogo.png"],
  ["mis-pedidos.html", "shortcut-pedidos.png"],
  ["formula.html", "shortcut-formula.png"],
  ["index.html", "shortcut-buscar.png"]
];

for (const [pagina, archivo] of accesos) {
  if (await existe(pagina)) await icono(96, TRANSPARENTE, archivo);
}
