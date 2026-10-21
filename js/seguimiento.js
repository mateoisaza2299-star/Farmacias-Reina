import { MENSAJE_REVISION, negocio } from "./config.js";
import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { dinero, fechaHora, mensajeError, soloDigitos } from "./format.js";
import { actualizarPedidoLocal, esToken, etiquetaEstado, interpretarPedido, leerPedidosLocal, PASOS } from "./pedidos.js";
import { enlaceWhatsappPedido, montarPago } from "./pago.js";
import { iniciarLayout } from "./layout.js";

let timer = 0;
let cargando = false;

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

function lineaEstados(estado) {
  const actual = pasoEstado(estado);
  const excepcional = estado === "rechazado" || estado === "cancelado";
  const lista = el("ol", { class: `steps ${excepcional ? "is-stopped" : ""}` });
  PASOS.forEach(([clave, etiqueta], indice) => {
    const clase = excepcional ? "" : indice < actual ? "is-done" : indice === actual ? "is-now" : "";
    lista.append(el("li", { class: clase }, el("span", { class: "step-dot", "aria-hidden": "true" }), el("span", {}, etiqueta)));
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
  if (pedido.estado === "revision") articulo.append(el("p", { class: "callout" }, MENSAJE_REVISION));
  if (pedido.estado === "rechazado") articulo.append(el("p", { class: "callout callout-warn" }, "No pudimos validar la fórmula de este pedido. Escríbenos y te contamos cómo corregirlo."));
  if (pedido.estado === "cancelado") articulo.append(el("p", { class: "callout callout-warn" }, "Este pedido fue cancelado."));
  if (pedido.items?.length) {
    articulo.append(el("ul", { class: "track-items" }, ...pedido.items.map((item) => el("li", {},
      el("span", {}, `${item.nombre}${item.presentacion ? ` · ${item.presentacion}` : ""} × ${item.cantidad}`),
      item.precio == null ? null : el("strong", {}, dinero(item.precio * item.cantidad))
    ))));
  }
  articulo.append(el("p", { class: "track-total" }, el("span", {}, "Total"), el("strong", {}, pedido.total == null ? "Por confirmar" : dinero(pedido.total))));
  articulo.append(lineaEstados(pedido.estado));
  if (pedido.estado === "pendiente_pago") {
    const pago = el("div", { class: "pay-box", "data-pago": "true" });
    articulo.append(pago);
    montarPago(pago, pedido);
  } else {
    const enlace = enlaceWhatsappPedido(pedido);
    if (enlace) {
      articulo.append(el("a", { class: "btn btn-whatsapp", href: enlace, target: "_blank", rel: "noopener noreferrer" }, "Escribir por WhatsApp"));
    } else if (!soloDigitos(negocio.whatsapp)) {
      articulo.append(el("p", { class: "hint" }, "WhatsApp se activa cuando el número queda configurado."));
    }
  }
  return articulo;
}

function vacio(mensaje) {
  return el("div", { class: "empty-state" },
    icono("box"),
    el("h2", {}, "Seguimiento"),
    el("p", {}, mensaje),
    el("a", { class: "btn btn-primary", href: "index.html" }, "Volver a la tienda")
  );
}

async function consultar(token) {
  const { data, error } = await supabase.rpc("estado_pedido", { p_token: token });
  if (error) throw error;
  const pedido = interpretarPedido(data);
  if (!pedido) return null;
  pedido.token = pedido.token || token;
  actualizarPedidoLocal(token, { numero: pedido.numero, estado: pedido.estado });
  return pedido;
}

async function refrescar() {
  if (cargando || document.visibilityState === "hidden") return;
  cargando = true;
  const raiz = document.querySelector("[data-seguimiento]");
  const tokens = tokensVisibles();
  if (!tokens.length) {
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
    raiz.replaceChildren();
    let alguno = false;
    pedidos.forEach((pedido) => {
      if (!pedido) {
        raiz.append(el("p", { class: "form-error", role: "alert" }, "No encontramos ese pedido. Revisa el enlace o escríbenos."));
        return;
      }
      if (pedido.error) {
        raiz.append(el("p", { class: "form-error", role: "alert" }, mensajeError(pedido.error)));
        return;
      }
      const destacado = pedido.token === principal || (!principal && !alguno);
      alguno = true;
      raiz.append(tarjeta(pedido, destacado));
    });
    if (!alguno && !raiz.childElementCount) raiz.append(vacio("No encontramos pedidos para mostrar."));
  } finally {
    cargando = false;
  }
}

function programar() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (document.visibilityState === "visible") refrescar();
  }, 30000);
}

iniciarLayout();
refrescar();
programar();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refrescar();
});
