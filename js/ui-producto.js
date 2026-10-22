import { categorias } from "./config.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { descuento, dinero, esFormula, marcaVisible, tramos } from "./format.js";
import { enlaceWhatsapp } from "./pago.js";
import { agregarProducto } from "./cart.js";
import { alternarFavorito, esFavorito } from "./memoria.js";
import { prepararImagen } from "./motion.js";

export const COLUMNAS = "id,nombre,marca,presentacion,categoria,precio,precio_anterior,stock,requiere_formula,activo,imagen";

const ILUSTRACIONES = {
  Medicamentos: "assets/productos/medicamentos.svg",
  "Cuidado personal": "assets/productos/cuidado.svg",
  "Bebé": "assets/productos/bebe.svg",
  "Belleza y dermocosmética": "assets/productos/belleza.svg",
  "Vitaminas y suplementos": "assets/productos/vitaminas.svg",
  "Botiquín": "assets/productos/botiquin.svg",
  "Adulto mayor": "assets/productos/adulto.svg",
  "Hogar y aseo": "assets/productos/hogar.svg"
};

export function ilustracionDe(categoria) {
  return ILUSTRACIONES[categoria] || ILUSTRACIONES.Medicamentos;
}

export function resaltar(texto, consulta) {
  return tramos(texto, consulta).map((parte) => (
    parte.marca ? el("mark", {}, parte.texto) : document.createTextNode(parte.texto)
  ));
}

export function estadoVacio(nombreIcono, titulo, texto, accion) {
  return el("div", { class: "empty-state" },
    el("div", { class: "vacio-arte", "aria-hidden": "true" }, icono(nombreIcono)),
    el("h3", {}, titulo),
    texto ? el("p", {}, texto) : null,
    accion || null
  );
}

export function etiquetas(producto) {
  const formula = esFormula(producto.requiere_formula);
  const oferta = !formula && descuento(producto.precio, producto.precio_anterior) > 0;
  const stock = Number(producto.stock);
  const agotado = stock <= 0;
  const pocas = !agotado && stock <= 5;
  return [
    oferta ? el("span", { class: "tag tag-offer" }, "Oferta") : null,
    agotado ? el("span", { class: "tag tag-out" }, "Agotado") : null,
    pocas ? el("span", { class: "tag tag-low" }, "Últimas unidades") : null,
    formula ? el("span", { class: "tag tag-rx" }, "Requiere fórmula médica") : null
  ].filter(Boolean);
}

function imagenProducto(producto, medidas, alFallar) {
  const reserva = ilustracionDe(producto.categoria);
  const propia = String(producto.imagen || "").trim();
  const img = prepararImagen(el("img", {
    src: propia || reserva,
    alt: medidas.alt,
    width: String(medidas.width),
    height: String(medidas.height)
  }));
  img.addEventListener("error", () => {
    if (!img.dataset.reserva && img.getAttribute("src") !== reserva) {
      img.dataset.reserva = "1";
      img.setAttribute("src", reserva);
      return;
    }
    if (alFallar) alFallar();
  });
  return img;
}

export function foto(producto) {
  const caja = el("div", { class: "product-media" });
  const arte = el("div", { class: "product-art" });
  const img = imagenProducto(producto, {
    alt: [producto.nombre, marcaVisible(producto.marca), producto.presentacion].filter(Boolean).join(", "),
    width: 480,
    height: 480
  }, () => {
    arte.remove();
    if (!caja.querySelector(".chip-icon")) {
      const item = categorias.find((cat) => cat.id === producto.categoria);
      caja.append(el("span", { class: "chip-icon" }, icono(item ? item.icono : "pill")));
      caja.classList.add("is-icon");
    }
  });
  arte.append(img);
  caja.append(arte);
  etiquetas(producto).forEach((tag) => caja.append(tag));
  return caja;
}

export function precios(producto) {
  const formula = esFormula(producto.requiere_formula);
  const off = formula ? 0 : descuento(producto.precio, producto.precio_anterior);
  if (!off) return el("p", { class: "product-price" }, el("strong", {}, dinero(producto.precio)));
  return el("p", { class: "product-price" },
    el("s", {}, dinero(producto.precio_anterior)),
    el("strong", {}, dinero(producto.precio)),
    el("span", { class: "off" }, `-${off}%`)
  );
}

export function botonFavorito(producto) {
  const boton = el("button", {
    type: "button",
    class: "fav"
  }, icono("heart"));
  const pintar = () => {
    const activo = esFavorito(producto.id);
    boton.classList.toggle("is-on", activo);
    boton.setAttribute("aria-pressed", activo ? "true" : "false");
    boton.setAttribute("aria-label", activo ? `Quitar ${producto.nombre} de favoritos` : `Guardar ${producto.nombre} en favoritos`);
  };
  pintar();
  boton.addEventListener("click", (evento) => {
    evento.preventDefault();
    evento.stopPropagation();
    alternarFavorito(producto.id);
    pintar();
  });
  document.addEventListener("reina:favoritos", pintar);
  return boton;
}

export function accionProducto(producto, imagen) {
  const formula = esFormula(producto.requiere_formula);
  const agotado = Number(producto.stock) <= 0;
  if (formula) {
    const presentacion = producto.presentacion ? ` (${producto.presentacion})` : "";
    const texto = `Hola, quiero consultar por ${producto.nombre}${presentacion}. Tengo la fórmula médica.`;
    const boton = el("button", {
      type: "button",
      class: "btn btn-consult",
      "aria-label": `Consultar ${producto.nombre}`
    }, "Consultar");
    boton.addEventListener("click", () => {
      const url = enlaceWhatsapp(texto);
      if (url) window.open(url, "_blank", "noopener");
    });
    return boton;
  }
  const boton = el("button", {
    type: "button",
    class: "btn btn-add",
    disabled: agotado
  }, el("span", { class: "btn-label" }, agotado ? "Agotado" : "Agregar"));
  boton.addEventListener("click", () => {
    const resultado = agregarProducto(producto);
    if (!resultado.ok) {
      document.dispatchEvent(new CustomEvent("reina:aviso", { detail: resultado.mensaje || "No pudimos agregar el producto." }));
      return;
    }
    boton.classList.add("is-done");
    setTimeout(() => boton.classList.remove("is-done"), 600);
    document.dispatchEvent(new CustomEvent("reina:agregado", { detail: { producto, imagen } }));
  });
  return boton;
}

export function enlaceProducto(id) {
  return `producto.html?id=${encodeURIComponent(id)}`;
}

export function tarjeta(producto) {
  const media = foto(producto);
  const marca = marcaVisible(producto.marca);
  const abrir = el("a", {
    class: "product-open",
    href: enlaceProducto(producto.id)
  },
    media,
    marca ? el("span", { class: "product-brand" }, marca) : null,
    el("span", { class: "product-name" }, producto.nombre),
    producto.presentacion ? el("span", { class: "product-pres" }, producto.presentacion) : null
  );
  const boton = accionProducto(producto, media.querySelector("img"));
  return el("article", { class: "product" },
    abrir,
    el("div", { class: "product-buy" },
      el("div", { class: "buy-row" }, precios(producto), botonFavorito(producto)),
      boton
    )
  );
}

export function tarjetaCorta(producto) {
  const media = el("div", { class: "mini-media" });
  const img = imagenProducto(producto, { alt: "", width: 72, height: 72 }, null);
  media.append(img);
  return el("article", { class: "mini-product" },
    el("a", { class: "mini-open", href: enlaceProducto(producto.id) },
      media,
      el("span", { class: "mini-copy" },
        el("span", { class: "product-name" }, producto.nombre),
        producto.presentacion ? el("span", { class: "product-pres" }, producto.presentacion) : null,
        precios(producto)
      )
    ),
    accionProducto(producto, img)
  );
}
