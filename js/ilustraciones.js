const TIPOS = {
  Medicamentos: ["caja-tabletas", "frasco-pastillas", "frasco-jarabe", "sobre-suero", "gotero"],
  "Cuidado personal": ["dispensador", "botella-locion"],
  Bebé: ["panales", "gotero"],
  "Belleza y dermocosmética": ["tubo-crema", "botella-locion"],
  "Vitaminas y suplementos": ["frasco-pastillas", "sobre-suero"],
  Botiquín: ["botiquin", "curas", "termometro"],
  "Adulto mayor": ["tensiometro", "termometro"],
  "Hogar y aseo": ["dispensador", "botella-locion"]
};

const TONOS = ["verde", "azul", "turquesa"];

export const PORTADA = {
  Medicamentos: "assets/productos/caja-tabletas-verde.svg",
  "Cuidado personal": "assets/productos/dispensador-turquesa.svg",
  Bebé: "assets/productos/panales-azul.svg",
  "Belleza y dermocosmética": "assets/productos/tubo-crema-turquesa.svg",
  "Vitaminas y suplementos": "assets/productos/frasco-pastillas-verde.svg",
  Botiquín: "assets/productos/botiquin-azul.svg",
  "Adulto mayor": "assets/productos/tensiometro-azul.svg",
  "Hogar y aseo": "assets/productos/botella-locion-turquesa.svg"
};

function mezcla(valor) {
  const texto = String(valor || "reina");
  let n = 0;
  for (let i = 0; i < texto.length; i += 1) n += texto.charCodeAt(i) * (i + 1);
  return n;
}

export function ilustracionDe(producto) {
  const tipos = TIPOS[producto?.categoria] || TIPOS.Medicamentos;
  const n = mezcla(producto?.id || producto?.nombre);
  return `assets/productos/${tipos[n % tipos.length]}-${TONOS[n % TONOS.length]}.svg`;
}

export function rutaImagen(producto) {
  const texto = String(producto?.imagen || "").trim();
  if (/^https?:\/\//i.test(texto)) return texto;
  const relativa = texto.replace(/^\/+/, "");
  return relativa || ilustracionDe(producto || {});
}
