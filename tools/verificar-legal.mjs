import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

function extraerBloque(fuente, marca) {
  const inicio = fuente.indexOf(marca);
  if (inicio < 0) return "";
  const abre = fuente.indexOf("{", inicio);
  if (abre < 0) return "";
  let nivel = 0;
  for (let i = abre; i < fuente.length; i += 1) {
    const c = fuente[i];
    if (c === "{") nivel += 1;
    else if (c === "}") {
      nivel -= 1;
      if (nivel === 0) return fuente.slice(abre, i + 1);
    } else if (c === "\"" || c === "'" || c === "`") {
      const cita = c;
      i += 1;
      while (i < fuente.length) {
        if (fuente[i] === "\\") {
          i += 2;
          continue;
        }
        if (fuente[i] === cita) break;
        i += 1;
      }
    }
  }
  return "";
}

export function vacio(valor) {
  if (valor == null) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (typeof valor === "number") return !Number.isFinite(valor);
  if (Array.isArray(valor)) return valor.length === 0 || valor.every((item) => vacio(item));
  return false;
}

export function listarVacios(legal, usos) {
  const campos = new Set([...Object.keys(legal || {}), ...usos.keys()]);
  const lista = [];
  for (const campo of campos) {
    const valor = legal && Object.prototype.hasOwnProperty.call(legal, campo) ? legal[campo] : undefined;
    if (!vacio(valor)) continue;
    const donde = ["js/config.js"];
    for (const pagina of usos.get(campo) || []) {
      if (!donde.includes(pagina)) donde.push(pagina);
    }
    lista.push({ campo, donde });
  }
  lista.sort((a, b) => a.campo.localeCompare(b.campo, "es"));
  return lista;
}

function leerConfig() {
  const fuente = readFileSync(join(raiz, "js/config.js"), "utf8");
  const bloque = extraerBloque(fuente, "export const negocio");
  if (!bloque) throw new Error("No se encontró negocio en js/config.js");
  return Function(`"use strict"; return (${bloque});`)();
}

function leerUsos() {
  const usos = new Map();
  for (const nombre of readdirSync(raiz)) {
    if (!nombre.endsWith(".html")) continue;
    const html = readFileSync(join(raiz, nombre), "utf8");
    const re = /data-legal="([^"]+)"/g;
    let hallado;
    while ((hallado = re.exec(html))) {
      const campo = hallado[1];
      if (!usos.has(campo)) usos.set(campo, []);
      if (!usos.get(campo).includes(nombre)) usos.get(campo).push(nombre);
    }
  }
  return usos;
}

function main() {
  const negocio = leerConfig();
  const legal = negocio.legal || {};
  const vacios = listarVacios(legal, leerUsos());
  if (!vacios.length) {
    console.log("Datos legales completos.");
    return;
  }
  const lineas = vacios.map((item) => `- ${item.campo} (${item.donde.join(", ")})`);
  if (negocio.modoPrueba === false) {
    console.error("Campos legales vacíos:");
    lineas.forEach((linea) => console.error(linea));
    process.exitCode = 1;
    return;
  }
  console.log("Modo prueba. Completa estos campos antes de salir:");
  lineas.forEach((linea) => console.log(linea));
}

const entrada = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (entrada) main();
