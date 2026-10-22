import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { mensajeError } from "./format.js";
import { puedeCancelar } from "./pedidos.js";

const MENSAJE = "Ese pedido ya no se puede cancelar. Escríbenos por WhatsApp";

function aviso(texto) {
  return el("p", { class: "callout callout-warn", role: "alert" }, texto);
}

export function pedirConfirmacion(zona, texto, aceptar, onOk, onCerrar) {
  const caja = el("div", { class: "confirma", role: "group", "aria-label": texto });
  const si = el("button", { type: "button", class: "btn btn-danger" }, aceptar);
  const no = el("button", { type: "button", class: "btn btn-ghost" }, "Volver");
  let ocupado = false;
  const cerrar = () => {
    caja.remove();
    if (onCerrar) onCerrar();
  };
  si.addEventListener("click", async () => {
    if (ocupado) return;
    ocupado = true;
    si.disabled = true;
    try {
      await onOk();
    } catch (error) {
      ocupado = false;
      si.disabled = false;
      caja.append(aviso(mensajeError(error)));
    }
  });
  no.addEventListener("click", cerrar);
  caja.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    evento.preventDefault();
    cerrar();
  });
  caja.append(el("p", {}, texto), si, no);
  zona.append(caja);
  si.focus();
  return caja;
}

export function bloqueCancelar(pedido, alCambiar) {
  if (!pedido || !puedeCancelar(pedido.estado) || !pedido.token) return null;
  const zona = el("div", { class: "pedido-cancelar" });
  const boton = el("button", { type: "button", class: "btn btn-ghost" }, "Cancelar pedido");
  boton.addEventListener("click", () => {
    if (zona.querySelector(".confirma")) return;
    boton.hidden = true;
    pedirConfirmacion(zona, "¿Cancelar este pedido?", "Cancelar pedido", async () => {
      const { data, error } = await supabase.rpc("cancelar_pedido", { p_token: pedido.token });
      if (error) throw error;
      if (data !== true) {
        zona.replaceChildren(aviso(MENSAJE));
        return;
      }
      if (alCambiar) await alCambiar();
    }, () => {
      boton.hidden = false;
    });
  });
  zona.append(boton);
  return zona;
}
