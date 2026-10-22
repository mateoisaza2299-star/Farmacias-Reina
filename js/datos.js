import { supabase } from "./supabase.js";

let promesa = null;

function tiempoDe(data) {
  if (!data) return "";
  const valor = data.tiempoEntrega ?? data.tiempo_entrega ?? "";
  const texto = String(valor ?? "").trim();
  if (!texto || texto.toLowerCase() === "null") return "";
  return texto;
}

async function cargar() {
  const { data, error } = await supabase.from("config").select("*").limit(1).maybeSingle();
  if (error || !data) {
    return { id: 1, domicilio: 0, pedido_minimo: 0, abierto: true, tiempoEntrega: "" };
  }
  return {
    id: data.id,
    domicilio: Number(data.domicilio) || 0,
    pedido_minimo: Number(data.pedido_minimo) || 0,
    abierto: data.abierto !== false,
    tiempoEntrega: tiempoDe(data)
  };
}

export function leerConfig(forzar = false) {
  if (forzar || !promesa) promesa = cargar();
  return promesa;
}
