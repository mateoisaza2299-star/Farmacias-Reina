import { supabase } from "./admin-cliente.js";

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

export async function factorPendiente() {
  const nivel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel.error || !nivel.data) return { factor: null, bloqueado: false };
  if (nivel.data.currentLevel === "aal2" || nivel.data.nextLevel !== "aal2") return { factor: null, bloqueado: false };
  const lista = await supabase.auth.mfa.listFactors();
  if (lista.error) return { factor: null, bloqueado: true };
  const factor = (lista.data?.totp || []).find((item) => item.status === "verified") || null;
  return { factor, bloqueado: false };
}

export async function sesionAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, ok: false };
  const pendiente = await factorPendiente();
  if (pendiente.bloqueado) return { user: null, ok: false, aal: true };
  if (pendiente.factor) return { user: null, ok: false, aal: true };
  const { data, error: fallo } = await supabase.from("admins").select("*").limit(20);
  if (fallo || !esAdmin(data, user)) {
    await supabase.auth.signOut();
    return { user: null, ok: false };
  }
  return { user, ok: true };
}
