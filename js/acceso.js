import { supabase } from "./supabase.js";

export function esAdmin(filas, usuario) {
  if (!filas?.length || !usuario) return false;
  const id = String(usuario.id || "").toLowerCase();
  const correo = String(usuario.email || "").toLowerCase();
  const coincide = filas.some((fila) => Object.values(fila).some((valor) => {
    const texto = String(valor ?? "").toLowerCase();
    return texto === id || (correo && texto === correo);
  }));
  if (coincide) return true;
  const tieneIdentidad = filas.some((fila) => ["user_id", "email", "correo", "usuario"].some((campo) => campo in fila));
  return !tieneIdentidad;
}

export async function sesionAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, ok: false };
  const { data, error: fallo } = await supabase.from("admins").select("*").limit(20);
  if (fallo || !esAdmin(data, user)) {
    await supabase.auth.signOut();
    return { user: null, ok: false };
  }
  return { user, ok: true };
}
