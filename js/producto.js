import { AVISO_FORMULA } from "./config.js";
import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { esFormula, marcaVisible } from "./format.js";
import { enlaceWhatsapp } from "./pago.js";
import { agregarProducto } from "./cart.js";
import { leerVistos, recordarVisto } from "./memoria.js";
import { iniciarLayout } from "./layout.js";
import { desdeEsqueleto, entrar, estadoFallo, marcarEsqueleto } from "./motion.js";
import { COLUMNAS, botonFavorito, estadoVacio, foto, precios, tarjeta } from "./ui-producto.js";

function metas(titulo, descripcion) {
  document.title = titulo;
  const meta = document.querySelector("meta[name='description']");
  if (meta) meta.content = descripcion;
  const url = location.href.split("#")[0];
  const canon = document.querySelector("link[rel='canonical']");
  if (canon) canon.href = url;
  const og = document.querySelector("meta[property='og:url']");
  if (og) og.content = url;
}

function selector(stock) {
  let cantidad = 1;
  const tope = Math.max(1, stock);
  const cifra = el("span", {}, "1");
  const menos = el("button", { type: "button", class: "qty-btn", "aria-label": "Disminuir cantidad" }, icono("minus"));
  const mas = el("button", { type: "button", class: "qty-btn is-plus", "aria-label": "Aumentar cantidad" }, icono("plus"));
  const pintar = () => {
    cifra.textContent = String(cantidad);
    menos.disabled = cantidad <= 1;
    mas.disabled = cantidad >= tope;
  };
  menos.addEventListener("click", () => {
    cantidad = Math.max(1, cantidad - 1);
    pintar();
  });
  mas.addEventListener("click", () => {
    cantidad = Math.min(tope, cantidad + 1);
    pintar();
  });
  pintar();
  return { nodo: el("div", { class: "qty qty-lg" }, menos, cifra, mas), leer: () => cantidad };
}

function migas(producto) {
  const nav = document.querySelector("[data-migas]");
  if (!nav) return;
  nav.replaceChildren(
    el("a", { href: "index.html" }, "Inicio"),
    el("span", { "aria-hidden": "true" }, "/"),
    el("a", { href: `categoria.html?c=${encodeURIComponent(producto.categoria || "")}` }, producto.categoria || "Categoría"),
    el("span", { "aria-hidden": "true" }, "/"),
    el("span", { "aria-current": "page" }, producto.nombre)
  );
}

function bloqueLista(titulo, productos) {
  if (!productos.length) return null;
  const grid = el("div", { class: "grid" }, ...productos.map(tarjeta));
  entrar(grid.children, 8);
  return el("section", { class: "relacionados" },
    el("div", { class: "section-head" }, el("h2", {}, titulo)),
    grid
  );
}

async function relacionados(producto) {
  const { data } = await supabase
    .from("productos")
    .select(COLUMNAS)
    .eq("activo", true)
    .eq("categoria", producto.categoria)
    .neq("id", producto.id)
    .limit(4);
  return data || [];
}

async function vistos(id) {
  const ids = leerVistos().filter((item) => item !== String(id)).slice(0, 4);
  if (!ids.length) return [];
  const { data } = await supabase.from("productos").select(COLUMNAS).eq("activo", true).in("id", ids);
  const mapa = new Map((data || []).map((item) => [String(item.id), item]));
  return ids.map((item) => mapa.get(String(item))).filter(Boolean);
}

function consultar(producto) {
  const presentacion = producto.presentacion ? ` (${producto.presentacion})` : "";
  const texto = `Hola, quiero consultar por ${producto.nombre}${presentacion}. Tengo la fórmula médica.`;
  const url = enlaceWhatsapp(texto);
  if (!url) return el("p", { class: "hint" }, "Consultar");
  return el("a", { class: "btn btn-consult", href: url, target: "_blank", rel: "noopener noreferrer" }, "Consultar");
}

function pintar(producto) {
  const raiz = document.querySelector("[data-producto]");
  const formula = esFormula(producto.requiere_formula);
  const stock = Number(producto.stock);
  const agotado = stock <= 0;
  const media = foto(producto);
  const marca = marcaVisible(producto.marca);
  const descripcion = String(producto.descripcion || "").trim();
  const info = el("div", { class: "ficha-info" },
    marca ? el("p", { class: "product-brand" }, marca) : null,
    el("h1", {}, producto.nombre),
    producto.presentacion ? el("p", { class: "product-pres" }, producto.presentacion) : null,
    precios(producto),
    el("p", { class: agotado ? "stock-note" : "stock-note is-ok" }, agotado ? "Agotado" : stock <= 5 ? "Últimas unidades" : `Disponibles: ${stock}`)
  );
  if (formula) {
    info.append(el("div", { class: "ficha-acciones" }, botonFavorito(producto)), consultar(producto));
  } else if (agotado) {
    info.append(
      el("div", { class: "ficha-acciones" }, botonFavorito(producto)),
      el("button", { type: "button", class: "btn btn-add", disabled: true }, "Agotado")
    );
  } else {
    const control = selector(stock);
    const boton = el("button", { type: "button", class: "btn btn-primary" }, "Agregar al carrito");
    boton.addEventListener("click", () => {
      const n = control.leer();
      let agregados = 0;
      let error = "";
      for (let i = 0; i < n; i += 1) {
        const resultado = agregarProducto(producto);
        if (!resultado.ok) {
          error = resultado.mensaje || "No pudimos agregar el producto.";
          break;
        }
        agregados += 1;
      }
      if (!agregados) {
        document.dispatchEvent(new CustomEvent("reina:aviso", { detail: error }));
        return;
      }
      document.dispatchEvent(new CustomEvent("reina:agregado", { detail: { producto, imagen: media.querySelector("img") } }));
      if (error) document.dispatchEvent(new CustomEvent("reina:aviso", { detail: error }));
    });
    info.append(el("div", { class: "ficha-acciones" }, control.nodo, botonFavorito(producto)), boton);
  }
  info.append(el("p", { class: descripcion ? "sheet-copy" : "hint" }, descripcion || "Este producto no tiene una descripción adicional."));
  if (formula) info.append(el("p", { class: "callout" }, AVISO_FORMULA));
  raiz.replaceChildren(el("div", { class: "ficha-layout" }, media, info));
  raiz.setAttribute("aria-busy", "false");
}

async function cargar() {
  const raiz = document.querySelector("[data-producto]");
  marcarEsqueleto(raiz);
  const id = new URLSearchParams(location.search).get("id") || "";
  const esId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!esId) {
    await desdeEsqueleto(raiz);
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(estadoVacio("search", "No encontramos ese producto", "Revisa el enlace o vuelve al catálogo.", el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ver catálogo")));
    return;
  }
  const { data, error } = await supabase.from("productos").select(`${COLUMNAS},descripcion`).eq("id", id).eq("activo", true).maybeSingle();
  await desdeEsqueleto(raiz);
  if (error) {
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(estadoFallo("No pudimos cargar el producto.", () => cargar()));
    return;
  }
  if (!data) {
    metas("Producto | Droguerías Reina", "No encontramos ese producto en Droguerías Reina.");
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(estadoVacio("search", "No encontramos ese producto", "Puede que ya no esté disponible.", el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ver catálogo")));
    return;
  }
  recordarVisto(data.id);
  const detalle = [data.presentacion, marcaVisible(data.marca), String(data.descripcion || "").replace(/\s+/g, " ").trim()].filter(Boolean).join(". ");
  metas(`${data.nombre} | Droguerías Reina`, (detalle || `${data.nombre} en Droguerías Reina. Domicilios a Funza y Mosquera.`).slice(0, 180));
  migas(data);
  pintar(data);
  const [relacion, reciente] = await Promise.all([relacionados(data), vistos(data.id)]);
  const extra = document.querySelector("[data-extra]");
  if (!extra) return;
  extra.replaceChildren(...[
    bloqueLista("Productos relacionados", relacion),
    bloqueLista("Vistos recientemente", reciente)
  ].filter(Boolean));
}

iniciarLayout();
cargar();
