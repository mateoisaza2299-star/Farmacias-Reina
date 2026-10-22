import { negocio } from "./config.js";
import { leerConfig } from "./datos.js";
import { celularValido, dinero, mensajeError } from "./format.js";
import { itemsParaPedido, resumenCarrito, vaciarCarrito } from "./cart.js";
import { guardarPedidoLocal } from "./pedidos.js";
import { enlaceWhatsappPedido } from "./pago.js";
import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { iniciarLayout } from "./layout.js";

const TIPOS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};
const EXTENSIONES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
const LIMITE = 5 * 1024 * 1024;

const FORMAS = {
  EFECTIVO: "Efectivo",
  "DATÁFONO": "Datáfono",
  TRANSFERENCIA: "Transferencia"
};

let configActual = { domicilio: 0, pedido_minimo: 0, abierto: true };
let enviando = false;
let confirmado = false;

function resumen() {
  return resumenCarrito(configActual.domicilio, configActual.pedido_minimo);
}

function mostrarError(texto) {
  const caja = document.querySelector("[data-form-error]");
  if (!caja) return;
  caja.hidden = !texto;
  caja.textContent = texto || "";
}

function validarArchivo(archivo) {
  if (!archivo) return "Falta la fórmula médica. Adjunta la foto o el PDF vigente para continuar.";
  const extension = (archivo.name.split(".").pop() || "").toLowerCase();
  const tipo = TIPOS[archivo.type] ? archivo.type : EXTENSIONES[extension];
  if (!tipo || !EXTENSIONES[extension] && !TIPOS[archivo.type]) {
    return "La fórmula debe ser JPG, PNG, WEBP o PDF.";
  }
  if (!TIPOS[archivo.type] && !EXTENSIONES[extension]) return "La fórmula debe ser JPG, PNG, WEBP o PDF.";
  if (archivo.size > LIMITE) return "La fórmula supera 5 MB. Adjunta un archivo más liviano.";
  return "";
}

function tipoArchivo(archivo) {
  if (TIPOS[archivo.type]) return { tipo: archivo.type === "image/jpg" ? "image/jpeg" : archivo.type, ext: TIPOS[archivo.type] };
  const extension = (archivo.name.split(".").pop() || "").toLowerCase();
  const tipo = EXTENSIONES[extension];
  return { tipo, ext: extension === "jpeg" ? "jpg" : extension };
}

function pintarResumen() {
  if (confirmado) return;
  const datos = resumen();
  const lista = document.querySelector("[data-resumen-items]");
  const vacio = document.querySelector("[data-vacio]");
  const caja = document.querySelector("[data-checkout-box]");
  if (!lista || !caja) return;
  const hay = datos.items.length > 0;
  if (vacio) vacio.hidden = hay;
  caja.hidden = !hay;
  lista.replaceChildren(...datos.items.map((item) => el("li", {},
    el("span", {}, `${item.nombre}${item.presentacion ? ` · ${item.presentacion}` : ""} × ${item.cantidad}`),
    el("strong", {}, dinero(item.precio * item.cantidad))
  )));
  caja.querySelector("[data-subtotal]").textContent = dinero(datos.subtotal);
  caja.querySelector("[data-domicilio]").textContent = dinero(datos.domicilio);
  caja.querySelector("[data-total]").textContent = dinero(datos.total);
  const minimo = caja.querySelector("[data-minimo]");
  const corto = hay && datos.falta > 0;
  minimo.hidden = !corto;
  minimo.textContent = corto ? `El pedido mínimo es ${dinero(datos.minimo)}. Te faltan ${dinero(datos.falta)}.` : "";
  const formula = document.querySelector("[data-formula]");
  formula.hidden = !datos.requiereFormula;
  const cerrado = configActual.abierto === false;
  const boton = document.querySelector("[data-enviar]");
  boton.disabled = !hay || corto || cerrado || enviando;
  boton.textContent = cerrado ? "Pago no disponible" : enviando ? "Enviando pedido…" : "Confirmar pedido";
  const rx = document.querySelector("[data-rx-resumen]");
  if (rx) rx.hidden = !datos.requiereFormula;
}

function campo(nombre) {
  return document.querySelector(`[name="${nombre}"]`);
}

function marcar(input, mensaje) {
  const ayuda = document.getElementById(`${input.name}-error`);
  input.setAttribute("aria-invalid", mensaje ? "true" : "false");
  if (ayuda) {
    ayuda.hidden = !mensaje;
    ayuda.textContent = mensaje || "";
  }
  return !mensaje;
}

function validarFormulario(datos) {
  let ok = true;
  const nombre = campo("nombre");
  const telefono = campo("telefono");
  const direccion = campo("direccion");
  const barrio = campo("barrio");
  const politica = campo("politica");
  const salud = campo("salud");
  const archivo = campo("formula");
  ok = marcar(nombre, nombre.value.trim().length >= 3 ? "" : "Escribe tu nombre completo.") && ok;
  ok = marcar(telefono, celularValido(telefono.value) ? "" : "Celular inválido. Debe tener 10 dígitos y empezar por 3.") && ok;
  ok = marcar(direccion, direccion.value.trim().length >= 5 ? "" : "Escribe la dirección de entrega.") && ok;
  ok = marcar(barrio, barrio.value.trim().length >= 2 ? "" : "Escribe el barrio de entrega.") && ok;
  ok = marcar(politica, politica.checked ? "" : "Debes aceptar la política de tratamiento de datos.") && ok;
  if (datos.requiereFormula) {
    ok = marcar(archivo, validarArchivo(archivo.files[0])) && ok;
    ok = marcar(salud, salud.checked ? "" : "Necesitamos tu autorización para tratar la fórmula como dato de salud.") && ok;
  } else {
    marcar(archivo, "");
    marcar(salud, "");
  }
  if (!negocio.pagoEnLinea) ok = validarPago() && ok;
  if (!ok) mostrarError("Revisa los campos marcados para continuar.");
  else mostrarError("");
  if (!ok) {
    const primero = document.querySelector("[aria-invalid='true']");
    primero?.focus();
  }
  return ok;
}

function validarPago() {
  const elegido = document.querySelector("input[name='pago']:checked");
  const ayuda = document.getElementById("pago-error");
  document.querySelectorAll("input[name='pago']").forEach((radio) => {
    radio.setAttribute("aria-invalid", elegido ? "false" : "true");
  });
  if (ayuda) {
    ayuda.hidden = Boolean(elegido);
    ayuda.textContent = elegido ? "" : "Elige cómo vas a pagar al recibir.";
  }
  return Boolean(elegido);
}

function filaResumen(etiqueta, valor) {
  return el("div", { class: "sum-row" }, el("span", {}, etiqueta), el("strong", {}, valor));
}

function mostrarExito(pedido) {
  const caja = document.querySelector("[data-checkout-box]");
  const vacio = document.querySelector("[data-vacio]");
  const lead = document.querySelector(".hero-lead");
  const titulo = document.querySelector("main h1");
  const exito = document.querySelector("[data-exito]");
  if (caja) caja.hidden = true;
  if (vacio) vacio.hidden = true;
  if (lead) lead.hidden = true;
  if (titulo) titulo.textContent = "Pedido recibido";
  const numero = document.querySelector("[data-exito-numero]");
  if (numero) numero.textContent = pedido.numero ? `Pedido #${pedido.numero}` : "Pedido recibido";
  const resumenNodo = document.querySelector("[data-exito-resumen]");
  if (resumenNodo) {
    const items = Array.isArray(pedido.items) ? pedido.items : [];
    resumenNodo.replaceChildren(
      el("h2", {}, "Resumen"),
      el("ul", {}, ...items.map((item) => el("li", {},
        el("span", {}, `${item.nombre}${item.presentacion ? ` · ${item.presentacion}` : ""} × ${item.cantidad}`),
        el("strong", {}, dinero(Number(item.precio) * Number(item.cantidad)))
      ))),
      filaResumen("Subtotal", dinero(pedido.subtotal)),
      filaResumen("Domicilio", dinero(pedido.domicilio)),
      el("div", { class: "sum-row sum-total" }, el("span", {}, "Total"), el("strong", {}, dinero(pedido.total))),
      el("p", {}, `Nombre: ${pedido.nombre || ""}`),
      el("p", {}, `Celular: ${pedido.telefono || ""}`),
      el("p", {}, `Dirección: ${pedido.direccion || ""}`),
      el("p", {}, `Barrio: ${pedido.barrio || ""}`),
      el("p", {}, `Indicaciones: ${pedido.notas || ""}`),
      el("p", {}, `Forma de pago: ${pedido.formaPago || ""}`),
      pedido.formula ? el("p", {}, "Fórmula médica adjunta en la página") : null
    );
  }
  const wa = document.querySelector("[data-exito-wa]");
  const href = enlaceWhatsappPedido(pedido);
  if (wa && href) wa.href = href;
  const seguir = document.querySelector("[data-exito-seguir]");
  if (seguir && pedido.token) seguir.href = `seguimiento.html?pedido=${encodeURIComponent(pedido.token)}`;
  if (exito) exito.hidden = false;
}

function prepararPago() {
  const bloque = document.querySelector("[data-pago-recibir]");
  if (bloque) bloque.hidden = negocio.pagoEnLinea === true;
}

async function subirFormula(archivo) {
  const { tipo, ext } = tipoArchivo(archivo);
  const ruta = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("formulas").upload(ruta, archivo, {
    contentType: tipo || "application/octet-stream",
    upsert: false
  });
  if (error) throw error;
  return ruta;
}

async function enviar(evento) {
  evento.preventDefault();
  if (enviando) return;
  const datos = resumen();
  if (!datos.items.length) return;
  if (configActual.abierto === false) {
    mostrarError("Por ahora no estamos recibiendo pedidos.");
    return;
  }
  if (datos.falta > 0) {
    mostrarError(`Pedido mínimo. El valor de los productos no alcanza ${dinero(datos.minimo)}.`);
    return;
  }
  if (!validarFormulario(datos)) return;
  const forma = negocio.pagoEnLinea ? "" : (document.querySelector("input[name='pago']:checked")?.value || "");
  const notas = campo("indicaciones").value.trim();
  const indicaciones = forma ? `Pago: ${forma}. ${notas}`.trim() : notas;
  enviando = true;
  pintarResumen();
  let ruta = null;
  try {
    if (datos.requiereFormula) ruta = await subirFormula(campo("formula").files[0]);
    const { data, error } = await supabase.rpc("crear_pedido", {
      p_items: itemsParaPedido(),
      p_nombre: campo("nombre").value.trim(),
      p_telefono: campo("telefono").value.replace(/\D/g, ""),
      p_direccion: campo("direccion").value.trim(),
      p_barrio: campo("barrio").value.trim(),
      p_indicaciones: indicaciones,
      p_formula_path: ruta
    });
    if (error) throw error;
    const pedido = data && typeof data === "object" && !Array.isArray(data) ? data : { token: data };
    const token = pedido.token || pedido.p_token || (Array.isArray(data) ? data[0]?.token : null) || (typeof data === "string" ? data : null);
    if (!token) throw new Error("No recibimos el número de seguimiento.");
    const numero = pedido.numero ?? pedido.numero_pedido ?? null;
    const estado = pedido.estado || (datos.requiereFormula ? "revision" : "pendiente_pago");
    guardarPedidoLocal({
      token,
      numero,
      estado,
      creado: new Date().toISOString()
    });
    const armado = {
      token,
      numero,
      estado,
      items: datos.items.map((item) => ({ ...item })),
      subtotal: datos.subtotal,
      domicilio: datos.domicilio,
      total: datos.total,
      nombre: campo("nombre").value.trim(),
      telefono: campo("telefono").value.replace(/\D/g, ""),
      direccion: campo("direccion").value.trim(),
      barrio: campo("barrio").value.trim(),
      indicaciones,
      notas,
      formaPago: FORMAS[forma] || "",
      formula: Boolean(ruta),
      formula_path: ruta
    };
    confirmado = true;
    vaciarCarrito();
    if (negocio.pagoEnLinea) {
      location.href = `seguimiento.html?pedido=${encodeURIComponent(token)}`;
      return;
    }
    mostrarExito(armado);
  } catch (error) {
    if (ruta) supabase.storage.from("formulas").remove([ruta]).catch(() => {});
    mostrarError(mensajeError(error));
    enviando = false;
    pintarResumen();
  }
}

function escucharArchivo() {
  const input = campo("formula");
  const nombre = document.querySelector("[data-archivo]");
  input?.addEventListener("change", () => {
    const archivo = input.files[0];
    const error = archivo ? validarArchivo(archivo) : "";
    if (error && archivo) {
      input.value = "";
      if (nombre) nombre.textContent = "";
      marcar(input, error);
      return;
    }
    marcar(input, "");
    if (nombre) nombre.textContent = archivo ? `${archivo.name} · ${(archivo.size / 1024 / 1024).toFixed(2)} MB` : "";
  });
}

function iniciarCheckout() {
  prepararPago();
  document.querySelector("#pedido")?.addEventListener("submit", enviar);
  escucharArchivo();
  document.addEventListener("reina:carrito", pintarResumen);
  document.addEventListener("reina:config", (evento) => {
    configActual = evento.detail;
    pintarResumen();
  });
  document.addEventListener("reina:barrio", (evento) => {
    const select = campo("barrio");
    if (select && evento.detail) select.value = evento.detail;
  });
  leerConfig().then((cfg) => {
    configActual = cfg;
    pintarResumen();
  });
  pintarResumen();
}

iniciarLayout();
iniciarCheckout();
