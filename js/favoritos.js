const LLAVE = "favoritos_reina";

export function leerFavoritos() {
  try {
    const data = JSON.parse(localStorage.getItem(LLAVE) || "[]");
    if (!Array.isArray(data)) return [];
    return [...new Set(data.map((id) => String(id)).filter(Boolean))];
  } catch {
    return [];
  }
}

export function esFavorito(id) {
  return leerFavoritos().includes(String(id));
}

export function alternarFavorito(id) {
  const clave = String(id);
  const lista = leerFavoritos();
  const siguiente = lista.includes(clave) ? lista.filter((item) => item !== clave) : [clave, ...lista];
  localStorage.setItem(LLAVE, JSON.stringify(siguiente.slice(0, 80)));
  document.dispatchEvent(new CustomEvent("reina:favoritos"));
  return siguiente.includes(clave);
}
