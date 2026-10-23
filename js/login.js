import "./motion.js";
import { supabase } from "./admin-cliente.js";
import { mensajeAuth } from "./format.js";
import { cerrarSesionLocal, destinoAcceso, estadoAcceso, ir, tomarFreno } from "./acceso.js";
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
const avisoUrl = new URLSearchParams(location.search).get("aviso");
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

function botonReintentar() {
  let nodo = document.querySelector("[data-reintentar]");
  if (nodo) return nodo;
  nodo = document.createElement("button");
  nodo.type = "button";
  nodo.className = "btn btn-ghost";
  nodo.dataset.reintentar = "true";
  nodo.textContent = "Reintentar";
  nodo.hidden = true;
  nodo.addEventListener("click", () => aplicarEstado());
  aviso?.after(nodo);
  return nodo;
}

function mostrarReintentar(visible) {
  const nodo = botonReintentar();
  nodo.hidden = !visible;
}

function restaurarEntrar() {
  if (!boton) return;
  boton.disabled = false;
  boton.textContent = "Entrar";
}

function avisoDeUrl() {
  if (avisoUrl === "acceso") mostrar("Esta cuenta no tiene acceso al panel.");
  if (avisoUrl === "inactividad") mostrar("Cerramos la sesión por inactividad.");
  if (avisoUrl === "verificacion") mostrar("Confirma el código de verificación para entrar.");
}

function mensajeFreno(motivo) {
  const corto = motivo ? ` ${motivo}` : "";
  return `No pudimos iniciar sesión. Intenta de nuevo.${corto}`;
}

async function aplicarEstado() {
  const freno = tomarFreno();
  if (freno) {
    await cerrarSesionLocal();
    mostrar(mensajeFreno(freno));
    mostrarPaso("clave");
    mostrarReintentar(false);
    restaurarEntrar();
    return;
  }
  let resultado;
  try {
    resultado = await estadoAcceso();
  } catch {
    mostrar(mensajeFreno("error"));
    mostrarPaso("clave");
    mostrarReintentar(true);
    restaurarEntrar();
    return;
  }
  const ruta = destinoAcceso(resultado.estado);
  if (ruta.destino === "panel") {
    const permitido = await ir("admin.html", "ok");
    if (!permitido) {
      mostrar(mensajeFreno(tomarFreno() || "bucle"));
      mostrarPaso("clave");
      mostrarReintentar(false);
      restaurarEntrar();
    }
    return;
  }
  if (resultado.estado === "necesita-mfa") {
    factorId = resultado.factorId || "";
    mostrarPaso("codigo");
    mostrarReintentar(!factorId);
    if (!factorId) mostrar("No pudimos comprobar la verificación en dos pasos.");
    else if (avisoUrl === "verificacion") mostrar("Confirma el código de verificación para entrar.");
    else mostrar("");
    restaurarEntrar();
    return;
  }
  if (resultado.estado === "no-admin") {
    await cerrarSesionLocal();
    mostrar("Esta cuenta no tiene acceso al panel.");
    mostrarPaso("clave");
    mostrarReintentar(false);
    restaurarEntrar();
    return;
  }
  if (ruta.destino === "error") {
    mostrar(`No pudimos comprobar el acceso. ${resultado.detalle || "error"}`);
    mostrarPaso("clave");
    mostrarReintentar(true);
    restaurarEntrar();
    return;
  }
  mostrarPaso("clave");
  mostrarReintentar(false);
  restaurarEntrar();
  avisoDeUrl();
}

form?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!pasoCodigo.hidden) {
    await verificar();
    return;
  }
  mostrar("");
  mostrarReintentar(false);
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
    restaurarEntrar();
    return;
  }
  await aplicarEstado();
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
    const ver = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
    if (ver.error) throw ver.error;
    await aplicarEstado();
  } catch (error) {
    mostrar(mensajeAuth(error));
  }
  botonCodigo.disabled = false;
}

document.querySelector("[data-volver]")?.addEventListener("click", async () => {
  await cerrarSesionLocal();
  factorId = "";
  if (form?.codigo) form.codigo.value = "";
  mostrar("");
  mostrarPaso("clave");
  mostrarReintentar(false);
  restaurarEntrar();
});

aplicarEstado();
