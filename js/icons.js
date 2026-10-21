const NS = "http://www.w3.org/2000/svg";

const TRAZOS = {
  pin: ["M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z", "M12 10.2a1.3 1.3 0 1 0 0.01 0"],
  user: ["M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z", "M5 19.2a7 7 0 0 1 14 0"],
  card: ["M4 7.5h16v9H4z", "M4 11h16", "M7 15h4"],
  shield: ["M12 3.5l7 2.8v5.4c0 4.2-2.9 7-7 8.3-4.1-1.3-7-4.1-7-8.3V6.3z"],
  search: ["M11 18a7 7 0 1 0-7-7 7 7 0 0 0 7 7z", "M20 20l-3.6-3.6"],
  home: ["M4 11.2 12 4l8 7.2", "M7 10.8V20h10v-9.2"],
  grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  bag: ["M5 7h14l-1.5 11H6.5z", "M9 7V5.8a3 3 0 0 1 6 0V7"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  trash: ["M5 7h14", "M9 7V5h6v2", "M8 7l1 13h6l1-13"],
  pill: ["M8.2 14.8 14.8 8.2a3.6 3.6 0 0 1 5 5l-6.6 6.6a3.6 3.6 0 0 1-5-5z", "M10.2 10.2l3.6 3.6"],
  drop: ["M12 3.5s6 6.4 6 10.2a6 6 0 0 1-12 0c0-3.8 6-10.2 6-10.2z"],
  baby: ["M10 4h4", "M11 4v2.2", "M9.5 6.5h5l.8 2.2V18a2 2 0 0 1-2 2h-2.6a2 2 0 0 1-2-2V8.7z"],
  spark: ["M12 3.2l1.4 5.2 5.4 1.6-5.4 1.6L12 17l-1.4-5.4L5.2 10l5.4-1.6z"],
  leaf: ["M5 19.2C6 12 12 5.2 19.5 4.2 18.2 12 12.2 18.2 5 19.2z", "M8.2 16.2c2-2.2 4-5 6.2-7.6"],
  kit: ["M4.5 9h15v10h-15z", "M9 9V6.8h6V9", "M12 12.2v4", "M10 14.2h4"],
  heart: ["M12 19.5s-6.5-4-6.5-8.4a3.6 3.6 0 0 1 6.5-2 3.6 3.6 0 0 1 6.5 2c0 4.4-6.5 8.4-6.5 8.4z"],
  house: ["M4 11.2 12 4l8 7.2", "M7 10.8V20h10v-9.2", "M10 20v-5h4v5"],
  chat: ["M5 16.5 3.8 20 8 18.2A8 8 0 1 0 5 16.5z"],
  box: ["M3.5 7.5 12 4l8.5 3.5L12 11z", "M3.5 7.5V17L12 20.5 20.5 17V7.5", "M12 11v9.5"],
  check: ["M5 12.5l4.2 4.2L19 7.5"],
  truck: ["M3.5 7.5h10v8h-10z", "M13.5 11h3.2L20 14v1.5h-6.5z", "M7 18.2a1.4 1.4 0 1 0 .1 0", "M17.2 18.2a1.4 1.4 0 1 0 .1 0"]
};

export function icono(nombre, clase) {
  const datos = TRAZOS[nombre] || TRAZOS.plus;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (clase) svg.setAttribute("class", clase);
  for (const d of datos) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export function marcaLogo() {
  const caja = document.createElement("span");
  caja.className = "logo-mark";
  caja.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("fill", "#fff");
  path.setAttribute("d", "M14 6h4v8h8v4h-8v8h-4v-8H6v-4h8V6z");
  svg.append(path);
  caja.append(svg);
  return caja;
}
