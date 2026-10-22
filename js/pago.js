import { negocio } from "./config.js";
import { dinero, soloDigitos } from "./format.js";

const MENSAJES_PAGO = {
  revision: "El regente está validando tu fórmula.",
  pagado: "Este pedido ya está pagado.",
  cancelado: "Este pedido fue cancelado.",
  rechazado: "Este pedido fue rechazado."
};

const FALLIDOS = new Set(["DECLINED", "ERROR", "VOIDED"]);

export function urlRetorno(token) {
  const carpeta = location.pathname.replace(/[^/]*$/, "");
  const destino = new URL(`${carpeta}seguimiento.html`, location.origin);
  destino.searchParams.set("pedido", token);
  destino.searchParams.set("pago", "1");
  return destino.href;
}

export function enlaceCheckout(datos, pedido) {
  const campos = [
    ["public-key", datos.publicKey],
    ["currency", "COP"],
    ["amount-in-cents", String(datos.centavos)],
    ["reference", datos.referencia],
    ["signature:integrity", datos.firma],
    ["redirect-url", urlRetorno(pedido.token)],
    ["customer-data:full-name", pedido?.nombre || ""],
    ["customer-data:phone-number", soloDigitos(pedido?.telefono)],
    ["customer-data:phone-number-prefix", "+57"]
  ];
  const query = campos.map(([clave, valor]) => `${encodeURIComponent(clave)}=${encodeURIComponent(valor)}`).join("&");
  return `https://checkout.wompi.co/p/?${query}`;
}

function avisoPrueba() {
  document.querySelectorAll("[data-pago-prueba]").forEach((nodo) => {
    nodo.hidden = false;
    nodo.textContent = "Pagos en modo de prueba";
  });
}

export async function iniciarPago(pedido) {
  const token = pedido?.token;
  if (!token) return { listo: false, mensaje: "No encontramos el pedido para pagar." };
  const { clavePublica, urlSupabase } = await import("./supabase.js");
  const respuesta = await fetch(`${urlSupabase}/functions/v1/crear-pago`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: clavePublica
    },
    body: JSON.stringify({ token })
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 409) {
    return { listo: false, estado: cuerpo.estado || "", mensaje: MENSAJES_PAGO[cuerpo.estado] || "Este pedido no admite pago en línea." };
  }
  if (!respuesta.ok || !cuerpo.publicKey || !cuerpo.referencia || cuerpo.centavos == null || !cuerpo.firma) {
    return { listo: false, mensaje: "No pudimos preparar el pago." };
  }
  const prueba = String(cuerpo.publicKey).startsWith("pub_test_");
  if (prueba) avisoPrueba();
  location.assign(enlaceCheckout(cuerpo, pedido));
  return { listo: true, prueba, mensaje: prueba ? "Pagos en modo de prueba" : "" };
}

export async function pagoRechazado(idTransaccion) {
  const id = String(idTransaccion || "").trim();
  if (!id) return false;
  const rutas = [
    `https://production.wompi.co/v1/transactions/${encodeURIComponent(id)}`,
    `https://sandbox.wompi.co/v1/transactions/${encodeURIComponent(id)}`
  ];
  for (const ruta of rutas) {
    try {
      const respuesta = await fetch(ruta);
      if (!respuesta.ok) continue;
      const cuerpo = await respuesta.json();
      const status = String(cuerpo?.data?.status || "").toUpperCase();
      if (!status) continue;
      return FALLIDOS.has(status);
    } catch {
      continue;
    }
  }
  return false;
}

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
  const formas = {
    EFECTIVO: "Efectivo",
    "DATÁFONO": "Datáfono",
    TRANSFERENCIA: "Transferencia"
  };
  const match = String(texto || "").match(/^Pago:\s*(EFECTIVO|DATÁFONO|TRANSFERENCIA)\.\s*([\s\S]*)$/);
  if (!match) return { forma: "", notas: String(texto || "").trim() };
  return { forma: formas[match[1]] || match[1], notas: match[2].trim() };
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

export function montarPago(contenedor, pedido, etiqueta = "Pagar ahora") {
  contenedor.replaceChildren();
  const aviso = document.createElement("p");
  aviso.className = "pay-note";
  aviso.dataset.pagoPrueba = "true";
  aviso.hidden = true;
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "btn btn-primary";
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.hidden = true;
  spinner.setAttribute("aria-hidden", "true");
  const texto = document.createElement("span");
  texto.textContent = etiqueta;
  boton.append(spinner, texto);
  const nota = document.createElement("p");
  nota.className = "fine";
  nota.textContent = "Pago seguro con Wompi: tarjeta, PSE, Nequi y Bancolombia. No guardamos los datos de tu tarjeta.";
  const error = document.createElement("p");
  error.className = "form-error";
  error.hidden = true;
  error.setAttribute("role", "alert");
  boton.addEventListener("click", async () => {
    if (boton.disabled) return;
    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");
    spinner.hidden = false;
    error.hidden = true;
    try {
      const resultado = await iniciarPago(pedido);
      if (!resultado.listo) {
        error.hidden = false;
        error.textContent = resultado.mensaje;
        boton.disabled = false;
        boton.removeAttribute("aria-busy");
        spinner.hidden = true;
      }
    } catch {
      error.hidden = false;
      error.textContent = "No pudimos preparar el pago.";
      boton.disabled = false;
      boton.removeAttribute("aria-busy");
      spinner.hidden = true;
    }
  });
  contenedor.append(aviso, boton, nota, error);
}
