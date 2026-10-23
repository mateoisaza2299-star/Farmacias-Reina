import { el } from "./dom.js";
import { esperar, reducido } from "./motion.js";

function calmado() {
  return reducido() || document.documentElement.classList.contains("lite");
}

function anunciar(texto) {
  let zona = document.querySelector("[data-vivo]");
  if (!zona) {
    zona = el("p", { class: "sr", "data-vivo": "true", "aria-live": "polite" });
    document.body.append(zona);
  }
  zona.textContent = "";
  zona.textContent = texto;
}

function svgTrazo(clase, d, caja) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", caja || "0 0 24 24");
  svg.setAttribute("class", clase);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function etiquetaDe(boton) {
  let etiqueta = boton.querySelector(".btn-label");
  if (etiqueta) return etiqueta;
  const texto = boton.textContent.trim();
  etiqueta = el("span", { class: "btn-label" }, texto);
  boton.replaceChildren(etiqueta);
  return etiqueta;
}

function soltarPresion() {
  document.querySelectorAll(".is-press").forEach((nodo) => nodo.classList.remove("is-press"));
}

export const micro = {
  async confirmar(boton, texto = "Listo", opciones = {}) {
    if (!boton || boton.dataset.micro === "1") return;
    boton.dataset.micro = "1";
    const etiqueta = etiquetaDe(boton);
    const previo = etiqueta.textContent;
    boton.style.setProperty("--btn-w", `${boton.offsetWidth}px`);
    boton.classList.add("is-lock");
    try {
      if (opciones.espera) {
        boton.classList.add("is-busy");
        boton.setAttribute("aria-busy", "true");
        await opciones.espera;
        boton.classList.remove("is-busy");
        boton.removeAttribute("aria-busy");
      }
      if (texto !== "Agregado") anunciar(texto);
      boton.classList.add("is-ok");
      if (!calmado()) {
        if (!boton.querySelector(".check-trazo")) boton.append(svgTrazo("check-trazo", "M5 12.5 9.2 16.7 19 7.5"));
        try { navigator.vibrate?.(8); } catch {}
      }
      etiqueta.textContent = texto;
      if (!opciones.dejar) {
        await esperar(1200);
        boton.classList.remove("is-ok");
        boton.querySelector(".check-trazo")?.remove();
        etiqueta.textContent = previo;
        boton.classList.remove("is-lock");
        boton.style.removeProperty("--btn-w");
      }
    } finally {
      delete boton.dataset.micro;
    }
  },
  agregado(detalle) {
    document.querySelectorAll("[data-open-cart] svg").forEach((icono) => {
      icono.classList.remove("is-rebote");
      void icono.offsetWidth;
      icono.classList.add("is-rebote");
    });
    document.querySelectorAll("[data-cart-count]").forEach((badge) => {
      badge.classList.remove("is-bounce");
      void badge.offsetWidth;
      badge.classList.add("is-bounce");
    });
    volar(detalle?.imagen);
    toastCarrito();
  }
};

function volar(imagen) {
  if (!imagen || calmado() || typeof imagen.animate !== "function") return;
  const destino = document.querySelector(window.matchMedia("(max-width: 899px)").matches ? ".tabbar [data-open-cart]" : ".header [data-open-cart]");
  if (!destino || document.hidden) return;
  const desde = imagen.getBoundingClientRect();
  const hacia = destino.getBoundingClientRect();
  if (!desde.width || !hacia.width) return;
  const clon = imagen.cloneNode(true);
  clon.className = "fly-img";
  clon.alt = "";
  clon.setAttribute("aria-hidden", "true");
  const dx = hacia.left + hacia.width / 2 - (desde.left + Math.min(desde.width, 72) / 2);
  const dy = hacia.top + hacia.height / 2 - (desde.top + Math.min(desde.height, 72) / 2);
  clon.style.setProperty("--l", `${desde.left}px`);
  clon.style.setProperty("--t", `${desde.top}px`);
  clon.style.setProperty("--w", `${Math.min(desde.width, 72)}px`);
  clon.style.setProperty("--h", `${Math.min(desde.height, 72)}px`);
  clon.style.setProperty("will-change", "transform, opacity");
  document.body.append(clon);
  const arco = Math.min(-28, dy * 0.15);
  const anim = clon.animate([
    { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
    { transform: `translate3d(${dx * 0.55}px, ${dy * 0.35 + arco}px, 0) scale(.7)`, opacity: 1, offset: 0.55 },
    { transform: `translate3d(${dx}px, ${dy}px, 0) scale(.16)`, opacity: 0 }
  ], { duration: 560, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
  const fin = () => clon.remove();
  anim.finished.then(fin, fin);
  const cortar = () => {
    if (!document.hidden) return;
    anim.cancel();
    fin();
  };
  document.addEventListener("visibilitychange", cortar, { once: true });
}

function toastCarrito() {
  let pila = document.querySelector(".toast-stack");
  if (!pila) {
    pila = el("div", { class: "toast-stack", role: "status", "aria-live": "polite" });
    document.body.append(pila);
  }
  const toast = el("div", { class: "toast toast-carrito" },
    el("span", {}, "Agregado al carrito"),
    el("button", {
      type: "button",
      class: "text-btn",
      onclick: () => document.querySelector("[data-open-cart]")?.click()
    }, "Ver carrito")
  );
  pila.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-on"));
  setTimeout(() => {
    toast.classList.remove("is-on");
    toast.classList.add("is-out");
    setTimeout(() => toast.remove(), calmado() ? 0 : 220);
  }, 3000);
}

function presion() {
  document.addEventListener("pointerdown", (evento) => {
    const boton = evento.target.closest("button, .btn, .filtro-chip");
    if (!boton || boton.disabled || boton.closest(".product, .chip") && boton.classList.contains("chip")) return;
    boton.classList.add("is-press");
    if (calmado()) return;
    const rect = boton.getBoundingClientRect();
    const onda = el("span", { class: "onda", "aria-hidden": "true" });
    onda.style.setProperty("--x", `${evento.clientX - rect.left}px`);
    onda.style.setProperty("--y", `${evento.clientY - rect.top}px`);
    boton.append(onda);
    onda.addEventListener("animationend", () => onda.remove(), { once: true });
    setTimeout(() => onda.remove(), 460);
  }, { passive: true });
  document.addEventListener("pointerup", soltarPresion, true);
  document.addEventListener("pointercancel", soltarPresion, true);
}

function cabecera() {
  const header = document.querySelector("[data-header]");
  const subir = el("button", { type: "button", class: "subir", "aria-label": "Volver arriba" }, "↑");
  subir.addEventListener("click", () => window.scrollTo({ top: 0, behavior: calmado() ? "auto" : "smooth" }));
  document.body.append(subir);
  const aplicar = () => {
    const y = window.scrollY;
    if (header) header.classList.toggle("is-compact", y > 8);
    subir.classList.toggle("is-on", y > 600);
  };
  aplicar();
  window.addEventListener("scroll", aplicar, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) subir.classList.remove("is-on"); else aplicar(); });
}

function busqueda() {
  document.querySelectorAll("[data-search-form]").forEach((form) => {
    const input = form.querySelector("[data-search-input]");
    if (!input || form.querySelector(".limpiar")) return;
    const limpiar = el("button", { type: "button", class: "limpiar", "aria-label": "Limpiar búsqueda", hidden: true }, "×");
    input.after(limpiar);
    const sync = () => {
      const lleno = input.value.length > 0;
      limpiar.hidden = !lleno;
      form.classList.toggle("is-lleno", lleno);
    };
    input.addEventListener("input", sync);
    input.addEventListener("focus", () => form.classList.add("is-focus"));
    input.addEventListener("blur", () => form.classList.remove("is-focus"));
    limpiar.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    sync();
  });
  const caja = document.body;
  if (caja.dataset.sug) return;
  caja.dataset.sug = "1";
  new MutationObserver((registros) => {
    registros.forEach((registro) => {
      registro.addedNodes.forEach((nodo) => {
        if (!(nodo instanceof Element)) return;
        if (!nodo.classList.contains("sug") && !nodo.classList.contains("sug-fila")) return;
        const indice = Math.min([...nodo.parentElement.children].indexOf(nodo), 12);
        nodo.style.setProperty("--i", String(indice));
        nodo.classList.add("entra");
        requestAnimationFrame(() => nodo.classList.add("is-show"));
      });
    });
  }).observe(caja, { childList: true, subtree: true });
}

const slides = new WeakMap();

function indicador(pista) {
  if (!pista) return;
  let estado = slides.get(pista);
  if (!estado) {
    const barra = el("span", { class: "ind-slide", "aria-hidden": "true" });
    pista.append(barra);
    const mover = () => {
      const activo = [...pista.children].find((nodo) => nodo !== barra && nodo.classList.contains("is-on"));
      if (!activo) {
        if (barra.classList.contains("is-on")) barra.classList.remove("is-on");
        return;
      }
      const x = `${activo.offsetLeft}px`;
      const w = `${activo.offsetWidth}px`;
      if (barra.style.getPropertyValue("--x") !== x) barra.style.setProperty("--x", x);
      if (barra.style.getPropertyValue("--w") !== w) barra.style.setProperty("--w", w);
      if (!barra.classList.contains("is-on")) barra.classList.add("is-on");
    };
    const obs = new MutationObserver((registros) => {
      if (registros.some((registro) => registro.target !== barra)) mover();
    });
    obs.observe(pista, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
    pista.addEventListener("click", () => requestAnimationFrame(mover));
    window.addEventListener("resize", mover);
    estado = { barra, mover };
    slides.set(pista, estado);
  } else if (!pista.contains(estado.barra)) pista.append(estado.barra);
  estado.mover();
}

function carriles() {
  document.querySelectorAll(".chips, .offers").forEach((pista) => {
    const padre = pista.parentElement;
    if (!padre || padre.querySelector(":scope > .carril-btn")) return;
    padre.classList.add("con-carril");
    const ir = (signo) => pista.scrollBy({ left: signo * Math.max(180, pista.clientWidth * 0.8), behavior: calmado() ? "auto" : "smooth" });
    const prev = el("button", { type: "button", class: "carril-btn is-prev", "aria-label": "Anterior" }, "‹");
    const next = el("button", { type: "button", class: "carril-btn is-next", "aria-label": "Siguiente" }, "›");
    prev.addEventListener("click", () => ir(-1));
    next.addEventListener("click", () => ir(1));
    padre.append(prev, next);
    const sync = () => {
      const sobra = pista.scrollWidth > pista.clientWidth + 12;
      prev.hidden = !sobra || pista.scrollLeft < 8;
      next.hidden = !sobra || pista.scrollLeft + pista.clientWidth > pista.scrollWidth - 8;
    };
    pista.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });
  document.querySelectorAll(".chips, .filtro-activos").forEach(indicador);
}

function formularios() {
  document.querySelectorAll(".field-error").forEach((nodo) => nodo.setAttribute("aria-live", "polite"));
  document.querySelectorAll("#pedido .form-grid > label").forEach((label) => {
    const campo = label.querySelector("input, textarea, select");
    if (!campo || label.classList.contains("check") || label.classList.contains("fl") || campo.type === "checkbox" || campo.type === "radio" || campo.type === "file") return;
    const texto = [...label.childNodes].find((nodo) => nodo.nodeType === 3 && nodo.textContent.trim());
    if (!texto) return;
    const nombre = el("span", { class: "fl-lab" }, texto.textContent.trim());
    texto.remove();
    label.classList.add("fl");
    if (campo.tagName === "TEXTAREA") label.classList.add("is-area");
    label.prepend(nombre);
    label.append(svgTrazo("campo-ok", "M5 12.5 9.2 16.7 19 7.5"));
    const subir = () => label.classList.toggle("is-up", document.activeElement === campo || campo.value.trim().length > 0);
    campo.addEventListener("input", subir);
    campo.addEventListener("focus", subir);
    campo.addEventListener("blur", () => {
      subir();
      setTimeout(() => {
        const mal = campo.getAttribute("aria-invalid") === "true";
        label.classList.toggle("is-valid", !mal && campo.value.trim().length > 0);
        campo.classList.toggle("is-shake", mal);
      }, 0);
    });
    subir();
  });
  const form = document.querySelector("#pedido");
  form?.addEventListener("submit", () => {
    setTimeout(() => {
      form.querySelectorAll("[aria-invalid='true']").forEach((campo) => {
        campo.classList.remove("is-shake");
        void campo.offsetWidth;
        campo.classList.add("is-shake");
      });
    }, 0);
  }, true);
  document.addEventListener("change", (evento) => {
    const input = evento.target;
    if (input?.name !== "formula" || !input.files?.[0]) return;
    const archivo = input.files[0];
    const caja = input.closest(".formula-box");
    if (!caja) return;
    let previo = caja.querySelector(".formula-prev");
    if (!previo) {
      previo = el("div", { class: "formula-prev" });
      caja.append(previo);
    }
    previo.replaceChildren();
    if (archivo.type.startsWith("image/")) {
      const img = el("img", { alt: "", class: "is-pop" });
      img.src = URL.createObjectURL(archivo);
      previo.append(img);
    } else previo.append(el("p", { class: "is-pop" }, archivo.name));
    previo.append(el("span", { class: "carga-mini" }, el("i")));
  });
  document.addEventListener("reina:formula", (evento) => {
    const barra = document.querySelector(".carga-mini i");
    if (barra) barra.style.setProperty("--n", String(evento.detail ?? 0));
  });
}

function exito() {
  const nodo = document.querySelector("[data-exito]");
  if (!nodo) return;
  const pintar = () => {
    if (nodo.hidden || nodo.dataset.sello) return;
    nodo.dataset.sello = "1";
    nodo.classList.add("is-on");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 72 72");
    svg.setAttribute("class", "sello");
    svg.setAttribute("aria-hidden", "true");
    const circulo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circulo.setAttribute("cx", "36");
    circulo.setAttribute("cy", "36");
    circulo.setAttribute("r", "28");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M22 37.5 32 47 51 26");
    svg.append(circulo, path);
    nodo.prepend(svg);
    nodo.querySelectorAll(".siguientes li").forEach((item, indice) => item.style.setProperty("--i", String(indice)));
    anunciar("Listo");
  };
  new MutationObserver(pintar).observe(nodo, { attributes: true, attributeFilter: ["hidden"] });
}

export function iniciarMicro() {
  if (!document.body || document.body.dataset.micro === "1") return;
  document.body.dataset.micro = "1";
  presion();
  cabecera();
  busqueda();
  carriles();
  formularios();
  exito();
  document.addEventListener("reina:agregado", (evento) => micro.agregado(evento.detail || {}));
  document.addEventListener("reina:chips", () => {
    document.querySelectorAll(".chips, .filtro-activos").forEach(indicador);
    carriles();
  });
}
