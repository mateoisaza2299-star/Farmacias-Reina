import { dinero, fechaHora } from "./format.js";

const DIA = 86400000;

export const MOTIVOS_PEDIDO = [
  ["sin stock", "Sin stock"],
  ["cliente no responde", "Cliente no responde"],
  ["fórmula ilegible", "Fórmula ilegible"],
  ["dirección fuera de cobertura", "Dirección fuera de cobertura"],
  ["otro", "Otro"]
];

export const MOTIVOS_FORMULA = [
  ["ilegible", "Ilegible"],
  ["vencida", "Vencida"],
  ["no coincide el medicamento", "No coincide el medicamento"],
  ["falta firma", "Falta firma"],
  ["otro", "Otro"]
];

export const REVISION = [
  ["vigente", "Vigente"],
  ["legible", "Legible"],
  ["paciente", "Con nombre del paciente"],
  ["coincide", "Con los medicamentos que coinciden con el pedido"],
  ["firma", "Con firma del médico"]
];

export function partesBogota(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(fecha);
  const mapa = {};
  partes.forEach((parte) => {
    mapa[parte.type] = parte.value;
  });
  return {
    y: Number(mapa.year),
    m: Number(mapa.month),
    d: Number(mapa.day),
    h: Number(mapa.hour),
    min: Number(mapa.minute)
  };
}

export function inicioDiaBogota(fecha = new Date()) {
  const p = partesBogota(fecha);
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 5, 0, 0));
}

function fechaInput(valor, fin) {
  const match = String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (fin) return new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59));
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
}

export function rangos(clave, ahora = new Date(), desdeTexto = "", hastaTexto = "") {
  if (clave === "personalizado") {
    const desde = fechaInput(desdeTexto, false);
    const hasta = fechaInput(hastaTexto, true);
    if (!desde || !hasta || hasta < desde) return null;
    const duracion = hasta.getTime() - desde.getTime();
    return {
      desde,
      hasta,
      prevDesde: new Date(desde.getTime() - duracion),
      prevHasta: desde
    };
  }
  const hasta = ahora;
  const desde = clave === "hoy" ? inicioDiaBogota(ahora) : new Date(hasta.getTime() - (clave === "30" ? 30 : 7) * DIA);
  const duracion = Math.max(0, hasta.getTime() - desde.getTime());
  return {
    desde,
    hasta,
    prevDesde: new Date(desde.getTime() - duracion),
    prevHasta: desde
  };
}

export function saludo(fecha = new Date()) {
  const hora = partesBogota(fecha).h;
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function fechaLarga(fecha = new Date()) {
  const texto = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function variacion(actual, anterior) {
  const a = Number(actual);
  const b = Number(anterior);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (b === 0) return a === 0 ? 0 : null;
  return Math.round(((a - b) / Math.abs(b)) * 100);
}

function num(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function numONulo(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function fuente(data) {
  if (Array.isArray(data)) return data[0] || {};
  if (data && typeof data === "object") return data;
  return {};
}

function lista(valor) {
  if (Array.isArray(valor)) return valor;
  if (valor && typeof valor === "object") {
    return Object.entries(valor).map(([clave, item]) => {
      if (item && typeof item === "object") return { ...item, clave };
      return { clave, valor: item };
    });
  }
  return [];
}

function pares(valor, campo) {
  return lista(valor).map((item) => ({
    nombre: String(item[campo] || item.nombre || item.clave || item.estado || item.forma || ""),
    valor: num(item.pedidos ?? item.cantidad ?? item.valor ?? item.total ?? (typeof item === "number" ? item : 0))
  })).filter((item) => item.nombre && item.valor > 0);
}

function filas(valor, nombres, cantidades) {
  return lista(valor).map((item) => {
    let nombre = "";
    for (const campo of nombres) {
      if (item[campo]) {
        nombre = String(item[campo]);
        break;
      }
    }
    if (!nombre && item.clave) nombre = String(item.clave);
    let valor = 0;
    for (const campo of cantidades) {
      if (item[campo] != null) {
        valor = num(item[campo]);
        break;
      }
    }
    if (!valor && item.valor != null) valor = num(item.valor);
    return { nombre, valor };
  }).filter((item) => item.nombre);
}

function dias(valor) {
  return lista(valor).map((item) => ({
    dia: item.dia || item.fecha || item.date || item.clave || "",
    ventas: num(item.ventas ?? item.total ?? 0),
    pedidos: num(item.pedidos ?? item.cantidad ?? 0)
  })).filter((item) => item.dia);
}

function horas(valor) {
  const salida = Array(24).fill(0);
  if (Array.isArray(valor) && valor.every((item) => typeof item === "number" || item == null)) {
    valor.forEach((item, indice) => {
      if (indice < 24) salida[indice] = num(item);
    });
    return salida;
  }
  lista(valor).forEach((item) => {
    const hora = Number(item.hora ?? item.hour ?? item.clave);
    if (hora >= 0 && hora < 24) salida[hora] = num(item.pedidos ?? item.cantidad ?? item.valor ?? item);
  });
  return salida;
}

function margen(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (valor && typeof valor === "object") {
    const n = valor.valor ?? valor.margen ?? valor.total ?? valor.estimado;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

export function leerResumen(data) {
  const src = fuente(data);
  return {
    pedidos: num(src.pedidos),
    cancelados: num(src.cancelados),
    ventas: num(src.ventas),
    porCobrar: num(src.por_cobrar),
    ticket: num(src.ticket_promedio),
    conFormula: num(src.con_formula),
    minutosEntrega: numONulo(src.minutos_entrega),
    minutosAprobacion: numONulo(src.minutos_aprobacion),
    porEstado: pares(src.por_estado, "estado"),
    porDia: dias(src.por_dia),
    horas: horas(src.horas),
    barrios: filas(src.barrios, ["barrio", "nombre"], ["pedidos", "cantidad"]).slice(0, 8),
    formasPago: pares(src.formas_pago, "forma"),
    top: filas(src.top_productos, ["nombre", "producto"], ["cantidad", "pedidos", "total"]).slice(0, 10),
    margen: margen(src.margen)
  };
}

export function leerClientes(data) {
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    for (const clave of ["total", "clientes", "cantidad", "activos"]) {
      if (typeof data[clave] === "number") return data[clave];
    }
  }
  return null;
}

export function formaClave(texto) {
  const t = String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t.includes("efect")) return "efectivo";
  if (t.includes("data") || t.includes("tarjet")) return "datafono";
  if (t.includes("trans")) return "transferencia";
  return t ? "otra" : "";
}

export function etiquetaForma(clave) {
  if (clave === "efectivo") return "Efectivo";
  if (clave === "datafono") return "Datáfono";
  if (clave === "transferencia") return "Transferencia";
  if (clave === "otra") return "Otra";
  return "";
}

export function minutosDesde(valor, ahora = Date.now()) {
  const tiempo = new Date(valor || 0).getTime();
  if (!tiempo) return 0;
  return Math.max(0, Math.floor((ahora - tiempo) / 60000));
}

export function nivelEspera(minutos) {
  if (minutos > 30) return "rojo";
  if (minutos >= 15) return "ambar";
  return "verde";
}

export function porDespachar(estado, pagoEnLinea) {
  if (pagoEnLinea) return estado === "pagado";
  return estado === "pendiente_pago" || estado === "pagado";
}

export function esActivo(estado) {
  return estado === "revision" || estado === "pendiente_pago" || estado === "pagado" || estado === "despachado";
}

export function textoEspera(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export function dentroDe(valor, desde, hasta) {
  const tiempo = new Date(valor || 0).getTime();
  if (!tiempo) return false;
  return tiempo >= desde && tiempo <= hasta;
}

export function diaBogota(valor) {
  const fecha = new Date(valor || 0);
  if (Number.isNaN(fecha.getTime())) return "";
  const p = partesBogota(fecha);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function textoResumen(pedido, nombreNegocio) {
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  const lineas = [
    nombreNegocio || "Droguerías Reina",
    pedido?.numero ? `Pedido N.º ${pedido.numero}` : "Pedido",
    fechaHora(pedido?.created_at),
    pedido?.nombre || "",
    pedido?.telefono || "",
    [pedido?.direccion, pedido?.barrio].filter(Boolean).join(", "),
    ...items.map((item) => {
      const presentacion = item.presentacion ? ` (${item.presentacion})` : "";
      const cantidad = Number(item.cantidad) || 0;
      const precio = item.precio == null || item.precio === "" ? "" : ` ${dinero(Number(item.precio) * cantidad)}`;
      return `${item.nombre}${presentacion} x ${cantidad}${precio}`;
    }),
    pedido?.subtotal != null ? `Subtotal: ${dinero(pedido.subtotal)}` : "",
    pedido?.domicilio != null ? `Domicilio: ${dinero(pedido.domicilio)}` : "",
    `Total: ${pedido?.total == null ? "por confirmar" : dinero(pedido.total)}`,
    pedido?.forma_pago ? `Forma de pago: ${pedido.forma_pago}` : "",
    pedido?.notas ? `Indicaciones: ${pedido.notas}` : ""
  ].filter(Boolean);
  return lineas.join("\n").replace(/https?:\/\/\S+/gi, "").replace(/[ \t]{2,}/g, " ").trim();
}

export function filaAuditable(row) {
  const permitidos = ["created_at", "fecha", "accion", "action", "evento", "tabla", "entidad", "estado", "resultado", "modulo"];
  const salida = [];
  for (const clave of permitidos) {
    const valor = row?.[clave];
    if (valor == null || typeof valor === "object") continue;
    const texto = String(valor).trim();
    if (!texto || texto.length > 120) continue;
    if (/@/.test(texto) || /https?:/i.test(texto) || /\d{7,}/.test(texto)) continue;
    salida.push([clave, texto]);
  }
  return salida;
}

export function venceRevision(valor, ahora = Date.now()) {
  const tiempo = new Date(valor || 0).getTime();
  if (!tiempo) return false;
  return ahora - tiempo > 30 * DIA;
}
