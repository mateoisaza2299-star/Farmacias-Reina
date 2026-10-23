import { MENSAJE_REVISION, negocio } from "./config.js";
import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { dinero, fechaHora, mensajeError } from "./format.js";
import { actualizarPedidoLocal, clasePasoCliente, esToken, etiquetaEstado, interpretarPedido, leerPedidosLocal, PASOS, pasosCliente } from "./pedidos.js";
import { bloqueCancelar } from "./pedido-acciones.js";
import { enlaceWhatsappPedido, montarPago, pagoRechazado, separarPago } from "./pago.js";
import { iniciarLayout } from "./layout.js";
import { bloqueEsqueleto, desdeEsqueleto, estadoFallo, marcarEsqueleto, vigilarLento } from "./motion.js";

let timer = 0;
let cargando = false;
let pagoFallido = false;
let pagoListo = false;

function vuelveDePago() {
  if (!negocio.pagoEnLinea) return false;
  const params = new URLSearchParams(location.search);
  return params.get("pago") === "1" || params.has("id");
}

const inicioPago = vuelveDePago() ? Date.now() : 0;

function confirmando() {
  return vuelveDePago() && !pagoFallido && !pagoListo && Date.now() - inicioPago < 120000;
}

function tokenPrincipal() {
  const params = new URLSearchParams(location.search);
  const pedido = params.get("pedido") || "";
  return esToken(pedido) ? pedido : "";
}

function tokensVisibles() {
  const principal = tokenPrincipal();
  const guardados = leerPedidosLocal().map((row) => row.token);
  const lista = principal ? [principal, ...guardados.filter((token) => token !== principal)] : guardados;
  return [...new Set(lista)].slice(0, 10);
}

function pasoEstado(estado) {
  return PASOS.findIndex(([clave]) => clave === estado);
}

function iconoPaso(clave) {
  const mapa = {
    recibido: "check",
    revision: "pill",
    pendiente_pago: "card",
    pagado: "check",
    despachado: "truck",
    camino: "truck",
    entregado: "box",
    rechazado: "close",
    cancelado: "close"
  };
  return mapa[clave] || "check";
}

function paso(clave, etiqueta, clase) {
  const item = el("li", { class: clase },
    el("span", { class: "step-ico", "aria-hidden": "true" }, icono(iconoPaso(clave))),
    el("span", {}, etiqueta)
  );
  if (clase === "is-now") item.setAttribute("aria-current", "step");
  return item;
}

function lineaEstados(pedido) {
  const excepcional = pedido.estado === "rechazado" || pedido.estado === "cancelado";
  const lista = el("ol", { class: `steps steps-v ${excepcional ? "is-stopped" : ""}` });
  if (negocio.pagoEnLinea) {
    const actual = pasoEstado(pedido.estado);
    PASOS.forEach(([clave, etiqueta], indice) => {
      const clase = excepcional ? "" : indice < actual ? "is-done" : indice === actual ? "is-now" : "";
      lista.append(paso(clave, etiqueta, clase));
    });
    return lista;
  }
  const pasos = pasosCliente(pedido);
  pasos.forEach(([clave, etiqueta], indice) => {
    lista.append(paso(clave, etiqueta, clasePasoCliente(pedido, clave, indice, pasos)));
  });
  return lista;
}

function tarjeta(pedido, destacado) {
  const articulo = el("article", { class: `track-card ${destacado ? "is-main" : ""}` });
  const numero = pedido.numero ? `Pedido N.º ${pedido.numero}` : "Pedido";
  articulo.append(
    el("div", { class: "track-top" },
      el("h2", {}, numero),
      el("span", { class: `status status-${pedido.estado || "otro"}` }, etiquetaEstado(pedido.estado))
    )
  );
  if (pedido.created_at) articulo.append(el("p", { class: "hint" }, fechaHora(pedido.created_at)));
  if (pedido.estado === "revision") {
    const aviso = negocio.pagoEnLinea
      ? MENSAJE_REVISION
      : "Tu pedido quedó en revisión. Nuestro regente validará la fórmula antes de despacharlo.";
    articulo.append(el("p", { class: "callout" }, aviso));
  }
  if (pedido.estado === "rechazado") articulo.append(el("p", { class: "callout callout-warn" }, "No pudimos validar la fórmula de este pedido. Escríbenos y te contamos cómo corregirlo."));
  if (pedido.estado === "cancelado") articulo.append(el("p", { class: "callout callout-warn" }, "Este pedido fue cancelado."));
  if (pedido.items?.length) {
    articulo.append(el("h3", { class: "track-resumen" }, "Resumen del pedido"));
    articulo.append(el("ul", { class: "track-items" }, ...pedido.items.map((item) => el("li", {},
      el("span", {}, `${item.nombre}${item.presentacion ? ` · ${item.presentacion}` : ""} × ${item.cantidad}`),
      item.precio == null ? null : el("strong", {}, dinero(item.precio * item.cantidad))
    ))));
  }
  articulo.append(el("p", { class: "track-total" }, el("span", {}, "Total"), el("strong", {}, pedido.total == null ? "Por confirmar" : dinero(pedido.total))));
  articulo.append(lineaEstados(pedido));
  const cancelar = bloqueCancelar(pedido, () => refrescar());
  if (cancelar) articulo.append(cancelar);
  const confirmar = destacado && vuelveDePago();
  const recibir = Boolean(separarPago(pedido.indicaciones).forma);
  if (confirmar && pedido.estado === "pagado") {
    articulo.append(exitoPago(pedido));
  } else if (confirmar && pagoFallido && pedido.estado === "pendiente_pago") {
    articulo.append(el("p", { class: "callout callout-warn" }, "No se pudo completar el pago"));
    const reintento = el("div", { class: "pay-box" });
    articulo.append(reintento);
    montarPago(reintento, pedido, "Reintentar pago");
  } else if (confirmar && pedido.estado === "pendiente_pago") {
    const tarde = Date.now() - inicioPago >= 120000;
    const texto = tarde
      ? "Tu pago está siendo verificado. Te avisaremos apenas se confirme."
      : "Estamos confirmando tu pago…";
    articulo.append(el("p", { class: "callout", role: "status" }, texto));
  } else if (negocio.pagoEnLinea && pedido.estado === "pendiente_pago" && !recibir) {
    const pago = el("div", { class: "pay-box" });
    articulo.append(pago);
    montarPago(pago, pedido, "Pagar ahora");
  } else {
    const enlace = enlaceWhatsappPedido(pedido);
    const etiqueta = "Escribir a la droguería";
    if (enlace) articulo.append(el("a", { class: "btn btn-whatsapp", href: enlace, target: "_blank", rel: "noopener noreferrer" }, etiqueta));
  }
  return articulo;
}

function exitoPago(pedido) {
  const enlace = enlaceWhatsappPedido(pedido);
  return el("div", { class: "pay-result" },
    el("span", { class: "pay-check", "aria-hidden": "true" }),
    el("p", { class: "pay-result-title" }, "Pago confirmado"),
    enlace ? el("a", { class: "btn btn-whatsapp", href: enlace, target: "_blank", rel: "noopener noreferrer" }, "Enviar pedido por WhatsApp") : null
  );
}

function vacio(mensaje) {
  return el("div", { class: "empty-state" },
    el("div", { class: "vacio-arte", "aria-hidden": "true" }, icono("box")),
    el("h2", {}, "Seguimiento"),
    el("p", {}, mensaje),
    el("a", { class: "btn btn-primary", href: "index.html" }, "Volver a la tienda")
  );
}

const estadosPrevios = new Map();

async function consultar(token) {
  const { data, error } = await supabase.rpc("estado_pedido", { p_token: token });
  if (error) throw error;
  const pedido = interpretarPedido(data);
  if (!pedido) return null;
  pedido.token = pedido.token || token;
  actualizarPedidoLocal(token, { numero: pedido.numero, creado: pedido.created_at });
  return pedido;
}

async function refrescar() {
  if (cargando || document.visibilityState === "hidden") return;
  cargando = true;
  const raiz = document.querySelector("[data-seguimiento]");
  const primera = raiz && !raiz.dataset.visto;
  if (primera) {
    raiz.dataset.visto = "1";
    if (!raiz.querySelector(".callout")) {
      if (!raiz.querySelector(".skeleton")) raiz.replaceChildren(bloqueEsqueleto(), bloqueEsqueleto());
      if (!raiz.dataset.sk) marcarEsqueleto(raiz);
      raiz.setAttribute("aria-busy", "true");
      vigilarLento(raiz, () => {
        raiz.dataset.visto = "";
        refrescar();
      });
    }
  }
  const tokens = tokensVisibles();
  if (!tokens.length) {
    if (primera && raiz.querySelector(".skeleton")) await desdeEsqueleto(raiz);
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(vacio("Cuando hagas un pedido, aquí verás su estado. También puedes abrir el enlace que te entregamos al confirmar."));
    cargando = false;
    return;
  }
  try {
    const pedidos = await Promise.all(tokens.map(async (token) => {
      try {
        return await consultar(token);
      } catch (error) {
        return { token, error };
      }
    }));
    const principal = tokenPrincipal();
    const idPago = new URLSearchParams(location.search).get("id");
    if (vuelveDePago() && idPago && !pagoFallido) {
      const actual = pedidos.find((pedido) => pedido && !pedido.error && pedido.token === principal);
      if (actual?.estado === "pendiente_pago" && await pagoRechazado(idPago)) pagoFallido = true;
    }
    if (pedidos.some((pedido) => pedido && !pedido.error && pedido.token === principal && pedido.estado === "pagado")) pagoListo = true;
    if (primera && raiz.querySelector(".skeleton")) await desdeEsqueleto(raiz);
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren();
    let alguno = false;
    pedidos.forEach((pedido) => {
      if (!pedido) {
        raiz.append(el("p", { class: "form-error", role: "alert" }, "No encontramos ese pedido. Revisa el enlace o escríbenos."));
        return;
      }
      if (pedido.error) {
        raiz.append(estadoFallo(mensajeError(pedido.error), () => {
          raiz.dataset.visto = "";
          refrescar();
        }));
        return;
      }
      const destacado = pedido.token === principal || (!principal && !alguno);
      alguno = true;
      const nodo = tarjeta(pedido, destacado);
      if (estadosPrevios.has(pedido.token) && estadosPrevios.get(pedido.token) !== pedido.estado) nodo.classList.add("is-cambio");
      estadosPrevios.set(pedido.token, pedido.estado || "");
      raiz.append(nodo);
    });
    if (!alguno && !raiz.childElementCount) raiz.append(vacio("No encontramos pedidos para mostrar."));
  } finally {
    cargando = false;
  }
}

function esperaRefresco() {
  if (confirmando()) return 3000;
  return 30000;
}

function programar() {
  clearInterval(timer);
  const espera = esperaRefresco();
  timer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    refrescar().finally(() => {
      if (esperaRefresco() !== espera) programar();
    });
  }, espera);
}

iniciarLayout();
if (vuelveDePago()) {
  document.querySelector("[data-seguimiento]")?.replaceChildren(
    el("p", { class: "callout", role: "status" }, "Estamos confirmando tu pago…")
  );
}
refrescar();
programar();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refrescar();
});
