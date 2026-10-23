import "./motion.js";
import { supabase } from "./admin-cliente.js";
import { mensajeAuth } from "./format.js";
import { esAdmin, factorPendiente } from "./acceso.js";
import { marcaLogo } from "./icons.js";
import { negocio } from "./config.js";

const logo = document.querySelector("[data-logo]");
if (logo) {
  if (!logo.querySelector(".logo-img")) logo.prepend(marcaLogo());
  const nombre = logo.querySelector("[data-nombre]");
  if (nombre) nombre.textContent = negocio.nombre;
}

const form = document.querySelector("#acceso");
const aviso = document.querySelector("[data-login-error]");
const pasoClave = document.querySelector("[data-paso='clave']");
const pasoCodigo = document.querySelector("[data-paso='codigo']");
const boton = document.querySelector("[data-entrar]");
let factorId = "";

function mostrar(texto) {
  if (!aviso) return;
  aviso.hidden = !texto;
  aviso.textContent = texto || "";
}

function mostrarPaso(nombre) {
  const codigo = nombre === "codigo";
  pasoClave.hidden = codigo;
  pasoClave.disabled = codigo;
  pasoCodigo.hidden = !codigo;
  pasoCodigo.disabled = !codigo;
  if (codigo) pasoCodigo.querySelector("input")?.focus();
}

const avisoUrl = new URLSearchParams(location.search).get("aviso");
if (avisoUrl === "acceso") mostrar("Esta cuenta no tiene acceso al panel.");
if (avisoUrl === "inactividad") mostrar("Cerramos la sesión por inactividad.");
if (avisoUrl === "verificacion") mostrar("Confirma el código de verificación para entrar.");

async function entrarSiAdmin(user) {
  const { data: filas, error } = await supabase.from("admins").select("*").limit(20);
  if (error || !esAdmin(filas, user)) {
    await supabase.auth.signOut();
    mostrar("Esta cuenta no tiene acceso al panel.");
    mostrarPaso("clave");
    return false;
  }
  location.href = "admin.html";
  return true;
}

async function exigirFactor() {
  const pendiente = await factorPendiente();
  if (pendiente.bloqueado) {
    mostrar("No pudimos comprobar la verificación en dos pasos.");
    return true;
  }
  if (!pendiente.factor) return false;
  factorId = pendiente.factor.id;
  mostrarPaso("codigo");
  return true;
}

supabase.auth.getSession().then(async ({ data }) => {
  if (!data.session) return;
  if (await exigirFactor()) return;
  await entrarSiAdmin(data.session.user);
});

form?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!pasoCodigo.hidden) {
    await verificar();
    return;
  }
  mostrar("");
  const correo = form.email.value.trim();
  const clave = form.password.value;
  if (!correo || !clave) {
    mostrar("Escribe el correo y la contraseña.");
    return;
  }
  boton.disabled = true;
  boton.textContent = "Entrando…";
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) {
    mostrar(mensajeAuth(error));
    boton.disabled = false;
    boton.textContent = "Entrar";
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { data: filas, error: fallo } = await supabase.from("admins").select("*").limit(20);
  if (fallo || !esAdmin(filas, user)) {
    await supabase.auth.signOut();
    mostrar("Esta cuenta no tiene acceso al panel.");
    boton.disabled = false;
    boton.textContent = "Entrar";
    return;
  }
  if (await exigirFactor()) {
    boton.disabled = false;
    boton.textContent = "Entrar";
    return;
  }
  location.href = "admin.html";
});

async function verificar() {
  mostrar("");
  const codigo = String(form.codigo.value || "").replace(/\D/g, "");
  if (codigo.length !== 6 || !factorId) {
    mostrar("Escribe el código de 6 dígitos.");
    return;
  }
  const botonCodigo = document.querySelector("[data-verificar]");
  botonCodigo.disabled = true;
  try {
    const reto = await supabase.auth.mfa.challenge({ factorId });
    if (reto.error) throw reto.error;
    const ver = await supabase.auth.mfa.verify({ factorId, challengeId: reto.data.id, code: codigo });
    if (ver.error) throw ver.error;
    const { data: { user } } = await supabase.auth.getUser();
    await entrarSiAdmin(user);
  } catch (error) {
    mostrar(mensajeAuth(error));
    botonCodigo.disabled = false;
  }
}

document.querySelector("[data-volver]")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  factorId = "";
  if (form.codigo) form.codigo.value = "";
  mostrar("");
  mostrarPaso("clave");
  boton.disabled = false;
  boton.textContent = "Entrar";
});
