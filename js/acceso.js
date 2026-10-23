import { supabase } from "./admin-cliente.js";

const REDIR = "reina_redir";
const FRENO = "reina_freno";
const VENTANA = 10000;
const SESION_ROTA = ["session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt", "session_expired"];

function esAdmin(filas, usuario) {
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

function sesionAusente(error) {
  if (!error) return false;
  const nombre = String(error.name || "");
  const codigo = String(error.code || "");
  const mensaje = String(error.message || "").toLowerCase();
  if (nombre === "AuthSessionMissingError") return true;
  if (SESION_ROTA.includes(codigo)) return true;
  return mensaje.includes("session missing") || mensaje.includes("auth session missing");
}

export function codigoAcceso(error) {
  const nombre = String(error?.name || "");
  const mensaje = String(error?.message || "").toLowerCase();
  if (nombre === "TypeError" || nombre === "AuthRetryableFetchError" || mensaje.includes("failed to fetch") || mensaje.includes("network")) return "red";
  const codigo = typeof error?.code === "string" ? error.code : "";
  const bruto = codigo || nombre || (error?.status ? String(error.status) : "") || "error";
  const limpio = String(bruto).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return limpio || "error";
}

export function destinoAcceso(estado) {
  if (estado === "ok") return { destino: "panel", aviso: "" };
  if (estado === "necesita-mfa") return { destino: "login", aviso: "verificacion" };
  if (estado === "no-admin") return { destino: "login", aviso: "acceso" };
  if (estado === "sin-sesion") return { destino: "login", aviso: "" };
  return { destino: "error", aviso: "" };
}

function motivoCorto(valor) {
  return String(valor || "bucle").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "bucle";
}

function marcasRedir() {
  try {
    const datos = JSON.parse(sessionStorage.getItem(REDIR) || "[]");
    return Array.isArray(datos) ? datos.filter((item) => typeof item === "number") : [];
  } catch {
    return [];
  }
}

export function tomarFreno() {
  try {
    const valor = sessionStorage.getItem(FRENO) || "";
    if (!valor) return "";
    sessionStorage.removeItem(FRENO);
    return motivoCorto(valor);
  } catch {
    return "";
  }
}

export async function cerrarSesionLocal() {
  try { await supabase.auth.signOut({ scope: "local" }); } catch {}
  try { localStorage.removeItem("reina-admin-auth"); } catch {}
  try { sessionStorage.removeItem("reina-admin-auth"); } catch {}
}

function enLogin() {
  return /admin-login\.html$/.test(location.pathname);
}

export async function ir(destino, motivo) {
  const ahora = Date.now();
  const recientes = marcasRedir().filter((marca) => ahora - marca < VENTANA);
  recientes.push(ahora);
  try { sessionStorage.setItem(REDIR, JSON.stringify(recientes)); } catch {}
  if (recientes.length > 2) {
    try { sessionStorage.removeItem(REDIR); } catch {}
    await cerrarSesionLocal();
    try { sessionStorage.setItem(FRENO, motivoCorto(motivo)); } catch {}
    if (!enLogin()) location.replace("admin-login.html");
    return false;
  }
  location.replace(destino);
  return true;
}

export async function estadoAcceso() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      if (sesionAusente(error)) return { estado: "sin-sesion" };
      return { estado: "error", detalle: codigoAcceso(error) };
    }
    if (!user) return { estado: "sin-sesion" };
    const nivel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel.error) return { estado: "error", detalle: codigoAcceso(nivel.error) };
    const actual = nivel.data?.currentLevel || "aal1";
    const siguiente = nivel.data?.nextLevel || actual;
    if (actual !== "aal2" && siguiente === "aal2") {
      const lista = await supabase.auth.mfa.listFactors();
      if (lista.error) return { estado: "error", detalle: codigoAcceso(lista.error) };
      const factor = (lista.data?.totp || []).find((item) => item.status === "verified") || null;
      if (factor?.id) return { estado: "necesita-mfa", factorId: factor.id };
    }
    const { data, error: fallo } = await supabase.from("admins").select("*").limit(20);
    if (fallo) return { estado: "error", detalle: codigoAcceso(fallo) };
    if (!esAdmin(data, user)) return { estado: "no-admin" };
    return { estado: "ok", usuario: user };
  } catch (error) {
    return { estado: "error", detalle: codigoAcceso(error) };
  }
}
