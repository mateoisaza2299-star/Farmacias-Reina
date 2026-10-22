import { negocio } from "./config.js";
import { esFormula } from "./format.js";

const LLAVE = "pedidos_reina";
const TOPE = 20;
const VIGENCIA = 90 * 24 * 60 * 60 * 1000;
const ACTIVOS = new Set(["revision", "pendiente_pago", "pagado", "despachado"]);

export const PASOS = [
  ["revision", "En revisión"],
  ["pendiente_pago", "Pendiente de pago"],
  ["pagado", "Pagado"],
  ["despachado", "Despachado"],
  ["entregado", "Entregado"]
];

const ETIQUETAS = {
  revision: "En revisión",
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  despachado: "Despachado",
  entregado: "Entregado",
  rechazado: "Rechazado",
  cancelado: "Cancelado"
};

const vistos = new Map();
let baseEstados = false;

export function etiquetaEstado(estado) {
  if (estado === "pendiente_pago" && negocio.pagoEnLinea === false) return "Por despachar · pago al recibir";
  if (estado === "pagado" && negocio.pagoEnLinea) return "Pagado · por despachar";
  if (ETIQUETAS[estado]) return ETIQUETAS[estado];
  if (!estado) return "Estado desconocido";
  return String(estado).replaceAll("_", " ");
}

export function prioridadEstado(estado) {
  if (estado === "revision") return 0;
  if (estado === "pendiente_pago") return 1;
  if (estado === "pagado") return 2;
  if (estado === "despachado") return 3;
  if (estado === "entregado") return 4;
  if (estado === "rechazado") return 5;
  if (estado === "cancelado") return 6;
  return 7;
}

export function esActivo(estado) {
  return ACTIVOS.has(estado);
}

export function fraseActiva(estado) {
  if (estado === "revision") return "en revisión";
  if (estado === "pendiente_pago" || estado === "pagado") return "por despachar";
  if (estado === "despachado") return "en camino";
  return "";
}

export function textoCambioEstado(pedido) {
  const numero = pedido?.numero ? `#${pedido.numero}` : "";
  const quien = numero ? `Tu pedido ${numero}` : "Tu pedido";
  const frase = fraseActiva(pedido?.estado);
  if (frase) return `${quien} está ${frase}`;
  if (pedido?.estado === "entregado") return `${quien} fue entregado`;
  if (pedido?.estado === "cancelado") return `${quien} fue cancelado`;
  if (pedido?.estado === "rechazado") return `${quien} fue rechazado`;
  return `${quien} cambió de estado`;
}

export function textoFranja(pedido) {
  const frase = fraseActiva(pedido?.estado);
  if (!frase) return "";
  const numero = pedido?.numero ? `#${pedido.numero}` : "";
  return numero ? `Tu pedido ${numero} está ${frase}` : `Tu pedido está ${frase}`;
}

export function puedeCancelar(estado) {
  return estado === "revision" || estado === "pendiente_pago";
}

export function puedeQuitar(estado) {
  return estado === "entregado" || estado === "cancelado";
}

export function esToken(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor || ""));
}

function numeroDe(valor) {
  if (valor == null || valor === "") return null;
  return valor;
}

function fechaDe(valor) {
  if (!valor) return null;
  const tiempo = new Date(valor).getTime();
  if (!Number.isFinite(tiempo)) return null;
  return new Date(tiempo).toISOString();
}

function entrada(row) {
  if (typeof row === "string") {
    return esToken(row) ? { token: row, numero: null, creado: null } : null;
  }
  if (!row || typeof row !== "object") return null;
  const token = esToken(row.token) ? row.token : esToken(row.pedido) ? row.pedido : "";
  if (!token) return null;
  return {
    token,
    numero: numeroDe(row.numero ?? row.numero_pedido),
    creado: fechaDe(row.creado || row.created_at || row.creado_en)
  };
}

function leerCrudo() {
  try {
    const data = JSON.parse(localStorage.getItem(LLAVE) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function normalizarLista(data) {
  const vistosTokens = new Set();
  const lista = [];
  for (const row of data) {
    const item = entrada(row);
    if (!item) continue;
    const clave = item.token.toLowerCase();
    if (vistosTokens.has(clave)) continue;
    vistosTokens.add(clave);
    lista.push(item);
    if (lista.length === TOPE) break;
  }
  return lista;
}

function persistir(lista) {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(lista.slice(0, TOPE)));
  } catch {
    return;
  }
}

export function leerPedidosLocal() {
  const crudo = leerCrudo();
  const lista = normalizarLista(crudo);
  if (JSON.stringify(crudo) !== JSON.stringify(lista)) persistir(lista);
  return lista;
}

export function reemplazarPedidosLocal(lista) {
  const normal = normalizarLista(lista);
  persistir(normal);
  return normal;
}

export function guardarPedidoLocal(dato) {
  const item = entrada(dato);
  if (!item) return;
  const previa = leerPedidosLocal().filter((row) => row.token.toLowerCase() !== item.token.toLowerCase());
  reemplazarPedidosLocal([item, ...previa]);
}

export function actualizarPedidoLocal(token, patch = {}) {
  if (!esToken(token)) return;
  const lista = leerPedidosLocal();
  const indice = lista.findIndex((row) => row.token.toLowerCase() === String(token).toLowerCase());
  const creado = fechaDe(patch.creado || patch.created_at) || (indice >= 0 ? lista[indice].creado : null);
  const numero = numeroDe(patch.numero) ?? (indice >= 0 ? lista[indice].numero : null);
  const item = { token, numero, creado };
  if (indice < 0) {
    guardarPedidoLocal(item);
    return;
  }
  lista[indice] = item;
  reemplazarPedidosLocal(lista);
}

export function quitarPedidoLocal(token) {
  reemplazarPedidosLocal(leerPedidosLocal().filter((row) => row.token.toLowerCase() !== String(token).toLowerCase()));
}

export function borrarPedidosLocal() {
  try {
    localStorage.removeItem(LLAVE);
  } catch {
    return;
  }
}

function marcaTiempo(pedido) {
  const tiempo = new Date(pedido?.created_at || pedido?.creado || 0).getTime();
  return Number.isFinite(tiempo) ? tiempo : 0;
}

export function fusionarEstados(locales, remotos, ahora = Date.now()) {
  const mapa = new Map();
  (remotos || []).forEach((pedido) => {
    if (pedido?.token && esToken(pedido.token)) mapa.set(String(pedido.token).toLowerCase(), pedido);
  });
  const lista = [];
  for (const row of normalizarLista(locales)) {
    const remoto = mapa.get(row.token.toLowerCase());
    const creado = fechaDe(remoto?.created_at) || row.creado;
    const numero = remoto && remoto.numero != null && remoto.numero !== "" ? remoto.numero : row.numero;
    const estado = remoto?.estado || "";
    const tiempo = creado ? new Date(creado).getTime() : NaN;
    const vencio = (estado === "entregado" || estado === "cancelado") && Number.isFinite(tiempo) && ahora - tiempo > VIGENCIA;
    if (vencio) continue;
    lista.push({ token: row.token, numero: numero ?? null, creado });
  }
  return lista.slice(0, TOPE);
}

export function ordenarPedidos(lista) {
  const peso = (pedido) => {
    if (pedido?.perdido) return 2;
    if (esActivo(pedido?.estado)) return 0;
    return 1;
  };
  return [...lista].sort((a, b) => {
    const dif = peso(a) - peso(b);
    if (dif) return dif;
    return marcaTiempo(b) - marcaTiempo(a);
  });
}

export function pedidoActivoReciente(lista) {
  return ordenarPedidos((lista || []).filter((pedido) => esActivo(pedido?.estado)))[0] || null;
}

export function cambiosDeEstado(lista) {
  const mensajes = [];
  (lista || []).forEach((pedido) => {
    if (!pedido?.token) return;
    const clave = String(pedido.token).toLowerCase();
    const antes = vistos.get(clave);
    const ahora = pedido.estado || "";
    if (baseEstados && antes && antes !== ahora) {
      const texto = textoCambioEstado(pedido);
      if (texto) mensajes.push(texto);
    }
    vistos.set(clave, ahora);
  });
  baseEstados = true;
  return mensajes;
}

export function llevaFormula(pedido) {
  if (!pedido) return false;
  if (esFormula(pedido.requiere_formula)) return true;
  if (pedido.formula_path) return true;
  if (pedido.estado === "revision") return true;
  return false;
}

export function pasosCliente(pedido) {
  const pasos = [["recibido", "Recibido"]];
  if (llevaFormula(pedido)) pasos.push(["revision", "En revisión"]);
  pasos.push(["camino", "En camino"], ["entregado", "Entregado"]);
  return pasos;
}

export function clasePasoCliente(pedido, clave, indice, pasos) {
  const estado = pedido?.estado;
  if (estado === "rechazado" || estado === "cancelado") return "";
  const orden = pasos.map(([id]) => id);
  const marca = (actual) => {
    if (actual < 0) return "";
    if (indice < actual) return "is-done";
    if (indice === actual) return "is-now";
    return "";
  };
  if (estado === "revision") return marca(orden.indexOf("revision"));
  if (estado === "pendiente_pago" || estado === "pagado") {
    const actual = orden.includes("revision") ? orden.indexOf("revision") : orden.indexOf("recibido");
    return marca(actual);
  }
  if (estado === "despachado") return marca(orden.indexOf("camino"));
  if (estado === "entregado") return marca(orden.indexOf("entregado"));
  if (clave === "recibido" && !estado) return "";
  return "";
}

function listaItems(valor) {
  let lista = valor;
  if (typeof valor === "string") {
    try {
      lista = JSON.parse(valor);
    } catch {
      lista = [];
    }
  }
  if (!Array.isArray(lista)) return [];
  return lista.map((item) => ({
    id: item.id || item.producto_id || null,
    nombre: item.nombre || item.producto || "Producto",
    marca: item.marca || "",
    presentacion: item.presentacion || "",
    cantidad: Number(item.cantidad) || 0,
    precio: item.precio == null || item.precio === "" ? null : Number(item.precio)
  }));
}

export function interpretarPedido(data) {
  if (!data) return null;
  if (typeof data === "string") return esToken(data) ? { token: data, items: [] } : null;
  if (Array.isArray(data)) return interpretarPedido(data[0]);
  if (typeof data !== "object") return null;
  if (data.pedido && typeof data.pedido === "object") return interpretarPedido({ ...data.pedido, token: data.token || data.pedido.token });
  const token = data.token || data.p_token || data.pedido_token || null;
  return {
    id: data.id || null,
    token,
    numero: data.numero ?? data.numero_pedido ?? null,
    estado: data.estado || "",
    total: data.total == null ? null : Number(data.total),
    subtotal: data.subtotal == null ? null : Number(data.subtotal),
    domicilio: data.domicilio == null ? null : Number(data.domicilio),
    nombre: data.nombre || data.cliente || "",
    telefono: data.telefono || data.celular || "",
    direccion: data.direccion || "",
    barrio: data.barrio || "",
    indicaciones: data.indicaciones || "",
    formula_path: data.formula_path || data.formula || "",
    requiere_formula: esFormula(data.requiere_formula),
    wompi_ref: data.wompi_ref || "",
    avisado: data.avisado === true,
    created_at: data.created_at || data.creado_en || data.fecha || null,
    items: listaItems(data.items || data.pedido_items || data.productos || data.detalle)
  };
}
