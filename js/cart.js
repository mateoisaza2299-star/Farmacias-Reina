const LLAVE = "carrito_reina";

function bandera(valor) {
  return valor === true || valor === "true" || valor === "t" || valor === 1 || valor === "1";
}

function imagenLigera(valor) {
  const texto = String(valor || "");
  if (texto.startsWith("data:") && texto.length > 1800) return "";
  return texto;
}

function normalizar(item) {
  const stock = Math.max(0, Math.trunc(Number(item.stock) || 0));
  let cantidad = Math.max(1, Math.trunc(Number(item.cantidad) || 1));
  if (stock && cantidad > stock) cantidad = stock;
  return {
    id: String(item.id),
    nombre: String(item.nombre || "Producto"),
    marca: String(item.marca || ""),
    presentacion: String(item.presentacion || ""),
    precio: Number(item.precio) || 0,
    precio_anterior: item.precio_anterior == null || item.precio_anterior === "" ? null : Number(item.precio_anterior),
    stock,
    requiere_formula: bandera(item.requiere_formula),
    imagen: imagenLigera(item.imagen),
    cantidad
  };
}

export function leerCarrito() {
  try {
    const data = JSON.parse(localStorage.getItem(LLAVE) || "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((item) => item && item.id).map(normalizar).filter((item) => item.cantidad > 0);
  } catch {
    return [];
  }
}

function persistir(items) {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("reina:carrito"));
    return { ok: true };
  } catch {
    return { ok: false, mensaje: "No pudimos guardar el carrito en este dispositivo." };
  }
}

export function agregarProducto(producto) {
  const items = leerCarrito();
  const stock = Math.max(0, Math.trunc(Number(producto.stock) || 0));
  if (stock < 1) return { ok: false, mensaje: "Este producto está agotado." };
  const indice = items.findIndex((item) => item.id === String(producto.id));
  if (indice >= 0) {
    if (items[indice].cantidad + 1 > stock) {
      return { ok: false, mensaje: `Solo hay ${stock} unidades disponibles.` };
    }
    items[indice] = normalizar({
      ...items[indice],
      ...producto,
      stock,
      cantidad: items[indice].cantidad + 1
    });
  } else {
    items.push(normalizar({ ...producto, stock, cantidad: 1 }));
  }
  return persistir(items);
}

export function fijarCantidad(id, cantidad) {
  const items = leerCarrito();
  const item = items.find((row) => row.id === String(id));
  if (!item) return;
  const siguiente = Math.trunc(Number(cantidad) || 0);
  if (siguiente <= 0) {
    persistir(items.filter((row) => row.id !== String(id)));
    return;
  }
  const tope = item.stock > 0 ? item.stock : siguiente;
  if (siguiente > tope) {
    item.cantidad = tope;
    persistir(items);
    return { ok: false, mensaje: `Solo hay ${tope} unidades disponibles.` };
  }
  item.cantidad = siguiente;
  return persistir(items);
}

export function quitarProducto(id) {
  persistir(leerCarrito().filter((item) => item.id !== String(id)));
}

export function vaciarCarrito() {
  persistir([]);
}

export function contarCarrito() {
  return leerCarrito().reduce((suma, item) => suma + item.cantidad, 0);
}

export function resumenCarrito(domicilio = 0, minimo = 0) {
  const items = leerCarrito();
  const subtotal = items.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  const envio = items.length ? Number(domicilio) || 0 : 0;
  const piso = Number(minimo) || 0;
  return {
    items,
    subtotal,
    domicilio: envio,
    total: subtotal + envio,
    minimo: piso,
    falta: Math.max(0, piso - subtotal),
    requiereFormula: items.some((item) => item.requiere_formula)
  };
}

export function itemsParaPedido() {
  return leerCarrito().map((item) => ({
    id: item.id,
    cantidad: item.cantidad
  }));
}

export function sincronizarCarrito(productos) {
  const mapa = new Map((productos || []).map((producto) => [String(producto.id), producto]));
  let aviso = "";
  const items = leerCarrito().map((item) => {
    const producto = mapa.get(item.id);
    if (!producto) return item;
    const stock = Math.max(0, Math.trunc(Number(producto.stock) || 0));
    if (stock < 1) {
      aviso = `${item.nombre} se agotó y salió del carrito.`;
      return { ...item, cantidad: 0, stock: 0 };
    }
    if (item.cantidad > stock) aviso = `Ajustamos ${item.nombre} al stock disponible.`;
    return normalizar({
      ...item,
      nombre: producto.nombre,
      marca: producto.marca,
      presentacion: producto.presentacion,
      precio: producto.precio,
      precio_anterior: producto.precio_anterior,
      stock,
      requiere_formula: producto.requiere_formula,
      imagen: producto.imagen,
      cantidad: Math.min(item.cantidad, stock)
    });
  }).filter((item) => item.cantidad > 0 && item.stock !== 0);
  const json = JSON.stringify(items);
  if (json !== localStorage.getItem(LLAVE)) persistir(items);
  return aviso;
}
