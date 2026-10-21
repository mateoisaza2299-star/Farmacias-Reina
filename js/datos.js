import { supabase } from "./supabase.js";

let promesa = null;

async function cargar() {
  const { data, error } = await supabase.from("config").select("id,domicilio,pedido_minimo,abierto").limit(1).maybeSingle();
  if (error || !data) {
    return { id: 1, domicilio: 0, pedido_minimo: 0, abierto: true };
  }
  return {
    id: data.id,
    domicilio: Number(data.domicilio) || 0,
    pedido_minimo: Number(data.pedido_minimo) || 0,
    abierto: data.abierto !== false
  };
}

export function leerConfig(forzar = false) {
  if (forzar || !promesa) promesa = cargar();
  return promesa;
}
