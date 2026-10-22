import { negocio } from "./config.js";

const LLAVE = "pedidos_reina";

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

export function leerPedidosLocal() {
  try {
    const data = JSON.parse(localStorage.getItem(LLAVE) || "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((row) => row && esToken(row.token));
  } catch {
    return [];
  }
}

export function guardarPedidoLocal(entrada) {
  if (!entrada || !esToken(entrada.token)) return;
  const lista = leerPedidosLocal().filter((row) => row.token !== entrada.token);
  lista.unshift({
    token: entrada.token,
    numero: entrada.numero ?? null,
    estado: entrada.estado || "",
    creado: entrada.creado || new Date().toISOString()
  });
  localStorage.setItem(LLAVE, JSON.stringify(lista.slice(0, 20)));
}

export function actualizarPedidoLocal(token, patch) {
  const lista = leerPedidosLocal().map((row) => (row.token === token ? { ...row, ...patch, token } : row));
  localStorage.setItem(LLAVE, JSON.stringify(lista));
}

export function esToken(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor || ""));
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
    wompi_ref: data.wompi_ref || "",
    avisado: data.avisado === true,
    created_at: data.created_at || data.creado_en || data.fecha || null,
    items: listaItems(data.items || data.pedido_items || data.productos || data.detalle)
  };
}
