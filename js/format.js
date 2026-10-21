export function dinero(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(numero);
}

export function descuento(precio, anterior) {
  const actual = Number(precio);
  const antes = Number(anterior);
  if (!Number.isFinite(actual) || !Number.isFinite(antes) || antes <= actual || antes <= 0) return 0;
  return Math.round((1 - actual / antes) * 100);
}

export function esFormula(valor) {
  return valor === true || valor === "true" || valor === "t" || valor === 1 || valor === "1" || valor === "si" || valor === "sí";
}

export function sanearBusqueda(texto) {
  return String(texto || "")
    .normalize("NFKC")
    .replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

export function celularValido(texto) {
  return /^3\d{9}$/.test(String(texto || "").replace(/\D/g, ""));
}

export function soloDigitos(texto) {
  return String(texto || "").replace(/\D/g, "");
}

export function fechaHora(valor) {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(fecha);
}

export function parseNumero(valor) {
  let texto = String(valor ?? "").trim().replace(/[$\s]/g, "");
  if (!texto) return NaN;
  if (texto.includes(",") && texto.includes(".")) {
    if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) texto = texto.replace(/\./g, "").replace(",", ".");
    else texto = texto.replace(/,/g, "");
  } else if (texto.includes(",")) {
    const partes = texto.split(",");
    if (partes.length === 2 && partes[1].length <= 2) texto = partes[0].replace(/\./g, "") + "." + partes[1];
    else texto = texto.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) texto = texto.replace(/\./g, "");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : NaN;
}

export function debounce(fn, espera) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), espera);
  };
}

const ERRORES = [
  ["sin stock", "Sin stock. Uno o más productos no alcanzan para la cantidad pedida."],
  ["pedido minimo", "Pedido mínimo. El valor de los productos no alcanza el mínimo de la droguería."],
  ["falta la formula", "Falta la fórmula médica. Adjunta la foto o el PDF vigente para continuar."],
  ["celular invalido", "Celular inválido. Debe tener 10 dígitos y empezar por 3."],
  ["cerrado", "Por ahora no estamos recibiendo pedidos."],
  ["producto no disponible", "Hay un producto que ya no está disponible. Revisa el carrito."],
  ["no autorizado", "No tienes permiso para hacer este cambio."]
];

export function mensajeError(error) {
  const bruto = String((error && (error.message || error.error_description || error.details)) || "");
  const limpio = bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [clave, texto] of ERRORES) {
    if (limpio.includes(clave)) return texto;
  }
  if (/invalid login credentials|invalid credentials/.test(limpio)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/.test(limpio)) return "Debes confirmar el correo antes de entrar.";
  if (bruto && bruto.length < 180 && !/select |insert |jwt|stack|permission denied/i.test(bruto)) return bruto;
  return "No pudimos completar la acción. Intenta de nuevo.";
}

export function mensajeAuth(error) {
  const texto = mensajeError(error);
  if (texto === "No pudimos completar la acción. Intenta de nuevo.") return "No pudimos iniciar sesión. Revisa el correo y la contraseña.";
  return texto;
}
