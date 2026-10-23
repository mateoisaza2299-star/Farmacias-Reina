import { negocio } from "./config.js";
import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { claveCatalogo, dinero, esFormula, fechaHora, mensajeError } from "./format.js";
import { sumarProducto } from "./cart.js";
import { enlaceWhatsapp } from "./pago.js";
import { abrirCarrito, avisar, iniciarLayout, pintarConteoPedidos } from "./layout.js";
import { actualizarInsignia } from "./pwa.js";
import { bloqueCancelar, pedirConfirmacion } from "./pedido-acciones.js";
import { bloqueEsqueleto, desdeEsqueleto, estadoFallo, marcarEsqueleto, vigilarLento } from "./motion.js";
import { COLUMNAS } from "./ui-producto.js";
import {
  borrarPedidosLocal,
  cambiosDeEstado,
  clasePasoCliente,
  esActivo,
  esToken,
  etiquetaEstado,
  fusionarEstados,
  interpretarPedido,
  leerPedidosLocal,
  ordenarPedidos,
  pasosCliente,
  puedeQuitar,
  quitarPedidoLocal,
  reemplazarPedidosLocal
} from "./pedidos.js";

const ESPERA = 30000;
const ESTADOS = new Set(["revision", "pendiente_pago", "pagado", "despachado", "entregado", "rechazado", "cancelado"]);
const ICONOS = {
  recibido: "check",
  revision: "pill",
  camino: "truck",
  entregado: "box"
};

let timer = 0;
let cargando = false;
let firmaActual = "";
let forzar = false;

function claseEstado(estado) {
  return ESTADOS.has(estado) ? estado : "otro";
}

function enlaceDrogueria(pedido) {
  const numero = pedido?.numero ? `#${pedido.numero}` : "";
  const texto = numero
    ? `Hola. Quiero información del pedido ${numero} en ${negocio.nombre}.`
    : `Hola. Quiero información de un pedido en ${negocio.nombre}.`;
  return enlaceWhatsapp(texto);
}

function mostrarNota(texto) {
  const nodo = document.querySelector("[data-pedido-nota]");
  if (!nodo) return;
  nodo.hidden = !texto;
  nodo.textContent = texto || "";
}

function linea(pedido) {
  const excepcional = pedido.estado === "rechazado" || pedido.estado === "cancelado";
  const lista = el("ol", { class: excepcional ? "steps steps-v is-stopped" : "steps steps-v" });
  pasosCliente(pedido).forEach(([clave, etiqueta], indice, pasos) => {
    const clase = excepcional ? "" : clasePasoCliente(pedido, clave, indice, pasos);
    const item = el("li", { class: clase },
      el("span", { class: "step-ico", "aria-hidden": "true" }, icono(ICONOS[clave] || "check")),
      el("span", {}, etiqueta)
    );
    if (clase === "is-now") item.setAttribute("aria-current", "step");
    lista.append(item);
  });
  return lista;
}

function resumenProductos(pedido) {
  if (!pedido.items?.length) return null;
  return el("ul", { class: "track-items" }, ...pedido.items.map((item) => el("li", {},
    el("span", {}, `${item.nombre}${item.presentacion ? ` · ${item.presentacion}` : ""} × ${item.cantidad}`)
  )));
}

function nombreItem(item) {
  return item.presentacion ? `${item.nombre} · ${item.presentacion}` : item.nombre;
}

async function volverAPedir(pedido, boton) {
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  if (!items.length) {
    mostrarNota("Este pedido no tiene productos para volver a pedir.");
    avisar("Este pedido no tiene productos para volver a pedir.");
    return;
  }
  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  try {
    const nombres = [...new Set(items.map((item) => String(item.nombre || "").trim()).filter(Boolean))];
    if (!nombres.length) {
      mostrarNota("Este pedido no tiene productos para volver a pedir.");
      avisar("Este pedido no tiene productos para volver a pedir.");
      return;
    }
    const { data, error } = await supabase.from("productos").select(COLUMNAS).in("nombre", nombres);
    if (error) throw error;
    const catalogo = new Map();
    (data || []).forEach((producto) => {
      catalogo.set(claveCatalogo(producto.nombre, producto.presentacion), producto);
    });
    const ausentes = [];
    const agotados = [];
    const formulas = [];
    const parciales = [];
    let agregados = 0;
    for (const item of items) {
      const producto = catalogo.get(claveCatalogo(item.nombre, item.presentacion));
      const visible = nombreItem(item);
      if (!producto || producto.activo === false) {
        ausentes.push(visible);
        continue;
      }
      if (esFormula(producto.requiere_formula)) {
        formulas.push(visible);
        continue;
      }
      const resultado = sumarProducto(producto, item.cantidad);
      if (!resultado.ok && resultado.motivo === "agotado") agotados.push(visible);
      else if (!resultado.ok) ausentes.push(visible);
      else {
        agregados += 1;
        if (resultado.parcial) parciales.push(`${visible}: quedaban ${resultado.agregado}`);
      }
    }
    const partes = [];
    if (agregados) partes.push(agregados === 1 ? "Agregamos 1 producto al carrito." : `Agregamos ${agregados} productos al carrito.`);
    if (ausentes.length) partes.push(`Ya no están: ${ausentes.join(", ")}.`);
    if (agotados.length) partes.push(`Agotados: ${agotados.join(", ")}.`);
    if (parciales.length) partes.push(`Quedaban menos unidades. ${parciales.join(". ")}.`);
    if (formulas.length) partes.push(`Requieren fórmula y no se agregan: ${formulas.join(", ")}.`);
    const texto = partes.join(" ") || "No pudimos agregar esos productos.";
    mostrarNota(texto);
    avisar(agregados ? "Productos agregados al carrito." : "Revisa qué productos no se pudieron agregar.");
    if (agregados) abrirCarrito();
  } catch (error) {
    const texto = mensajeError(error);
    mostrarNota(texto);
    avisar(texto);
  } finally {
    if (boton.isConnected) {
      boton.disabled = false;
      boton.removeAttribute("aria-busy");
    }
  }
}

function acciones(pedido) {
  const caja = el("div", { class: "pedido-acciones" });
  if (esToken(pedido.token)) {
    caja.append(el("a", {
      class: "btn btn-primary",
      href: `seguimiento.html?pedido=${encodeURIComponent(pedido.token)}`
    }, "Ver detalle"));
  }
  if (!pedido.perdido) {
    const repetir = el("button", { type: "button", class: "btn btn-ghost" }, "Volver a pedir");
    repetir.addEventListener("click", () => volverAPedir(pedido, repetir));
    caja.append(repetir);
  }
  const cancelar = bloqueCancelar(pedido, () => {
    forzar = true;
    return refrescar();
  });
  if (cancelar) caja.append(cancelar);
  const whatsapp = enlaceDrogueria(pedido);
  if (whatsapp) {
    caja.append(el("a", {
      class: "btn btn-whatsapp",
      href: whatsapp,
      target: "_blank",
      rel: "noopener noreferrer"
    }, "Escribir a la droguería"));
  }
  if (puedeQuitar(pedido.estado)) {
    const quitar = el("button", { type: "button", class: "btn btn-ghost" }, "Quitar de este dispositivo");
    quitar.addEventListener("click", () => {
      quitarPedidoLocal(pedido.token);
      forzar = true;
      refrescar();
    });
    caja.append(quitar);
  }
  return caja;
}

function tarjeta(pedido) {
  if (pedido.perdido) {
    const titulo = pedido.numero ? `Pedido #${pedido.numero}` : "Pedido";
    return el("article", { class: "track-card" },
      el("h2", {}, titulo),
      el("p", {}, "No encontramos este pedido. Si acabas de hacerlo, espera un momento y vuelve a abrir esta página."),
      acciones(pedido)
    );
  }
  const articulo = el("article", { class: "track-card" });
  const cuando = fechaHora(pedido.created_at || pedido.creado);
  articulo.append(el("div", { class: "track-top" },
    el("h2", {}, pedido.numero ? `Pedido #${pedido.numero}` : "Pedido"),
    el("span", { class: `status status-${claseEstado(pedido.estado)}` }, etiquetaEstado(pedido.estado))
  ));
  if (cuando) articulo.append(el("p", { class: "hint" }, cuando));
  const productos = resumenProductos(pedido);
  if (productos) {
    articulo.append(el("h3", { class: "track-resumen" }, "Resumen del pedido"));
    articulo.append(productos);
  }
  articulo.append(el("p", { class: "track-total" },
    el("span", {}, "Total"),
    el("strong", {}, pedido.total == null ? "Por confirmar" : dinero(pedido.total))
  ));
  articulo.append(linea(pedido));
  articulo.append(acciones(pedido));
  return articulo;
}

function vacio() {
  return el("div", { class: "empty-state" },
    el("div", { class: "vacio-arte", "aria-hidden": "true" }, icono("box")),
    el("h2", {}, "Aún no tienes pedidos en este dispositivo"),
    el("p", {}, "Tus pedidos se guardan solo en este dispositivo. Si cambiaste de celular, escríbenos con tu número de pedido."),
    el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ir al catálogo")
  );
}

function herramientas() {
  const barra = el("div", { class: "pedido-herramientas" });
  const boton = el("button", { type: "button", class: "btn btn-ghost" }, "Borrar mi historial");
  boton.addEventListener("click", () => {
    if (barra.querySelector(".confirma")) return;
    boton.hidden = true;
    pedirConfirmacion(barra, "¿Borrar todos los pedidos de este dispositivo?", "Borrar mi historial", async () => {
      borrarPedidosLocal();
      mostrarNota("");
      forzar = true;
      await refrescar();
    }, () => {
      boton.hidden = false;
    });
  });
  barra.append(boton);
  return barra;
}

function firmaDe(pedidos) {
  return JSON.stringify(pedidos.map((pedido) => [
    pedido.estado || "",
    pedido.numero ?? "",
    pedido.total ?? "",
    pedido.perdido ? 1 : 0,
    (pedido.items || []).map((item) => [item.nombre, item.presentacion, item.cantidad, item.precio])
  ]));
}

function ayudaVisible(hay) {
  const ayuda = document.querySelector("[data-pedido-ayuda]");
  if (ayuda) ayuda.hidden = !hay;
}

async function consultar(tokens) {
  const { data, error } = await supabase.rpc("estado_pedidos", { p_tokens: tokens });
  if (error) throw error;
  const filas = Array.isArray(data) ? data : [];
  return filas.map((row) => interpretarPedido(row)).filter(Boolean);
}

async function refrescar() {
  if (cargando || document.visibilityState === "hidden") return;
  cargando = true;
  const raiz = document.querySelector("[data-lista-pedidos]");
  if (!raiz) {
    cargando = false;
    return;
  }
  const locales = leerPedidosLocal();
  ayudaVisible(locales.length > 0);
  if (!locales.length) {
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(vacio());
    pintarConteoPedidos(0);
    actualizarInsignia(0);
    firmaActual = "";
    cargando = false;
    return;
  }
  const primera = !raiz.dataset.visto;
  if (primera) {
    raiz.dataset.visto = "1";
    if (!raiz.querySelector(".skeleton")) raiz.replaceChildren(bloqueEsqueleto(), bloqueEsqueleto());
    if (!raiz.dataset.sk) marcarEsqueleto(raiz);
    raiz.setAttribute("aria-busy", "true");
    vigilarLento(raiz, () => {
      raiz.dataset.visto = "";
      refrescar();
    });
  }
  try {
    const remotos = await consultar(locales.map((row) => row.token));
    const depurados = reemplazarPedidosLocal(fusionarEstados(leerPedidosLocal(), remotos));
    const mapa = new Map(remotos.filter((pedido) => esToken(pedido.token)).map((pedido) => [pedido.token.toLowerCase(), pedido]));
    const vigentes = new Set(depurados.map((row) => row.token.toLowerCase()));
    const pedidos = ordenarPedidos(depurados.map((row) => {
      const remoto = mapa.get(row.token.toLowerCase());
      if (!remoto) {
        return { token: row.token, numero: row.numero, creado: row.creado, estado: "", items: [], perdido: true };
      }
      return { ...remoto, numero: remoto.numero ?? row.numero, created_at: remoto.created_at || row.creado };
    }).filter((pedido) => vigentes.has(String(pedido.token).toLowerCase())));
    const activos = pedidos.filter((pedido) => esActivo(pedido.estado)).length;
    pintarConteoPedidos(activos);
    actualizarInsignia(activos);
    cambiosDeEstado(pedidos).forEach((texto) => avisar(texto));
    const firma = firmaDe(pedidos);
    if (!forzar && !primera && firma === firmaActual) return;
    forzar = false;
    firmaActual = firma;
    if (raiz.querySelector(".skeleton")) await desdeEsqueleto(raiz);
    raiz.setAttribute("aria-busy", "false");
    if (!pedidos.length) {
      ayudaVisible(false);
      raiz.replaceChildren(vacio());
      return;
    }
    raiz.replaceChildren(herramientas(), ...pedidos.map(tarjeta));
  } catch (error) {
    if (raiz.querySelector(".skeleton")) await desdeEsqueleto(raiz);
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(estadoFallo(mensajeError(error), () => {
      raiz.dataset.visto = "";
      firmaActual = "";
      forzar = true;
      refrescar();
    }));
  } finally {
    cargando = false;
  }
}

function programar() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    refrescar();
  }, ESPERA);
}

iniciarLayout();
refrescar();
programar();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refrescar();
});
