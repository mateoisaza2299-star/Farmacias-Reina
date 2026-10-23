import { negocio } from "./config.js";

function fechaVigencia(texto) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return texto;
  const fecha = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(fecha);
}

function valorCampo(campo) {
  const legal = negocio.legal || {};
  if (!Object.prototype.hasOwnProperty.call(legal, campo)) return "";
  const valor = legal[campo];
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (Array.isArray(valor)) return valor.map((item) => String(item).trim()).filter(Boolean).join(", ");
  if (valor == null) return "";
  const texto = String(valor).trim();
  if (!texto) return "";
  if (campo === "fechaVigencia") return fechaVigencia(texto);
  return texto;
}

function modoPago() {
  if (!negocio.pagoEnLinea) return "recibir";
  if (negocio.pagoAlRecibir === false) return "linea";
  return "ambos";
}

export function aplicarLegal() {
  document.querySelectorAll("[data-legal]").forEach((nodo) => {
    const texto = valorCampo(nodo.dataset.legal || "");
    if (!texto) {
      nodo.textContent = "Por confirmar";
      nodo.classList.add("legal-pendiente");
      return;
    }
    nodo.textContent = texto;
    nodo.classList.remove("legal-pendiente");
  });
  const modo = modoPago();
  document.querySelectorAll("[data-pago-legal]").forEach((nodo) => {
    nodo.hidden = nodo.dataset.pagoLegal !== modo;
  });
}
