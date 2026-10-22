import "./motion.js";
import { supabase } from "./supabase.js";
import { mensajeAuth } from "./format.js";
import { esAdmin } from "./acceso.js";
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
const boton = document.querySelector("[data-entrar]");

function mostrar(texto) {
  aviso.hidden = !texto;
  aviso.textContent = texto || "";
}

if (new URLSearchParams(location.search).get("aviso") === "acceso") {
  mostrar("Esta cuenta no tiene acceso al panel.");
}

supabase.auth.getSession().then(async ({ data }) => {
  if (!data.session) return;
  const { data: filas, error } = await supabase.from("admins").select("*").limit(20);
  if (!error && esAdmin(filas, data.session.user)) location.href = "admin.html";
});

form?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
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
  location.href = "admin.html";
});
