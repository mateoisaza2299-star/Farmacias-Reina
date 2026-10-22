import { iniciarLayout, avisar } from "./layout.js";
import { COLUMNAS, activarTarjetas, tarjeta } from "./store.js";
import { leerFavoritos } from "./favoritos.js";
import { interpretarPedido, leerPedidosLocal } from "./pedidos.js";
import { supabase } from "./supabase.js";
import { agregarProducto } from "./cart.js";
import { el } from "./dom.js";

iniciarLayout();
activarTarjetas();

function vacio(titulo, texto) {
  return el("div", { class: "empty-state" },
    el("img", { src: "assets/iconos/pedidos.svg", alt: "", width: "96", height: "96" }),
    el("h2", {}, titulo),
    el("p", {}, texto),
    el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ver catálogo")
  );
}

function clave(nombre, presentacion) {
  return `${String(nombre || "").trim().toLowerCase()}|${String(presentacion || "").trim().toLowerCase()}`;
}

async function pintarFavoritos() {
  const grid = document.querySelector("[data-lista]");
  if (!grid) return;
  const ids = leerFavoritos();
  if (!ids.length) {
    grid.replaceChildren(vacio("Aún no tienes favoritos", "Toca el corazón de un producto para guardarlo en este dispositivo."));
    return;
  }
  const { data, error } = await supabase.from("productos").select(COLUMNAS).in("id", ids).eq("activo", true);
  if (error) {
    grid.replaceChildren(vacio("No pudimos cargar favoritos", "Revisa tu conexión e intenta de nuevo."));
    return;
  }
  const mapa = new Map((data || []).map((producto) => [String(producto.id), producto]));
  const lista = ids.map((id) => mapa.get(String(id))).filter(Boolean);
  if (!lista.length) {
    grid.replaceChildren(vacio("Esos favoritos ya no están disponibles", "El catálogo cambió. Puedes elegir otros productos."));
    return;
  }
  grid.replaceChildren(...lista.map(tarjeta));
}

async function pintarRecompra() {
  const grid = document.querySelector("[data-lista]");
  const accion = document.querySelector("[data-recompra]");
  if (!grid) return;
  const tokens = leerPedidosLocal();
  if (!tokens.length) {
    if (accion) accion.hidden = true;
    grid.replaceChildren(vacio("Todavía no hay pedidos en este dispositivo", "Cuando confirmes un pedido podrás repetirlo desde aquí."));
    return;
  }
  const buscados = new Map();
  for (const row of tokens) {
    const { data, error } = await supabase.rpc("estado_pedido", { p_token: row.token });
    if (error) continue;
    const pedido = interpretarPedido(data);
    (pedido?.items || []).forEach((item) => {
      const id = clave(item.nombre, item.presentacion);
      if (!buscados.has(id)) buscados.set(id, item);
    });
  }
  const { data, error } = await supabase.from("productos").select(COLUMNAS).eq("activo", true).limit(200);
  if (error) {
    if (accion) accion.hidden = true;
    grid.replaceChildren(vacio("No pudimos leer tus pedidos", "Revisa tu conexión e intenta de nuevo."));
    return;
  }
  const mapa = new Map((data || []).map((producto) => [clave(producto.nombre, producto.presentacion), producto]));
  const lista = [];
  buscados.forEach((item, id) => {
    const producto = mapa.get(id);
    if (producto && !lista.some((row) => String(row.id) === String(producto.id))) lista.push(producto);
  });
  if (!lista.length) {
    if (accion) accion.hidden = true;
    grid.replaceChildren(vacio("No encontramos esos productos", "Puede que hayan cambiado de nombre o ya no estén activos."));
    return;
  }
  grid.replaceChildren(...lista.map(tarjeta));
  if (!accion) return;
  accion.hidden = false;
  accion.onclick = () => {
    let agregados = 0;
    lista.forEach((producto) => {
      const resultado = agregarProducto(producto);
      if (resultado.ok) agregados += 1;
    });
    avisar(agregados ? `Agregaste ${agregados} productos al carrito` : "No había unidades disponibles para agregar.");
  };
}

if (document.body.dataset.page === "favoritos") {
  pintarFavoritos();
  document.addEventListener("reina:favoritos", pintarFavoritos);
}
if (document.body.dataset.page === "recompra") pintarRecompra();
