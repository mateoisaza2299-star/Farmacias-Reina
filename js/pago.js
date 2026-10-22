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
      mensaje: "Pago en línea disponible muy pronto",
      ...datos
    };
  }
  return {
    listo: true,
    mensaje: "Pago en línea listo para continuar.",
    ...datos
  };
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
  if (negocio.beta) return "";
  const destino = soloDigitos(negocio.whatsapp);
  if (!destino) return "";
  return `https://wa.me/${destino}?text=${encodeURIComponent(resumenWhatsapp(pedido))}`;
}

export function mensajeAviso(pedido) {
  const numero = pedido?.numero ? `N.º ${pedido.numero}` : "tu pedido";
  const saludo = pedido?.nombre ? `Hola ${pedido.nombre}.` : "Hola.";
  const textos = {
    revision: `${saludo} Recibimos tu pedido ${numero} en ${negocio.nombre}. Quedó en revisión de la fórmula médica.`,
    pendiente_pago: `${saludo} Tu pedido ${numero} en ${negocio.nombre} fue aprobado y está pendiente de pago.`,
    pagado: `${saludo} Confirmamos el pago de tu pedido ${numero} en ${negocio.nombre}.`,
    despachado: `${saludo} Tu pedido ${numero} de ${negocio.nombre} ya fue despachado.`,
    entregado: `${saludo} Tu pedido ${numero} de ${negocio.nombre} fue entregado. Gracias por tu compra.`,
    rechazado: `${saludo} No pudimos validar la fórmula del pedido ${numero}. Escríbenos y te ayudamos a corregirlo.`,
    cancelado: `${saludo} Tu pedido ${numero} en ${negocio.nombre} fue cancelado.`
  };
  return sinEnlaces(textos[pedido?.estado] || `${saludo} Te escribimos de ${negocio.nombre} por el pedido ${numero}.`);
}

export function enlaceAvisarCliente(pedido) {
  if (negocio.beta) return "";
  let destino = soloDigitos(pedido?.telefono || "");
  if (destino.length === 10) destino = `57${destino}`;
  if (!destino) return "";
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensajeAviso(pedido))}`;
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
  if (negocio.beta) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-whatsapp";
    boton.disabled = true;
    boton.textContent = "Disponible muy pronto";
    boton.setAttribute("aria-label", "Enviar pedido, disponible muy pronto");
    contenedor.append(boton);
    return resultado;
  }
  const enlace = enlaceWhatsappPedido(pedido);
  if (enlace) {
    const boton = document.createElement("a");
    boton.className = "btn btn-whatsapp";
    boton.href = enlace;
    boton.target = "_blank";
    boton.rel = "noopener noreferrer";
    boton.textContent = "Enviar pedido";
    contenedor.append(boton);
  }
  return resultado;
}
