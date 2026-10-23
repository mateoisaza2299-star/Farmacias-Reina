const NS = "http://www.w3.org/2000/svg";
let serie = 0;

function nodo(tag, attrs = {}, ...hijos) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([clave, valor]) => {
    if (valor == null || valor === false) return;
    el.setAttribute(clave, String(valor));
  });
  hijos.flat().forEach((hijo) => {
    if (hijo == null || hijo === false) return;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  });
  return el;
}

function ids() {
  serie += 1;
  return [`g${serie}t`, `g${serie}d`];
}

function caja(svg, texto) {
  const figura = document.createElement("div");
  figura.className = "grafico";
  figura.append(svg);
  const ayuda = document.createElement("p");
  ayuda.className = "sr";
  ayuda.textContent = texto;
  figura.append(ayuda);
  return figura;
}

function corto(texto, tope) {
  const s = String(texto || "");
  return s.length > tope ? `${s.slice(0, tope - 1)}…` : s;
}

export function graficoDia(dias) {
  if (!dias?.length) return null;
  const [tituloId, descId] = ids();
  const ancho = 640;
  const alto = 260;
  const izq = 8;
  const base = 224;
  const techo = 28;
  const n = dias.length;
  const hueco = n > 20 ? 3 : 8;
  const barra = Math.max(4, (ancho - izq * 2 - hueco * (n - 1)) / n);
  const maxV = Math.max(1, ...dias.map((d) => d.ventas));
  const maxP = Math.max(1, ...dias.map((d) => d.pedidos));
  const altoUtil = base - techo;
  const partes = dias.map((d) => `${d.dia}: ${d.pedidos} pedidos y ${Math.round(d.ventas)} en ventas`);
  const desc = `Ventas en barras y pedidos en línea. ${partes.join(". ")}.`;
  const svg = nodo("svg", { viewBox: `0 0 ${ancho} ${alto}`, role: "img", "aria-labelledby": `${tituloId} ${descId}` });
  svg.append(nodo("title", { id: tituloId }, "Ventas y pedidos por día"));
  svg.append(nodo("desc", { id: descId }, desc));
  const puntos = [];
  dias.forEach((d, i) => {
    const x = izq + i * (barra + hueco);
    const h = Math.max(2, (d.ventas / maxV) * altoUtil);
    svg.append(nodo("rect", {
      x: x.toFixed(1),
      y: (base - h).toFixed(1),
      width: barra.toFixed(1),
      height: h.toFixed(1),
      rx: 4,
      fill: "var(--azul)"
    }));
    const px = x + barra / 2;
    const py = base - (d.pedidos / maxP) * altoUtil;
    puntos.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    const cada = n > 16 ? 5 : n > 8 ? 2 : 1;
    if (i % cada === 0 || i === n - 1) {
      svg.append(nodo("text", {
        x: px.toFixed(1),
        y: alto - 8,
        "text-anchor": "middle",
        fill: "var(--muted)",
        "font-size": "11"
      }, corto(d.etiqueta || d.dia, 6)));
    }
  });
  if (puntos.length) {
    svg.append(nodo("polyline", {
      points: puntos.join(" "),
      fill: "none",
      stroke: "var(--ambar)",
      "stroke-width": "2.5",
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));
  }
  return caja(svg, desc);
}

export function graficoHoras(horas) {
  if (!horas?.length) return null;
  const [tituloId, descId] = ids();
  const max = Math.max(0, ...horas);
  const partes = horas.map((valor, hora) => `${hora}: ${valor}`).filter((_, hora) => horas[hora] > 0);
  const desc = partes.length ? `Pedidos por hora. ${partes.join(", ")}.` : "No hubo pedidos por hora en este periodo.";
  const svg = nodo("svg", { viewBox: "0 0 624 78", role: "img", "aria-labelledby": `${tituloId} ${descId}` });
  svg.append(nodo("title", { id: tituloId }, "Pedidos por hora"));
  svg.append(nodo("desc", { id: descId }, desc));
  horas.forEach((valor, hora) => {
    const t = max ? valor / max : 0;
    svg.append(nodo("rect", {
      x: hora * 26,
      y: 4,
      width: 22,
      height: 36,
      rx: 6,
      fill: "var(--azul)",
      opacity: (0.16 + t * 0.84).toFixed(2)
    }));
  });
  [0, 6, 12, 18, 23].forEach((hora) => {
    svg.append(nodo("text", {
      x: hora * 26 + 11,
      y: 64,
      "text-anchor": "middle",
      fill: "var(--muted)",
      "font-size": "12"
    }, String(hora)));
  });
  return caja(svg, desc);
}

export function graficoDona(partes) {
  const datos = (partes || []).filter((item) => item.valor > 0);
  if (!datos.length) return null;
  const [tituloId, descId] = ids();
  const total = datos.reduce((suma, item) => suma + item.valor, 0);
  const colores = ["var(--azul)", "var(--verde)", "var(--ambar)", "var(--rojo)", "var(--marino)", "#0E7490", "#7C3AED", "#0369A1"];
  const desc = datos.map((item) => `${item.nombre}: ${item.valor}`).join(", ");
  const svg = nodo("svg", { viewBox: "0 0 220 220", role: "img", "aria-labelledby": `${tituloId} ${descId}` });
  svg.append(nodo("title", { id: tituloId }, "Distribución"));
  svg.append(nodo("desc", { id: descId }, desc));
  const radio = 68;
  const circ = 2 * Math.PI * radio;
  let offset = 0;
  const hueco = datos.length > 1 ? 2 : 0;
  datos.forEach((item, i) => {
    const len = Math.max(0, (item.valor / total) * circ - hueco);
    svg.append(nodo("circle", {
      cx: 110,
      cy: 110,
      r: radio,
      fill: "none",
      "stroke-width": 26,
      stroke: colores[i % colores.length],
      "stroke-dasharray": `${len} ${circ - len}`,
      "stroke-dashoffset": String(-offset),
      transform: "rotate(-90 110 110)"
    }));
    offset += (item.valor / total) * circ;
  });
  svg.append(nodo("text", {
    x: 110,
    y: 114,
    "text-anchor": "middle",
    fill: "var(--texto)",
    "font-size": "22",
    "font-weight": "700"
  }, String(total)));
  const leyenda = document.createElement("ul");
  leyenda.className = "leyenda";
  datos.forEach((item, i) => {
    const li = document.createElement("li");
    const punto = document.createElement("i");
    punto.setAttribute("data-tono", String(i % colores.length));
    const nombre = document.createElement("span");
    nombre.textContent = item.nombre;
    const valor = document.createElement("b");
    valor.textContent = String(item.valor);
    li.append(punto, nombre, valor);
    leyenda.append(li);
  });
  const envuelve = caja(svg, desc);
  envuelve.classList.add("grafico-dona");
  envuelve.append(leyenda);
  return envuelve;
}

export function graficoHorizonte(filas, titulo) {
  const datos = (filas || []).filter((item) => item && item.nombre).slice(0, 10);
  if (!datos.length) return null;
  const [tituloId, descId] = ids();
  const alto = datos.length * 36 + 8;
  const max = Math.max(1, ...datos.map((item) => item.valor));
  const desc = datos.map((item) => `${item.nombre}: ${item.valor}`).join(", ");
  const svg = nodo("svg", { viewBox: `0 0 520 ${alto}`, role: "img", "aria-labelledby": `${tituloId} ${descId}` });
  svg.append(nodo("title", { id: tituloId }, titulo));
  svg.append(nodo("desc", { id: descId }, desc));
  datos.forEach((item, i) => {
    const y = 8 + i * 36;
    const w = Math.max(4, (item.valor / max) * 250);
    const grupo = nodo("g");
    grupo.append(nodo("title", {}, `${item.nombre}: ${item.valor}`));
    grupo.append(nodo("text", {
      x: 0,
      y: y + 16,
      fill: "var(--texto)",
      "font-size": "13"
    }, corto(item.nombre, 22)));
    grupo.append(nodo("rect", {
      x: 168,
      y: y + 2,
      width: w.toFixed(1),
      height: 16,
      rx: 6,
      fill: "var(--azul)"
    }));
    grupo.append(nodo("text", {
      x: 176 + w,
      y: y + 15,
      fill: "var(--muted)",
      "font-size": "12"
    }, String(item.valor)));
    svg.append(grupo);
  });
  return caja(svg, desc);
}
