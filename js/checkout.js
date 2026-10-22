import { negocio } from "./config.js";
import { leerConfig } from "./datos.js";
import { celularValido, dinero, mensajeError } from "./format.js";
import { itemsParaPedido, resumenCarrito, vaciarCarrito } from "./cart.js";
import { guardarPedidoLocal } from "./pedidos.js";
import { enlaceWhatsapp, enlaceWhatsappPedido, mensajePedidoWhatsapp, montarPago } from "./pago.js";
import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { iniciarLayout, pintarProgreso } from "./layout.js";
import { animarDinero } from "./motion.js";
import { guardarDatosCliente, leerDatosCliente } from "./memoria.js";

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
  animarDinero(caja.querySelector("[data-subtotal]"), datos.subtotal);
  animarDinero(caja.querySelector("[data-domicilio]"), datos.domicilio);
  animarDinero(caja.querySelector("[data-total]"), datos.total);
  pintarProgreso(caja, datos);
  const minimo = caja.querySelector("[data-minimo]");
  const corto = hay && datos.falta > 0;
  if (minimo) {
    minimo.hidden = !corto || datos.minimo > 0;
    minimo.textContent = corto && !(datos.minimo > 0) ? `El pedido mínimo es ${dinero(datos.minimo)}. Te faltan ${dinero(datos.falta)}.` : "";
  }
  marcarPaso(hay ? "datos" : "carrito");
  const formula = document.querySelector("[data-formula]");
  formula.hidden = !datos.requiereFormula;
  const cerrado = configActual.abierto === false;
  const boton = document.querySelector("[data-enviar]");
  boton.disabled = !hay || corto || cerrado || enviando;
  let etiqueta = boton.querySelector(".btn-label");
  if (!etiqueta) {
    etiqueta = document.createElement("span");
    etiqueta.className = "btn-label";
    boton.replaceChildren(etiqueta);
  }
  etiqueta.textContent = cerrado ? "Pago no disponible" : "Confirmar pedido";
  if (enviando && !boton.style.getPropertyValue("--btn-w")) boton.style.setProperty("--btn-w", `${boton.offsetWidth}px`);
  if (!enviando) boton.style.removeProperty("--btn-w");
  boton.classList.toggle("is-busy", enviando);
  if (enviando) boton.setAttribute("aria-busy", "true");
  else boton.removeAttribute("aria-busy");
  const rx = document.querySelector("[data-rx-resumen]");
  if (rx) rx.hidden = !datos.requiereFormula;
}

function campo(nombre) {
  return document.querySelector(`[name="${nombre}"]`);
}

function marcarPaso(nombre) {
  const orden = ["carrito", "datos", "confirmacion"];
  const actual = orden.indexOf(nombre);
  document.querySelectorAll("[data-paso]").forEach((li) => {
    const indice = orden.indexOf(li.dataset.paso);
    li.classList.toggle("is-done", indice > -1 && indice < actual);
    li.classList.toggle("is-now", indice === actual);
    if (indice === actual) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
}

function mensajeCampo(input, datos) {
  if (input.name === "nombre") return input.value.trim().length >= 3 ? "" : "Escribe tu nombre completo.";
  if (input.name === "telefono") return celularValido(input.value) ? "" : "Celular inválido. Debe tener 10 dígitos y empezar por 3.";
  if (input.name === "direccion") return input.value.trim().length >= 5 ? "" : "Escribe la dirección de entrega.";
  if (input.name === "barrio") return input.value.trim().length >= 2 ? "" : "Escribe el barrio de entrega.";
  if (input.name === "politica") return input.checked ? "" : "Debes aceptar la política de tratamiento de datos.";
  if (input.name === "formula") return datos?.requiereFormula ? validarArchivo(input.files?.[0]) : "";
  if (input.name === "salud") return datos?.requiereFormula ? (input.checked ? "" : "Necesitamos tu autorización para tratar la fórmula como dato de salud.") : "";
  return "";
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
  ok = marcar(nombre, mensajeCampo(nombre, datos)) && ok;
  ok = marcar(telefono, mensajeCampo(telefono, datos)) && ok;
  ok = marcar(direccion, mensajeCampo(direccion, datos)) && ok;
  ok = marcar(barrio, mensajeCampo(barrio, datos)) && ok;
  ok = marcar(politica, mensajeCampo(politica, datos)) && ok;
  if (datos.requiereFormula) {
    ok = marcar(archivo, mensajeCampo(archivo, datos)) && ok;
    ok = marcar(salud, mensajeCampo(salud, datos)) && ok;
  } else {
    marcar(archivo, "");
    marcar(salud, "");
  }
  ok = validarPago() && ok;
  if (!ok) mostrarError("Revisa los campos marcados para continuar.");
  else mostrarError("");
  if (!ok) {
    const primero = document.querySelector("[aria-invalid='true']");
    primero?.focus();
  }
  return ok;
}

function formaElegida() {
  const elegido = document.querySelector("input[name='pago']:checked");
  if (!elegido || elegido.disabled) return "";
  if (elegido.value === "EN_LINEA" && !negocio.pagoEnLinea) return "";
  return elegido.value;
}

function esRecibir(forma) {
  return forma === "EFECTIVO" || forma === "TRANSFERENCIA";
}

function validarPago() {
  const forma = formaElegida();
  const ok = esRecibir(forma) || forma === "EN_LINEA";
  const ayuda = document.getElementById("pago-error");
  document.querySelectorAll("input[name='pago']").forEach((radio) => {
    if (radio.disabled) {
      radio.removeAttribute("aria-invalid");
      return;
    }
    radio.setAttribute("aria-invalid", ok ? "false" : "true");
  });
  if (ayuda) {
    ayuda.hidden = ok;
    ayuda.textContent = ok ? "" : "Elige cómo vas a pagar al recibir.";
  }
  return ok;
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
      formaVisible(pedido),
      pedido.formula ? el("p", {}, "Fórmula médica adjunta en la página") : null
    );
  }
  const wa = document.querySelector("[data-exito-wa]");
  const enLinea = pedido.pagoLinea === true && !pedido.formula;
  if (enLinea) {
    if (wa) wa.hidden = true;
    const zona = document.querySelector("[data-exito-pago]");
    if (zona) {
      zona.hidden = false;
      montarPago(zona, pedido, "Pagar en línea");
      if (negocio.pagoAlRecibir !== false) zona.append(opcionRecibir(pedido));
    }
  } else if (wa) {
    const href = enlaceWhatsappPedido(pedido);
    if (href) wa.href = href;
  }
  const seguir = document.querySelector("[data-exito-seguir]");
  if (seguir && pedido.token) seguir.href = `seguimiento.html?pedido=${encodeURIComponent(pedido.token)}`;
  const pasos = document.querySelector("[data-exito-pasos]");
  if (pasos) {
    const entrega = String(configActual.tiempoEntrega || "").trim();
    pasos.replaceChildren(
      el("h2", {}, "Qué sigue"),
      el("ol", { class: "siguientes" },
        el("li", {}, pedido.numero ? `Tu pedido quedó como número ${pedido.numero}. Guárdalo para el seguimiento.` : "Guardamos el pedido en este dispositivo para que puedas seguirlo."),
        el("li", {}, pedido.formula ? "El regente de farmacia revisa la fórmula antes de despachar." : "Preparamos los productos para el domicilio."),
        el("li", {}, pedido.pagoLinea ? "Puedes completar el pago en línea o pagar al recibir." : "Pagas al recibir, en efectivo o por transferencia."),
        entrega ? el("li", {}, `Tiempo estimado de entrega: ${entrega}.`) : null,
        el("li", {}, "Abre el seguimiento para ver el estado. Si necesitas algo, escribe a la droguería.")
      )
    );
  }
  marcarPaso("confirmacion");
  if (exito) exito.hidden = false;
}

function formaVisible(pedido) {
  const nodo = el("p", { "data-exito-forma": "true" }, `Forma de pago: ${pedido.formaPago || ""}`);
  if (!pedido.formaPago) nodo.hidden = true;
  return nodo;
}

function opcionRecibir(pedido) {
  const caja = el("section", { class: "pay-choice" });
  const wa = el("a", {
    class: "btn btn-whatsapp",
    target: "_blank",
    rel: "noopener noreferrer",
    hidden: true
  }, "Enviar pedido por WhatsApp");
  const elegir = (forma) => {
    pedido.formaPago = FORMAS[forma] || "";
    pedido.indicaciones = `Pago: ${forma}. ${pedido.notas || ""}`.trim();
    const formaNodo = document.querySelector("[data-exito-forma]");
    if (formaNodo) {
      formaNodo.hidden = false;
      formaNodo.textContent = `Forma de pago: ${pedido.formaPago}`;
    }
    const href = enlaceWhatsapp(mensajePedidoWhatsapp(pedido));
    if (href) {
      wa.href = href;
      wa.hidden = false;
    }
    supabase.from("pedidos").update({ indicaciones: pedido.indicaciones }).eq("token", pedido.token).then(() => {}, () => {});
  };
  caja.append(el("p", {}, "Pagar al recibir"));
  Object.entries(FORMAS).forEach(([forma, etiqueta]) => {
    const input = el("input", { type: "radio", name: "recibir", value: forma });
    input.addEventListener("change", () => elegir(forma));
    caja.append(el("label", { class: "check" }, input, el("span", {}, etiqueta)));
  });
  caja.append(wa);
  return caja;
}

function prepararPago() {
  const tarjeta = document.querySelector("[data-pay-online]");
  const radio = tarjeta?.querySelector("input[name='pago']");
  const aviso = document.querySelector("[data-pay-soon]");
  if (!tarjeta || !radio) return;
  const mostrarAviso = () => {
    if (!radio.disabled || !aviso) return;
    aviso.hidden = false;
  };
  tarjeta.addEventListener("click", mostrarAviso);
  tarjeta.addEventListener("focusin", mostrarAviso);
  tarjeta.addEventListener("keydown", (evento) => {
    if (!radio.disabled) return;
    if (evento.key !== " " && evento.key !== "Enter") return;
    evento.preventDefault();
    mostrarAviso();
  });
  if (!negocio.pagoEnLinea) return;
  radio.disabled = false;
  tarjeta.removeAttribute("aria-disabled");
  tarjeta.removeAttribute("tabindex");
  const badge = document.querySelector("[data-pay-badge]");
  const candado = document.querySelector("[data-pay-lock]");
  if (badge) badge.hidden = true;
  if (candado) candado.hidden = true;
  if (aviso) aviso.hidden = true;
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
  const forma = formaElegida();
  const enLinea = forma === "EN_LINEA";
  const notas = campo("indicaciones").value.trim();
  const indicaciones = esRecibir(forma) ? `Pago: ${forma}. ${notas}`.trim() : notas;
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
      pagoLinea: enLinea,
      formula: Boolean(ruta),
      formula_path: ruta
    };
    const guardar = campo("guardar");
    if (guardar?.checked) {
      guardarDatosCliente({
        nombre: campo("nombre").value.trim(),
        telefono: campo("telefono").value.replace(/\D/g, ""),
        direccion: campo("direccion").value.trim(),
        barrio: campo("barrio").value.trim()
      });
    }
    confirmado = true;
    vaciarCarrito();
    if (enLinea && ruta) {
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

function mostrarEntrega(cfg) {
  const nodo = document.querySelector("[data-entrega]");
  if (!nodo) return;
  const texto = String(cfg?.tiempoEntrega || "").trim();
  nodo.hidden = !texto;
  nodo.textContent = texto ? `Tiempo estimado de entrega: ${texto}` : "";
}

function restaurarDatos() {
  const guardados = leerDatosCliente();
  if (!guardados) return;
  ["nombre", "telefono", "direccion", "barrio"].forEach((nombre) => {
    const input = campo(nombre);
    if (input && !input.value && guardados[nombre]) input.value = guardados[nombre];
  });
}

function prepararValidacion() {
  ["nombre", "telefono", "direccion", "barrio", "politica", "formula", "salud"].forEach((nombre) => {
    const input = campo(nombre);
    if (!input) return;
    const correr = () => {
      if (input.dataset.tocado !== "1") return;
      marcar(input, mensajeCampo(input, resumen()));
      const alguno = document.querySelector("[aria-invalid='true']");
      if (!alguno) mostrarError("");
    };
    input.addEventListener("blur", () => {
      input.dataset.tocado = "1";
      correr();
    });
    input.addEventListener("input", correr);
    input.addEventListener("change", () => {
      input.dataset.tocado = "1";
      correr();
    });
  });
}

function iniciarCheckout() {
  prepararPago();
  restaurarDatos();
  prepararValidacion();
  mostrarEntrega(configActual);
  document.querySelector("#pedido")?.addEventListener("submit", enviar);
  escucharArchivo();
  document.addEventListener("reina:carrito", pintarResumen);
  document.addEventListener("reina:config", (evento) => {
    configActual = evento.detail;
    mostrarEntrega(configActual);
    pintarResumen();
  });
  document.addEventListener("reina:barrio", (evento) => {
    const select = campo("barrio");
    if (select && evento.detail) select.value = evento.detail;
  });
  leerConfig().then((cfg) => {
    configActual = cfg;
    mostrarEntrega(cfg);
    pintarResumen();
  });
  pintarResumen();
}

iniciarLayout();
iniciarCheckout();
