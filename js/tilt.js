let card = null;
let toca = false;
let marco = 0;
let rx = 0;
let ry = 0;
let mx = 50;
let my = 40;

function quieto() {
  return document.documentElement.classList.contains("lite")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || document.hidden;
}

function tope(nodo) {
  if (nodo.classList.contains("chip")) return 4;
  if (nodo.querySelector(".btn-consult, .tag-rx")) return 3.5;
  return toca ? 6 : 7;
}

function pintar() {
  marco = 0;
  if (!card || quieto()) return;
  const max = tope(card);
  const suave = card.classList.contains("chip") || !!card.querySelector(".btn-consult, .tag-rx");
  const esc = toca ? (suave ? 0.99 : 0.98) : (suave ? 1.01 : 1.02);
  card.style.setProperty("--rx", `${Math.max(-max, Math.min(max, rx)).toFixed(2)}deg`);
  card.style.setProperty("--ry", `${Math.max(-max, Math.min(max, ry)).toFixed(2)}deg`);
  card.style.setProperty("--mx", `${mx.toFixed(1)}%`);
  card.style.setProperty("--my", `${my.toFixed(1)}%`);
  card.style.setProperty("--sc", String(esc));
  card.classList.add("is-tilt");
  card.style.setProperty("will-change", "transform");
}

function pedir() {
  if (!marco) marco = requestAnimationFrame(pintar);
}

function medidas(nodo, x, y) {
  const rect = nodo.getBoundingClientRect();
  const px = rect.width ? (x - rect.left) / rect.width : 0.5;
  const py = rect.height ? (y - rect.top) / rect.height : 0.5;
  mx = px * 100;
  my = py * 100;
  const max = tope(nodo);
  ry = (px - 0.5) * 2 * max;
  rx = (0.5 - py) * 2 * max;
}

function soltar(barrido) {
  const nodo = card;
  card = null;
  toca = false;
  if (marco) cancelAnimationFrame(marco);
  marco = 0;
  if (!nodo) return;
  nodo.style.setProperty("--rx", "0deg");
  nodo.style.setProperty("--ry", "0deg");
  nodo.style.setProperty("--sc", "1");
  nodo.classList.remove("is-tilt");
  nodo.style.removeProperty("will-change");
  if (barrido && !quieto()) {
    nodo.classList.add("is-barrido");
    setTimeout(() => nodo.classList.remove("is-barrido"), 420);
  }
}

function vestir(nodo) {
  if (!nodo || nodo.closest(".tilt-vista") || !nodo.parentElement) return;
  const vista = document.createElement("div");
  vista.className = "tilt-vista";
  nodo.parentElement.insertBefore(vista, nodo);
  vista.append(nodo);
}

export function iniciarTilt() {
  if (quieto()) return;
  const fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const cajas = [...document.querySelectorAll(".grid, .offers, .chips")];
  const envolver = () => document.querySelectorAll(".grid > .product, .offers > .product").forEach(vestir);
  envolver();
  const cambios = new MutationObserver(envolver);
  cajas.forEach((caja) => cambios.observe(caja, { childList: true }));
  cajas.forEach((caja) => {
    caja.addEventListener("pointerdown", (evento) => {
      const nodo = evento.target.closest(".product, .chip");
      if (!nodo || !caja.contains(nodo)) return;
      if (evento.pointerType === "mouse" && fino) return;
      if (card && card !== nodo) soltar(false);
      card = nodo;
      toca = true;
      medidas(nodo, evento.clientX, evento.clientY);
      pedir();
    });
    caja.addEventListener("pointermove", (evento) => {
      const nodo = evento.target.closest(".product, .chip");
      if (evento.pointerType === "mouse") {
        if (!fino || !nodo || !caja.contains(nodo)) return;
        if (card && card !== nodo) soltar(false);
        card = nodo;
        toca = false;
        medidas(nodo, evento.clientX, evento.clientY);
        pedir();
        return;
      }
      if (!toca || !card) return;
      const rect = card.getBoundingClientRect();
      if (evento.clientX < rect.left || evento.clientX > rect.right || evento.clientY < rect.top || evento.clientY > rect.bottom) return;
      medidas(card, evento.clientX, evento.clientY);
      pedir();
    });
    caja.addEventListener("pointerup", () => { if (toca) soltar(true); });
    caja.addEventListener("pointercancel", () => soltar(false));
    caja.addEventListener("pointerleave", (evento) => {
      if (evento.pointerType === "mouse") soltar(false);
    });
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) soltar(false); });
}
