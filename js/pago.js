import { negocio } from "./config.js";
import { dinero, soloDigitos } from "./format.js";

const WOMPI_PUBLIC_KEY = "";
const WOMPI_MONEDA = "COP";

export function referenciaPedido(pedido) {
  if (pedido?.numero) return `REINA-${pedido.numero}`;
  const token = String(pedido?.token || "").replace(/-/g, "").slice(0, 10);
  return `REINA-${token || "PEDIDO"}`;
}

export function datosWompi(pedido) {
  const total = Number(pedido?.total);
  return {
    publicKey: WOMPI_PUBLIC_KEY,
    referencia: referenciaPedido(pedido),
    moneda: WOMPI_MONEDA,
    montoEnCentavos: Number.isFinite(total) ? Math.round(total * 100) : 0
  };
}

export function iniciarPago(pedido) {
  const datos = datosWompi(pedido);
  if (!datos.publicKey) {
    return {
      listo: false,
      mensaje: "Falta configurar el pago en línea.",
      ...datos
    };
  }
  return {
    listo: true,
    mensaje: "Pago en línea listo para continuar.",
    ...datos
  };
}

const FORMAS = {
  EFECTIVO: "Efectivo",
  "DATÁFONO": "Datáfono",
  TRANSFERENCIA: "Transferencia"
};

export function numeroWhatsapp() {
  return soloDigitos(negocio.modoPrueba ? negocio.whatsappPrueba : negocio.whatsappPedidos);
}

export function enlaceWhatsapp(texto = "") {
  const destino = numeroWhatsapp();
  if (!destino) return "";
  if (!texto) return `https://wa.me/${destino}`;
  return `https://wa.me/${destino}?text=${encodeURIComponent(sinEnlaces(texto))}`;
}

export function separarPago(texto) {
  const match = String(texto || "").match(/^Pago:\s*(EFECTIVO|DATÁFONO|TRANSFERENCIA)\.\s*([\s\S]*)$/);
  if (!match) return { forma: "", notas: String(texto || "").trim() };
  return { forma: FORMAS[match[1]] || match[1], notas: match[2].trim() };
}

export function mensajePedidoWhatsapp(pedido) {
  const separado = separarPago(pedido?.indicaciones);
  const forma = pedido?.formaPago || separado.forma;
  const notas = pedido?.notas != null ? pedido.notas : separado.notas;
  const numero = pedido?.numero ? `#${pedido.numero}` : "";
  const titulo = numero ? `🛒 Pedido ${numero} · ${negocio.nombre}` : `🛒 Pedido · ${negocio.nombre}`;
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  const lineasPedido = items.map((item) => {
    const presentacion = item.presentacion ? ` (${item.presentacion})` : "";
    const cantidad = Number(item.cantidad) || 0;
    const precio = item.precio == null || item.precio === "" ? "" : ` ${dinero(Number(item.precio) * cantidad)}`;
    return `${item.nombre}${presentacion} x ${cantidad}${precio}`;
  });
  const partes = [
    titulo,
    ...lineasPedido,
    `Subtotal: ${dinero(pedido?.subtotal)}`,
    `Domicilio: ${dinero(pedido?.domicilio)}`,
    `Total: ${dinero(pedido?.total)}`,
    `Nombre: ${pedido?.nombre || ""}`,
    `Celular: ${pedido?.telefono || ""}`,
    `Dirección: ${pedido?.direccion || ""}`,
    `Barrio: ${pedido?.barrio || ""}`,
    `Indicaciones: ${notas || ""}`,
    `Forma de pago: ${forma || ""}`
  ];
  if (pedido?.formula || pedido?.formula_path) partes.push("Fórmula médica adjunta en la página");
  return sinEnlaces(partes.join("\n"));
}

function sinEnlaces(texto) {
  return String(texto || "").replace(/https?:\/\/\S+/gi, "").replace(/\s{2,}/g, " ").trim();
}

function lineas(pedido) {
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  if (!items.length) return "";
  return items.map((item) => `- ${item.nombre}${item.presentacion ? ` (${item.presentacion})` : ""} x ${item.cantidad}`).join("\n");
}

export function resumenWhatsapp(pedido) {
  const numero = pedido?.numero ? `N.º ${pedido.numero}` : "sin número visible";
  const quien = pedido?.nombre ? `Soy ${pedido.nombre}. ` : "";
  const detalle = lineas(pedido);
  const total = pedido?.total == null ? "" : `\nTotal: ${dinero(pedido.total)}`;
  return sinEnlaces(`Hola. ${quien}Hice el pedido ${numero} en ${negocio.nombre}.${detalle ? `\n${detalle}` : ""}${total}\nQuiero coordinar el pago.`);
}

export function enlaceWhatsappPedido(pedido) {
  const texto = negocio.pagoEnLinea ? resumenWhatsapp(pedido) : mensajePedidoWhatsapp(pedido);
  return enlaceWhatsapp(texto);
}

export function mensajeAviso(pedido) {
  const numero = pedido?.numero ? `N.º ${pedido.numero}` : "tu pedido";
  const saludo = pedido?.nombre ? `Hola ${pedido.nombre}.` : "Hola.";
  const pendiente = negocio.pagoEnLinea
    ? `${saludo} Tu pedido ${numero} en ${negocio.nombre} fue aprobado y está pendiente de pago.`
    : `${saludo} Tu pedido ${numero} en ${negocio.nombre} está por despachar. El pago es al recibir.`;
  const textos = {
    revision: `${saludo} Recibimos tu pedido ${numero} en ${negocio.nombre}. Quedó en revisión de la fórmula médica.`,
    pendiente_pago: pendiente,
    pagado: `${saludo} Confirmamos el pago de tu pedido ${numero} en ${negocio.nombre}.`,
    despachado: `${saludo} Tu pedido ${numero} de ${negocio.nombre} ya fue despachado.`,
    entregado: `${saludo} Tu pedido ${numero} de ${negocio.nombre} fue entregado. Gracias por tu compra.`,
    rechazado: `${saludo} No pudimos validar la fórmula del pedido ${numero}. Escríbenos y te ayudamos a corregirlo.`,
    cancelado: `${saludo} Tu pedido ${numero} en ${negocio.nombre} fue cancelado.`
  };
  return sinEnlaces(textos[pedido?.estado] || `${saludo} Te escribimos de ${negocio.nombre} por el pedido ${numero}.`);
}

export function enlaceAvisarCliente(pedido) {
  const texto = mensajeAviso(pedido);
  if (negocio.modoPrueba) return enlaceWhatsapp(texto);
  let destino = soloDigitos(pedido?.telefono || "");
  if (destino.length === 10) destino = `57${destino}`;
  if (!destino) return "";
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}

export function montarPago(contenedor, pedido) {
  const resultado = iniciarPago(pedido);
  contenedor.replaceChildren();
  contenedor.dataset.referencia = resultado.referencia;
  contenedor.dataset.moneda = resultado.moneda;
  contenedor.dataset.monto = String(resultado.montoEnCentavos);
  if (resultado.publicKey) contenedor.dataset.publicKey = resultado.publicKey;
  else delete contenedor.dataset.publicKey;
  const nota = document.createElement("p");
  nota.className = "pay-note";
  nota.textContent = resultado.mensaje;
  contenedor.append(nota);
  const enlace = enlaceWhatsappPedido(pedido);
  if (enlace) {
    const boton = document.createElement("a");
    boton.className = "btn btn-whatsapp";
    boton.href = enlace;
    boton.target = "_blank";
    boton.rel = "noopener noreferrer";
    boton.textContent = "Enviar pedido por WhatsApp";
    contenedor.append(boton);
  }
  return resultado;
}
