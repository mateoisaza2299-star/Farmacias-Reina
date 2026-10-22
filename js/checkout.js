import { leerConfig } from "./datos.js";
import { celularValido, dinero, mensajeError } from "./format.js";
import { itemsParaPedido, resumenCarrito, vaciarCarrito } from "./cart.js";
import { guardarPedidoLocal } from "./pedidos.js";
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

let configActual = { domicilio: 0, pedido_minimo: 0, abierto: true };
let enviando = false;

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
  if (!ok) mostrarError("Revisa los campos marcados para continuar.");
  else mostrarError("");
  if (!ok) {
    const primero = document.querySelector("[aria-invalid='true']");
    primero?.focus();
  }
  return ok;
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
      p_indicaciones: campo("indicaciones").value.trim(),
      p_formula_path: ruta
    });
    if (error) throw error;
    const pedido = data && typeof data === "object" && !Array.isArray(data) ? data : { token: data };
    const token = pedido.token || pedido.p_token || (Array.isArray(data) ? data[0]?.token : null) || (typeof data === "string" ? data : null);
    if (!token) throw new Error("No recibimos el número de seguimiento.");
    guardarPedidoLocal({
      token,
      numero: pedido.numero ?? pedido.numero_pedido ?? null,
      estado: pedido.estado || "",
      creado: new Date().toISOString()
    });
    vaciarCarrito();
    location.href = `seguimiento.html?pedido=${encodeURIComponent(token)}`;
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
