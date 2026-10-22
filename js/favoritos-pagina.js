import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { claveCatalogo, esFormula, plano } from "./format.js";
import { agregarProducto } from "./cart.js";
import { leerFavoritos } from "./memoria.js";
import { interpretarPedido, leerPedidosLocal } from "./pedidos.js";
import { iniciarLayout } from "./layout.js";
import { entrar, estadoFallo } from "./motion.js";
import { COLUMNAS, estadoVacio, tarjeta } from "./ui-producto.js";

function empatar(item, productos) {
  const clave = claveCatalogo(item.nombre, item.presentacion);
  const exacto = productos.find((producto) => claveCatalogo(producto.nombre, producto.presentacion) === clave);
  if (exacto) return exacto;
  if (!plano(item.presentacion)) {
    const porNombre = productos.filter((producto) => plano(producto.nombre) === plano(item.nombre));
    if (porNombre.length === 1) return porNombre[0];
  }
  return null;
}

async function buscarItem(item) {
  const nombre = String(item.nombre || "").replace(/[%_]/g, "").trim();
  if (!nombre) return null;
  const { data, error } = await supabase.from("productos").select(COLUMNAS).eq("activo", true).ilike("nombre", nombre).limit(12);
  if (error || !data) return null;
  return empatar(item, data);
}

function estadoItem(par) {
  if (!par.producto) return "Ya no está en el catálogo";
  if (esFormula(par.producto.requiere_formula)) return "Requiere fórmula médica";
  if (Number(par.producto.stock) <= 0) return "Agotado";
  return "Disponible";
}

function puedeAgregar(par) {
  return par.producto && !esFormula(par.producto.requiere_formula) && Number(par.producto.stock) > 0;
}

function agregarTodo(pares) {
  let agregados = 0;
  let omitidos = 0;
  pares.forEach((par) => {
    if (!puedeAgregar(par)) {
      omitidos += 1;
      return;
    }
    const tope = Number(par.producto.stock);
    const cantidad = Math.min(Math.max(1, Number(par.item.cantidad) || 1), tope);
    for (let i = 0; i < cantidad; i += 1) {
      const resultado = agregarProducto(par.producto);
      if (!resultado.ok) {
        omitidos += 1;
        return;
      }
    }
    agregados += 1;
  });
  if (agregados) {
    document.dispatchEvent(new CustomEvent("reina:aviso", { detail: agregados === 1 ? "Agregamos 1 producto al carrito." : `Agregamos ${agregados} productos al carrito.` }));
  }
  if (omitidos) {
    document.dispatchEvent(new CustomEvent("reina:aviso", { detail: "Algunos productos no se agregaron porque requieren fórmula, están agotados o ya no están en el catálogo." }));
  }
  if (!agregados && !omitidos) {
    document.dispatchEvent(new CustomEvent("reina:aviso", { detail: "No hay productos disponibles para agregar." }));
  }
}

async function cargarFavoritos() {
  const raiz = document.querySelector("[data-favoritos]");
  if (!raiz) return;
  const ids = leerFavoritos();
  if (!ids.length) {
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(estadoVacio("heart", "Aún no tienes favoritos", "Marca el corazón en un producto para guardarlo en este dispositivo.", el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ver catálogo")));
    return;
  }
  const { data, error } = await supabase.from("productos").select(COLUMNAS).in("id", ids).eq("activo", true);
  raiz.setAttribute("aria-busy", "false");
  if (error) {
    raiz.replaceChildren(estadoFallo("No pudimos cargar tus favoritos.", () => cargarFavoritos()));
    return;
  }
  const mapa = new Map((data || []).map((producto) => [String(producto.id), producto]));
  const lista = ids.map((id) => mapa.get(String(id))).filter(Boolean);
  if (!lista.length) {
    raiz.replaceChildren(estadoVacio("heart", "Aún no tienes favoritos", "Esos productos ya no están en el catálogo.", el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ver catálogo")));
    return;
  }
  raiz.replaceChildren(...lista.map(tarjeta));
  entrar(raiz.children, 8);
}

async function cargarRecompra() {
  const raiz = document.querySelector("[data-recompra]");
  if (!raiz) return;
  const locales = leerPedidosLocal();
  if (!locales.length) {
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(estadoVacio("box", "Volver a comprar", "Cuando hagas un pedido, podrás repetirlo desde aquí.", el("a", { class: "btn btn-ghost", href: "index.html#catalogo" }, "Ver catálogo")));
    return;
  }
  const pedidos = await Promise.all(locales.slice(0, 6).map(async (row) => {
    const { data, error } = await supabase.rpc("estado_pedido", { p_token: row.token });
    if (error) return null;
    return interpretarPedido(data);
  }));
  const vistos = new Set();
  const pendientes = [];
  pedidos.filter(Boolean).forEach((pedido) => {
    (pedido.items || []).forEach((item) => {
      const clave = claveCatalogo(item.nombre, item.presentacion);
      if (vistos.has(clave)) return;
      vistos.add(clave);
      pendientes.push(item);
    });
  });
  const pares = await Promise.all(pendientes.map(async (item) => ({ item, producto: await buscarItem(item) })));
  raiz.setAttribute("aria-busy", "false");
  if (!pares.length) {
    raiz.replaceChildren(estadoVacio("box", "Volver a comprar", "No encontramos productos de tus pedidos anteriores.", null));
    return;
  }
  const lista = el("ul", { class: "recompra-lista" }, ...pares.map((par) => el("li", {},
    el("span", {}, `${par.item.nombre}${par.item.presentacion ? ` · ${par.item.presentacion}` : ""} × ${par.item.cantidad || 1}`),
    el("strong", {}, estadoItem(par))
  )));
  const boton = el("button", {
    type: "button",
    class: "btn btn-primary",
    disabled: !pares.some(puedeAgregar)
  }, "Agregar todo al carrito");
  boton.addEventListener("click", () => agregarTodo(pares));
  raiz.replaceChildren(el("div", { class: "recompra" }, lista, boton));
}

iniciarLayout();
cargarFavoritos();
cargarRecompra();
document.addEventListener("reina:favoritos", () => cargarFavoritos());
