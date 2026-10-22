import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";
import wawoff2 from "wawoff2";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = join(raiz, "assets/og");
const TINTA = "#0B2A4A";
const AZUL = "#0077D5";
const PESO = 700;
const EXTENSION = 1.12;

function trazar(font, texto, tamano, peso, tracking) {
  const coords = { wght: peso };
  font.variation.set(coords);
  const escala = tamano / font.unitsPerEm;
  const xScale = escala * EXTENSION;
  const yScale = escala;
  const path = new opentype.Path();
  let x = 0;
  for (const letra of texto) {
    const glifo = font.charToGlyph(letra);
    path.extend(glifo.getPath(x, 0, tamano, { variation: coords, xScale, yScale }, font));
    const ancho = font.variation.getTransform(glifo, coords).advanceWidth * xScale;
    x += ancho + tracking * tamano;
  }
  return path;
}

function grupo(path, cx, ancla, color, modo) {
  const caja = path.getBoundingBox();
  const dx = cx - (caja.x1 + caja.x2) / 2;
  const dy = modo === "centro" ? ancla - (caja.y1 + caja.y2) / 2 : ancla;
  return {
    svg: `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})"><path fill="${color}" d="${path.toPathData(2)}"/></g>`,
    caja: {
      x1: caja.x1 + dx,
      y1: caja.y1 + dy,
      x2: caja.x2 + dx,
      y2: caja.y2 + dy
    }
  };
}

function etiqueta(font, texto, cx, cy, tamano) {
  const path = trazar(font, texto, tamano, 620, 0.01);
  const caja = path.getBoundingBox();
  const ancho = caja.x2 - caja.x1 + tamano * 1.35;
  const alto = Math.max(tamano * 1.85, caja.y2 - caja.y1 + tamano * 0.85);
  const x = cx - ancho / 2;
  const y = cy - alto / 2;
  const textoSvg = grupo(path, cx, cy, TINTA, "centro").svg;
  const radio = alto / 2;
  const svg = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${ancho.toFixed(2)}" height="${alto.toFixed(2)}" rx="${radio.toFixed(2)}" fill="#ffffff" stroke="${AZUL}" stroke-width="1.5"/>${textoSvg}`;
  return { svg, x, y, ancho, alto };
}

async function sombra(diametro) {
  const extra = 36;
  const svg = `<svg width="${diametro}" height="${diametro}" xmlns="http://www.w3.org/2000/svg"><circle cx="${diametro / 2}" cy="${diametro / 2}" r="${diametro / 2 - 1}" fill="rgb(11,42,74)"/></svg>`;
  const borrosa = await sharp(Buffer.from(svg)).blur(16).png().toBuffer();
  const { data, info } = await sharp(borrosa).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * 0.28);
  return sharp(data, { raw: info })
    .extend({
      top: extra,
      bottom: extra + 8,
      left: extra,
      right: extra,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

function fondo(ancho, alto) {
  return Buffer.from(`<svg width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="72%" stop-color="#ffffff"/><stop offset="100%" stop-color="#EAF3FF"/></linearGradient></defs><rect width="${ancho}" height="${alto}" fill="url(#g)"/></svg>`);
}

async function armar(font, medidas) {
  const { ancho, alto, logoPx } = medidas;
  const cuadrado = Math.min(ancho, alto);
  const seguro = { x: (ancho - cuadrado) / 2, y: 0, w: cuadrado, h: alto };
  const margen = 80 * (cuadrado / 630);
  const limite = {
    x1: Math.max(margen, seguro.x),
    y1: Math.max(margen, seguro.y),
    x2: Math.min(ancho - margen, seguro.x + seguro.w),
    y2: Math.min(alto - margen, seguro.y + seguro.h)
  };
  const cx = ancho / 2;
  const logoTop = limite.y1 + (cuadrado === alto ? 6 : 4);
  const logoLeft = Math.round(cx - logoPx / 2);
  const nombrePx = cuadrado === alto ? 34 : 46;
  const subPx = cuadrado === alto ? 22 : 26;
  const chipPx = cuadrado === alto ? 16 : 18;
  let nombre = trazar(font, "Droguerías Reina", nombrePx, PESO, 0.045);
  let cajaNombre = nombre.getBoundingBox();
  let tamNombre = nombrePx;
  while (cajaNombre.x2 - cajaNombre.x1 > limite.x2 - limite.x1 - 8 && tamNombre > 28) {
    tamNombre -= 1;
    nombre = trazar(font, "Droguerías Reina", tamNombre, PESO, 0.045);
    cajaNombre = nombre.getBoundingBox();
  }
  const baseNombre = logoTop + logoPx + tamNombre + (cuadrado === alto ? 16 : 22);
  const nombreDibujado = grupo(nombre, cx, baseNombre, TINTA, "base");
  const lineaAncho = Math.round(tamNombre * 2.1);
  const lineaY = nombreDibujado.caja.y2 + (cuadrado === alto ? 14 : 16);
  const linea = `<rect x="${(cx - lineaAncho / 2).toFixed(2)}" y="${lineaY.toFixed(2)}" width="${lineaAncho}" height="3" rx="1.5" fill="${AZUL}"/>`;
  const sub = trazar(font, "Droguería en Funza", subPx, 640, 0.02);
  const subY = lineaY + 3 + subPx + (cuadrado === alto ? 12 : 16);
  const subDibujado = grupo(sub, cx, subY, AZUL, "base");
  const chipY = subDibujado.caja.y2 + (cuadrado === alto ? 28 : 34);
  const domicilios = etiqueta(font, "Domicilios a Funza y Mosquera", cx, 0, chipPx);
  const pagas = etiqueta(font, "Pagas al recibir", cx, 0, chipPx);
  const hueco = cuadrado === alto ? 10 : 12;
  const juntos = domicilios.ancho + pagas.ancho + hueco <= limite.x2 - limite.x1;
  let chips;
  if (juntos) {
    const total = domicilios.ancho + pagas.ancho + hueco;
    const inicio = cx - total / 2;
    const a = etiqueta(font, "Domicilios a Funza y Mosquera", inicio + domicilios.ancho / 2, chipY, chipPx);
    const b = etiqueta(font, "Pagas al recibir", inicio + domicilios.ancho + hueco + pagas.ancho / 2, chipY, chipPx);
    chips = [a, b];
  } else {
    const a = etiqueta(font, "Domicilios a Funza y Mosquera", cx, chipY, chipPx);
    const b = etiqueta(font, "Pagas al recibir", cx, chipY + a.alto + hueco, chipPx);
    chips = [a, b];
  }
  const piezas = [nombreDibujado.caja, subDibujado.caja, ...chips.map((chip) => ({ x1: chip.x, y1: chip.y, x2: chip.x + chip.ancho, y2: chip.y + chip.alto })), { x1: logoLeft, y1: logoTop, x2: logoLeft + logoPx, y2: logoTop + logoPx }];
  for (const pieza of piezas) {
    if (pieza.x1 < limite.x1 - 0.5 || pieza.y1 < limite.y1 - 0.5 || pieza.x2 > limite.x2 + 0.5 || pieza.y2 > limite.y2 + 0.5) {
      throw new Error(`Contenido fuera del margen ${JSON.stringify({ pieza, limite })}`);
    }
  }
  const svg = Buffer.from(`<svg width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg">${nombreDibujado.svg}${linea}${subDibujado.svg}${chips.map((chip) => chip.svg).join("")}</svg>`);
  const halo = await sombra(logoPx);
  const logo = await sharp(join(raiz, "assets/logo/logo.png")).resize(logoPx, logoPx, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const metaHalo = await sharp(halo).metadata();
  return sharp(fondo(ancho, alto))
    .composite([
      { input: halo, left: Math.round(logoLeft - (metaHalo.width - logoPx) / 2), top: Math.round(logoTop - (metaHalo.height - logoPx) / 2 + 6) },
      { input: logo, left: logoLeft, top: Math.round(logoTop) },
      { input: svg, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();
}

async function jpeg(png, destino, tope, calidadInicial) {
  let calidad = calidadInicial;
  let buffer = await sharp(png).jpeg({ quality: calidad, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer();
  while (buffer.length > tope && calidad > 46) {
    calidad -= 4;
    buffer = await sharp(png).jpeg({ quality: calidad, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer();
  }
  if (buffer.length > tope) throw new Error(`${destino} pesa ${buffer.length} bytes`);
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error(`${destino} no es JPEG`);
  let progresivo = false;
  for (let i = 0; i < buffer.length - 1; i += 1) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xc2) progresivo = true;
  }
  if (!progresivo) throw new Error(`${destino} no es progresivo`);
  await sharp(buffer).toFile(destino);
  const info = await sharp(destino).metadata();
  const peso = (await stat(destino)).size;
  return { destino, ancho: info.width, alto: info.height, peso, calidad, formato: info.format };
}

const woff = await readFile(join(raiz, "fonts/inter-latin.woff2"));
const ttf = Buffer.from(await wawoff2.decompress(woff));
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
await mkdir(salida, { recursive: true });
const ancha = await armar(font, { ancho: 1200, alto: 630, logoPx: 190 });
const cuadrada = await armar(font, { ancho: 600, alto: 600, logoPx: 156 });
const amplia = await jpeg(ancha, join(salida, "og-droguerias-reina-v2.jpg"), 120 * 1024, 80);
const respaldo = await jpeg(cuadrada, join(salida, "og-cuadrada.jpg"), 60 * 1024, 80);
if (amplia.ancho !== 1200 || amplia.alto !== 630) throw new Error("Dimensiones de la tarjeta incorrectas");
if (respaldo.ancho !== 600 || respaldo.alto !== 600) throw new Error("Dimensiones del respaldo incorrectas");
if (amplia.peso >= 200 * 1024 || respaldo.peso >= 60 * 1024) throw new Error("Peso por encima del límite");
const linea = (item) => `${item.ancho}x${item.alto} ${item.formato} ${item.peso} bytes calidad ${item.calidad} ${item.destino}`;
console.log(linea(amplia));
console.log(linea(respaldo));
