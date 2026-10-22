import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { dinero, patronIlike, sanearBusqueda } from "./format.js";
import { guardarBusqueda, leerBusquedas, quitarBusqueda } from "./memoria.js";
import { prepararImagen } from "./motion.js";
import { COLUMNAS, enlaceProducto, ilustracionDe, resaltar } from "./ui-producto.js";

let secuencia = 0;
const paneles = new WeakMap();

function colocar(form) {
  const panel = paneles.get(form);
  if (!panel) return;
  const rect = form.getBoundingClientRect();
  panel.style.setProperty("--l", `${Math.max(8, rect.left)}px`);
  panel.style.setProperty("--t", `${rect.bottom + 8}px`);
  panel.style.setProperty("--w", `${Math.min(rect.width, window.innerWidth - 16)}px`);
}

function panelDe(form) {
  const previo = paneles.get(form);
  if (previo) return previo;
  const input = form.querySelector("[data-search-input]");
  const panel = el("div", {
    class: "sugerencias",
    "data-sugerencias": "true",
    role: "listbox",
    id: `sug-${input?.id || "buscar"}`,
    hidden: true
  });
  document.body.append(panel);
  paneles.set(form, panel);
  if (input) {
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", panel.id);
    input.setAttribute("aria-expanded", "false");
  }
  panel.addEventListener("mousedown", (evento) => {
    if (evento.target.closest("[data-borrar-busqueda]")) return;
    evento.preventDefault();
  });
  return panel;
}

function cerrar(form) {
  const panel = paneles.get(form);
  const input = form.querySelector("[data-search-input]");
  if (panel) panel.hidden = true;
  if (input) {
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  form.dataset.indice = "-1";
}

function marcar(form, indice) {
  const panel = panelDe(form);
  const opciones = [...panel.querySelectorAll("[role='option']")];
  const input = form.querySelector("[data-search-input]");
  form.dataset.indice = String(indice);
  opciones.forEach((opcion, i) => {
    const activo = i === indice;
    opcion.classList.toggle("is-on", activo);
    if (activo) opcion.id = opcion.id || `op-${input?.id || "buscar"}-${i}`;
    if (activo && input) input.setAttribute("aria-activedescendant", opcion.id);
  });
  if (indice < 0 && input) input.removeAttribute("aria-activedescendant");
  opciones[indice]?.scrollIntoView({ block: "nearest" });
}

function filaHistorial(form, texto) {
  const opcion = el("button", {
    type: "button",
    class: "sug-hist",
    role: "option"
  }, icono("search"), el("span", {}, texto));
  opcion.addEventListener("click", () => {
    const input = form.querySelector("[data-search-input]");
    if (input) input.value = texto;
    document.querySelectorAll("[data-search-input]").forEach((otro) => {
      otro.value = texto;
    });
    cerrar(form);
    if (document.body.dataset.page === "inicio" || document.body.dataset.page === "categoria") {
      document.dispatchEvent(new CustomEvent("reina:buscar", { detail: texto }));
      return;
    }
    location.href = `index.html?q=${encodeURIComponent(texto)}#catalogo`;
  });
  const borrar = el("button", {
    type: "button",
    class: "text-btn",
    "data-borrar-busqueda": "true",
    "aria-label": `Borrar búsqueda ${texto}`
  }, "Borrar");
  borrar.addEventListener("click", (evento) => {
    evento.preventDefault();
    evento.stopPropagation();
    quitarBusqueda(texto);
    pintarHistorial(form);
  });
  return el("div", { class: "sug-fila" }, opcion, borrar);
}

function pintarHistorial(form) {
  const panel = panelDe(form);
  const items = leerBusquedas();
  if (!items.length) {
    cerrar(form);
    return;
  }
  colocar(form);
  panel.hidden = false;
  form.querySelector("[data-search-input]")?.setAttribute("aria-expanded", "true");
  panel.replaceChildren(
    el("p", { class: "sug-titulo" }, "Búsquedas recientes"),
    ...items.map((texto) => filaHistorial(form, texto))
  );
  form.dataset.indice = "-1";
}

function filaProducto(form, producto, consulta) {
  const img = prepararImagen(el("img", {
    src: String(producto.imagen || "").trim() || ilustracionDe(producto.categoria),
    alt: "",
    width: "48",
    height: "48"
  }));
  img.addEventListener("error", () => {
    const reserva = ilustracionDe(producto.categoria);
    if (img.getAttribute("src") !== reserva) img.setAttribute("src", reserva);
  });
  const enlace = el("a", {
    class: "sug",
    role: "option",
    href: enlaceProducto(producto.id)
  },
    img,
    el("span", { class: "sug-texto" },
      el("span", { class: "sug-nombre" }, ...resaltar(producto.nombre, consulta)),
      producto.presentacion ? el("span", { class: "sug-pres" }, producto.presentacion) : null
    ),
    el("span", { class: "sug-precio" }, dinero(producto.precio))
  );
  enlace.addEventListener("click", () => {
    const input = form.querySelector("[data-search-input]");
    guardarBusqueda(input?.value || consulta);
  });
  return enlace;
}

async function buscar(form, consulta) {
  const q = sanearBusqueda(consulta);
  const patron = patronIlike(q);
  if (patron.length < 2) {
    pintarHistorial(form);
    return;
  }
  const id = ++secuencia;
  const { data, error } = await supabase
    .from("productos")
    .select(COLUMNAS)
    .eq("activo", true)
    .or(`nombre.ilike.%${patron}%,marca.ilike.%${patron}%`)
    .limit(6);
  if (id !== secuencia) return;
  const panel = panelDe(form);
  if (error || !data?.length) {
    cerrar(form);
    return;
  }
  colocar(form);
  panel.hidden = false;
  form.querySelector("[data-search-input]")?.setAttribute("aria-expanded", "true");
  panel.replaceChildren(...data.map((producto) => filaProducto(form, producto, q)));
  form.dataset.indice = "-1";
}

function mover(form, delta) {
  const panel = panelDe(form);
  if (panel.hidden) return;
  const opciones = [...panel.querySelectorAll("[role='option']")];
  if (!opciones.length) return;
  const actual = Number(form.dataset.indice || "-1");
  const siguiente = actual < 0 ? (delta > 0 ? 0 : opciones.length - 1) : (actual + delta + opciones.length) % opciones.length;
  marcar(form, siguiente);
}

function activar(form) {
  const indice = Number(form.dataset.indice || "-1");
  const opciones = [...panelDe(form).querySelectorAll("[role='option']")];
  if (indice < 0 || !opciones[indice]) return false;
  opciones[indice].click();
  return true;
}

export function iniciarBusqueda() {
  let timer = 0;
  document.querySelectorAll("[data-search-form]").forEach((form) => {
    if (form.dataset.busqueda === "1") return;
    form.dataset.busqueda = "1";
    form.dataset.indice = "-1";
    const input = form.querySelector("[data-search-input]");
    input?.addEventListener("input", () => {
      document.querySelectorAll("[data-search-input]").forEach((otro) => {
        if (otro !== input) otro.value = input.value;
      });
      document.querySelectorAll("[data-search-form]").forEach((otro) => {
        if (otro !== form) cerrar(otro);
      });
      if (document.body.dataset.page === "inicio" || document.body.dataset.page === "categoria") {
        document.dispatchEvent(new CustomEvent("reina:escribir", { detail: input.value }));
      }
      clearTimeout(timer);
      timer = setTimeout(() => buscar(form, input.value), 180);
    });
    input?.addEventListener("focus", () => {
      if (sanearBusqueda(input.value).length < 2) pintarHistorial(form);
    });
    input?.addEventListener("keydown", (evento) => {
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        mover(form, 1);
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        mover(form, -1);
      } else if (evento.key === "Escape") {
        cerrar(form);
      } else if (evento.key === "Enter" && activar(form)) {
        evento.preventDefault();
      }
    });
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const q = input ? input.value.trim() : "";
      guardarBusqueda(q);
      cerrar(form);
      if (document.body.dataset.page === "inicio" || document.body.dataset.page === "categoria") {
        document.dispatchEvent(new CustomEvent("reina:buscar", { detail: q }));
        return;
      }
      location.href = `index.html?q=${encodeURIComponent(q)}#catalogo`;
    });
  });
  document.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-search-form], [data-sugerencias]")) return;
    document.querySelectorAll("[data-search-form]").forEach(cerrar);
  });
  const moverPaneles = () => {
    document.querySelectorAll("[data-search-form]").forEach((form) => {
      const panel = paneles.get(form);
      if (panel && !panel.hidden) colocar(form);
    });
  };
  window.addEventListener("resize", moverPaneles);
  window.addEventListener("scroll", moverPaneles, { passive: true });
}
