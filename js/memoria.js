const FAVORITOS = "favoritos_reina";
const BUSQUEDAS = "busquedas_reina";
const VISTOS = "vistos_reina";
const DATOS = "datos_reina";

function leerLista(llave) {
  try {
    const data = JSON.parse(localStorage.getItem(llave) || "[]");
    if (!Array.isArray(data)) return [];
    return data.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function guardarLista(llave, lista) {
  localStorage.setItem(llave, JSON.stringify(lista));
}

export function leerFavoritos() {
  return leerLista(FAVORITOS);
}

export function esFavorito(id) {
  return leerFavoritos().includes(String(id));
}

export function alternarFavorito(id) {
  const clave = String(id);
  const tenia = esFavorito(clave);
  const lista = leerFavoritos().filter((item) => item !== clave);
  if (!tenia) lista.unshift(clave);
  guardarLista(FAVORITOS, lista.slice(0, 80));
  document.dispatchEvent(new CustomEvent("reina:favoritos"));
  return !tenia;
}

export function leerBusquedas() {
  return leerLista(BUSQUEDAS).slice(0, 5);
}

export function guardarBusqueda(texto) {
  const q = String(texto || "").replace(/\s+/g, " ").trim().slice(0, 50);
  if (q.length < 2) return;
  const plano = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const lista = leerBusquedas().filter((item) => item.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() !== plano);
  lista.unshift(q);
  guardarLista(BUSQUEDAS, lista.slice(0, 5));
}

export function quitarBusqueda(texto) {
  const lista = leerBusquedas().filter((item) => item !== texto);
  guardarLista(BUSQUEDAS, lista);
}

export function leerVistos() {
  return leerLista(VISTOS).slice(0, 8);
}

export function recordarVisto(id) {
  const clave = String(id || "");
  if (!clave) return;
  const lista = leerVistos().filter((item) => item !== clave);
  lista.unshift(clave);
  guardarLista(VISTOS, lista.slice(0, 8));
}

export function leerDatosCliente() {
  try {
    const data = JSON.parse(localStorage.getItem(DATOS) || "null");
    if (!data || typeof data !== "object") return null;
    return {
      nombre: String(data.nombre || ""),
      telefono: String(data.telefono || ""),
      direccion: String(data.direccion || ""),
      barrio: String(data.barrio || "")
    };
  } catch {
    return null;
  }
}

export function guardarDatosCliente(datos) {
  localStorage.setItem(DATOS, JSON.stringify({
    nombre: String(datos.nombre || "").slice(0, 80),
    telefono: String(datos.telefono || "").slice(0, 16),
    direccion: String(datos.direccion || "").slice(0, 160),
    barrio: String(datos.barrio || "").slice(0, 80)
  }));
}
