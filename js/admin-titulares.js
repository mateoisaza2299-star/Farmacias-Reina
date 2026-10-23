import { supabase } from "./admin-cliente.js";
import { negocio } from "./config.js";
import { diaBogota, esActivo } from "./admin-datos.js";
import { el } from "./dom.js";
import { dinero, fechaHora, mensajeError, soloDigitos } from "./format.js";
import { etiquetaEstado } from "./pedidos.js";

const CERRADOS = new Set(["entregado", "cancelado", "rechazado"]);
const ABIERTAS = new Set(["abierta", "prorrogada"]);
const TIPOS = { consulta: "Consulta", reclamo: "Reclamo" };
const ESTADOS = { abierta: "Abierta", prorrogada: "Prorrogada", respondida: "Respondida", cerrada: "Cerrada" };
const NOTA_PRORROGA = "Se informó al titular de la prórroga.";
const AVISO_SUPRESION = "La supresión no procede cuando existe un deber legal de conservar la información.";

export function sumarHabiles(iso, dias, festivos = []) {
  const fecha = fechaUtc(iso);
  const cantidad = Number(dias);
  if (!fecha || !Number.isFinite(cantidad) || cantidad < 1) return "";
  const libres = conjuntoFestivos(festivos);
  let quedan = Math.floor(cantidad);
  while (quedan > 0) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    if (esHabil(fecha, libres)) quedan -= 1;
  }
  return isoDe(fecha);
}

export function margenHabil(hoy, vence, festivos = []) {
  if (!esIso(hoy) || !esIso(vence)) return -1;
  if (vence < hoy) return -1;
  if (vence === hoy) return 0;
  const libres = conjuntoFestivos(festivos);
  const cursor = fechaUtc(hoy);
  const fin = vence;
  let total = 0;
  while (isoDe(cursor) < fin) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (esHabil(cursor, libres)) total += 1;
  }
  return total;
}

export function nivelPlazo(margen) {
  if (margen < 0) return "rojo";
  if (margen <= 3) return "ambar";
  return "verde";
}

export function diaDe(valor) {
  const texto = String(valor || "").trim();
  if (esIso(texto)) return texto;
  if (!texto) return "";
  return diaBogota(texto);
}

function esIso(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""));
}

function fechaUtc(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isoDe(fecha) {
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${mes}-${dia}`;
}

function conjuntoFestivos(festivos) {
  const lista = Array.isArray(festivos) ? festivos : [];
  return new Set(lista.map((item) => String(item || "").trim()).filter(esIso));
}

function esHabil(fecha, festivos) {
  const dia = fecha.getUTCDay();
  if (dia === 0 || dia === 6) return false;
  return !festivos.has(isoDe(fecha));
}

function festivosNegocio() {
  const lista = negocio.legal && negocio.legal.festivos;
  return Array.isArray(lista) ? lista : [];
}

function hoy() {
  return diaBogota(new Date());
}

function instante(iso) {
  return `${iso}T12:00:00-05:00`;
}

function fechaCorta(iso) {
  const fecha = fechaUtc(iso);
  if (!fecha) return "";
  fecha.setUTCHours(17, 0, 0, 0);
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" }).format(fecha);
}

function textoPlazo(margen) {
  if (margen < 0) return "Vencida";
  if (margen === 0) return "Vence hoy";
  if (margen === 1) return "1 día hábil";
  return `${margen} días hábiles`;
}

function diasPlazo(tipo) {
  return tipo === "reclamo" ? 15 : 10;
}

function diasProrroga(tipo) {
  return tipo === "reclamo" ? 8 : 5;
}

function cuentaRpc(data) {
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string" && /^-?\d+$/.test(data.trim())) return Number(data.trim());
  if (Array.isArray(data)) return data.length === 1 ? cuentaRpc(data[0]) : data.length;
  if (data && typeof data === "object") {
    for (const clave of ["anonimizados", "anonimizadas", "cantidad", "count", "total"]) {
      const n = Number(data[clave]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function csvCelda(valor) {
  let texto = String(valor ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function conFormula(pedido) {
  return String(pedido.formula_path || "").trim().length > 0;
}

function rutaFormula(pedido) {
  return String(pedido.formula_path || "").replace(/^\/+/, "").replace(/^formulas\//, "");
}

function itemsDe(pedido) {
  const lista = pedido.pedido_items || pedido.items || [];
  return Array.isArray(lista) ? lista : [];
}

export function crearTitulares(deps) {
  const { avisar, btn, hojaDe, abrirHoja, cerrarHoja, ocupado, vacio, onCambio } = deps;
  let pedidos = [];
  let telefono = "";
  let solicitudes = [];
  let filtroEstado = "";
  let filtroTipo = "";
  let busquedaHecha = false;

  function avisoCambio() {
    if (typeof onCambio === "function") onCambio();
  }

  function margenDe(fila) {
    return margenHabil(hoy(), diaDe(fila.vence), festivosNegocio());
  }

  function alerta() {
    let n = 0;
    let nivel = "ambar";
    solicitudes.forEach((fila) => {
      if (!ABIERTAS.has(fila.estado)) return;
      const luz = nivelPlazo(margenDe(fila));
      if (luz === "verde") return;
      n += 1;
      if (luz === "rojo") nivel = "rojo";
    });
    return { n, nivel };
  }

  function puedeAnonimizar() {
    return busquedaHecha && pedidos.length > 0 && !pedidos.some((pedido) => esActivo(pedido.estado) || conFormula(pedido));
  }

  function formulasCerradas() {
    return pedidos.filter((pedido) => CERRADOS.has(pedido.estado) && conFormula(pedido));
  }

  async function cargar(silencio) {
    const { data, error } = await supabase
      .from("solicitudes_titulares")
      .select("id,tipo,titular,contacto,descripcion,recibida,vence,estado,respuesta,respondida_en")
      .order("vence", { ascending: true })
      .limit(200);
    if (error) {
      if (!silencio) avisar(mensajeError(error));
      return false;
    }
    solicitudes = data || [];
    avisoCambio();
    return true;
  }

  function pintar() {
    pintarSolicitudes();
  }

  function confirmar(titulo, parrafos, etiqueta, clase, icono, onOk) {
    const hoja = hojaDe("hoja-titular");
    hoja.setAttribute("aria-labelledby", "titular-hoja-titulo");
    const aceptar = btn(etiqueta, `${clase} btn-lg`, icono, {
      "data-foco": "true",
      onclick: async (evento) => {
        ocupado(evento.currentTarget, true);
        try {
          await onOk();
          cerrarHoja(hoja);
        } catch (error) {
          avisar(mensajeError(error));
          ocupado(evento.currentTarget, false);
        }
      }
    });
    hoja.replaceChildren(
      el("div", { class: "asa", "aria-hidden": "true" }),
      el("div", { class: "hoja-cabeza" },
        el("h2", { id: "titular-hoja-titulo" }, titulo),
        btn("", "btn-neutro", "close", { "aria-label": "Cerrar", onclick: () => cerrarHoja(hoja) })
      ),
      el("div", { class: "hoja-cuerpo" }, ...parrafos.map((linea) => el("p", {}, linea))),
      el("div", { class: "pie-accion" },
        btn("Volver", "btn-neutro btn-lg", "close", { onclick: () => cerrarHoja(hoja) }),
        aceptar
      )
    );
    abrirHoja(hoja);
  }

  function textoAviso() {
    if (!busquedaHecha) return "Busca un celular para ver los pedidos del titular.";
    if (!pedidos.length) return "No hay pedidos con ese celular.";
    if (puedeAnonimizar()) return `Puedes anonimizar los pedidos cerrados. ${AVISO_SUPRESION}`;
    return `Anonimizar está disponible cuando no hay pedidos activos ni fórmulas adjuntas. ${AVISO_SUPRESION}`;
  }

  function pintarAcciones() {
    const caja = document.querySelector("[data-titular-acciones]");
    const aviso = document.querySelector("[data-titular-aviso]");
    if (aviso) aviso.textContent = textoAviso();
    if (!caja) return;
    const hay = busquedaHecha && pedidos.length > 0;
    caja.replaceChildren(
      btn("Exportar datos del titular", "btn-neutro", "copy", {
        disabled: !hay,
        onclick: () => confirmar(
          "Exportar datos del titular",
          ["Este archivo contiene datos personales del titular: pedidos, productos, estados, fechas y autorizaciones. Descárgalo solo para atender el derecho de acceso."],
          "Descargar",
          "btn-principal",
          "copy",
          exportar
        )
      }),
      btn("Eliminar fórmulas del titular", "btn-peligro", "trash", {
        disabled: !formulasCerradas().length,
        onclick: () => confirmar(
          "Eliminar fórmulas del titular",
          ["Se borran del almacenamiento privado las fórmulas de los pedidos cerrados de este celular y se deja vacío el archivo en cada uno. Los pedidos activos no se modifican."],
          "Eliminar",
          "btn-peligro",
          "trash",
          eliminarFormulas
        )
      }),
      btn("Anonimizar datos del titular", "btn-peligro", "shield", {
        disabled: !puedeAnonimizar(),
        onclick: () => confirmar(
          "Anonimizar datos del titular",
          [
            "Se anonimizan los pedidos cerrados de este celular.",
            AVISO_SUPRESION
          ],
          "Anonimizar",
          "btn-peligro",
          "shield",
          anonimizar
        )
      })
    );
  }

  function lineaPedido(pedido) {
    const formula = conFormula(pedido);
    return el("article", { class: "tarjeta titular-datos" },
      el("div", { class: "linea" },
        el("strong", {}, pedido.numero ? `N.º ${pedido.numero}` : "Sin número"),
        el("span", { class: "insignia", "data-estado": pedido.estado || "otro" }, etiquetaEstado(pedido.estado))
      ),
      el("p", {}, `Fecha: ${fechaHora(pedido.created_at) || "Sin registro"}`),
      el("p", {}, `Total: ${pedido.total == null ? "Sin registro" : dinero(pedido.total)}`),
      el("p", {}, `Fórmula adjunta: ${formula ? "Sí" : "No"}`),
      el("p", {}, `Versión de la política: ${String(pedido.politica_version || "").trim() || "Sin registro"}`),
      el("p", {}, `Autorización de datos: ${fechaHora(pedido.autorizo_datos_en) || "Sin registro"}`),
      el("p", {}, `Autorización de la fórmula: ${fechaHora(pedido.autorizo_formula_en) || "Sin registro"}`)
    );
  }

  function pintarPedidos() {
    const caja = document.querySelector("[data-titular-pedidos]");
    if (!caja) return;
    if (!busquedaHecha) {
      caja.replaceChildren(el("p", { class: "muted" }, "Los pedidos del titular aparecen aquí."));
      return;
    }
    if (!pedidos.length) {
      caja.replaceChildren(vacio("Sin pedidos", "No hay pedidos asociados a ese celular."));
      return;
    }
    caja.replaceChildren(...pedidos.map(lineaPedido));
  }

  async function buscar(origen) {
    const entrada = document.querySelector("#titular-celular");
    const tel = typeof origen === "string" && /^\d{10}$/.test(origen)
      ? origen
      : soloDigitos(entrada ? entrada.value : "").slice(0, 10);
    if (entrada && entrada.value !== tel && /^\d{10}$/.test(tel)) entrada.value = tel;
    if (!/^\d{10}$/.test(tel)) {
      avisar("Escribe un celular de 10 dígitos.");
      return;
    }
    const boton = document.querySelector("[data-titular-buscar]");
    ocupado(boton, true);
    try {
      let respuesta = await supabase
        .from("pedidos")
        .select("id,numero,created_at,estado,total,nombre,telefono,direccion,barrio,indicaciones,formula_path,politica_version,autorizo_datos_en,autorizo_formula_en,pedido_items(nombre,presentacion,cantidad,precio)")
        .or(`telefono.eq.${tel},telefono.eq.57${tel}`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (respuesta.error) {
        respuesta = await supabase
          .from("pedidos")
          .select("id,numero,created_at,estado,total,nombre,telefono,direccion,barrio,indicaciones,formula_path,politica_version,autorizo_datos_en,autorizo_formula_en")
          .or(`telefono.eq.${tel},telefono.eq.57${tel}`)
          .order("created_at", { ascending: false })
          .limit(500);
      }
      if (respuesta.error) throw respuesta.error;
      pedidos = respuesta.data || [];
      telefono = tel;
      busquedaHecha = true;
      pintarPedidos();
      pintarAcciones();
    } catch (error) {
      avisar(mensajeError(error));
    } finally {
      ocupado(boton, false);
    }
  }

  function filasCsv(pedido) {
    const items = itemsDe(pedido);
    const base = [
      pedido.numero ?? "",
      fechaHora(pedido.created_at) || pedido.created_at || "",
      etiquetaEstado(pedido.estado),
      pedido.total == null ? "" : pedido.total,
      pedido.nombre || "",
      pedido.telefono || "",
      pedido.direccion || "",
      pedido.barrio || "",
      pedido.indicaciones || "",
      conFormula(pedido) ? "Sí" : "No",
      String(pedido.politica_version || "").trim(),
      fechaHora(pedido.autorizo_datos_en) || "",
      fechaHora(pedido.autorizo_formula_en) || ""
    ];
    const productos = items.length ? items : [{ nombre: "", presentacion: "", cantidad: "", precio: "" }];
    return productos.map((item) => [...base, item.nombre || "", item.presentacion || "", item.cantidad ?? "", item.precio ?? ""]);
  }

  async function exportar() {
    const encabezado = ["Número", "Fecha", "Estado", "Total", "Nombre", "Celular", "Dirección", "Barrio", "Indicaciones", "Fórmula adjunta", "Versión de la política", "Autorización de datos", "Autorización de la fórmula", "Producto", "Presentación", "Cantidad", "Precio"];
    const filas = pedidos.flatMap(filasCsv);
    const texto = `\uFEFF${[encabezado, ...filas].map((fila) => fila.map(csvCelda).join(",")).join("\r\n")}`;
    const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = el("a", { href: url, download: "derecho-acceso.csv" });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    avisar("Archivo descargado. Contiene datos personales.");
  }

  async function eliminarFormulas() {
    const lista = formulasCerradas();
    if (!lista.length) {
      avisar("No hay fórmulas en pedidos cerrados.");
      return;
    }
    let n = 0;
    for (const pedido of lista) {
      const ruta = rutaFormula(pedido);
      if (ruta) {
        const quitado = await supabase.storage.from("formulas").remove([ruta]);
        if (quitado.error) throw quitado.error;
      }
      let respuesta = await supabase.from("pedidos").update({ formula_path: null }).eq("id", pedido.id);
      if (respuesta.error) respuesta = await supabase.from("pedidos").update({ formula_path: "" }).eq("id", pedido.id);
      if (respuesta.error) throw respuesta.error;
      pedido.formula_path = "";
      n += 1;
    }
    avisar(n === 1 ? "Se eliminó 1 fórmula." : `Se eliminaron ${n} fórmulas.`);
    await buscar(telefono);
  }

  async function anonimizar() {
    const { data, error } = await supabase.rpc("anonimizar_cliente", { p_telefono: telefono });
    if (error) throw error;
    const n = cuentaRpc(data);
    const cuenta = n === 1 ? "1 pedido anonimizado" : `${n} pedidos anonimizados`;
    avisar(`${cuenta}. ${AVISO_SUPRESION}`);
    await buscar(telefono);
  }

  function abrirNueva() {
    const hoja = hojaDe("hoja-solicitud");
    hoja.setAttribute("aria-labelledby", "solicitud-titulo");
    const tipo = el("select", { id: "solicitud-tipo" },
      el("option", { value: "consulta" }, "Consulta"),
      el("option", { value: "reclamo" }, "Reclamo")
    );
    const titular = el("input", { id: "solicitud-titular", maxlength: "120", autocomplete: "off", required: true });
    const contacto = el("input", { id: "solicitud-contacto", maxlength: "160", autocomplete: "off", required: true });
    const descripcion = el("textarea", { id: "solicitud-descripcion", rows: "4", maxlength: "2000", required: true });
    const recibida = el("input", { id: "solicitud-recibida", type: "date", value: hoy(), required: true });
    const vence = el("p", { id: "solicitud-vence", class: "muted" }, "");
    const error = el("p", { class: "form-error", hidden: true });
    const guardar = btn("Guardar solicitud", "btn-principal btn-lg", "check", { "data-foco": "true" });
    const actualizar = () => {
      const fecha = recibida.value;
      const plazo = sumarHabiles(fecha, diasPlazo(tipo.value), festivosNegocio());
      vence.textContent = plazo ? `Vence el ${fechaCorta(plazo)}.` : "Elige una fecha de recepción válida.";
    };
    tipo.addEventListener("change", actualizar);
    recibida.addEventListener("change", actualizar);
    actualizar();
    guardar.addEventListener("click", async () => {
      const fecha = recibida.value;
      const nombre = titular.value.trim();
      const medio = contacto.value.trim();
      const texto = descripcion.value.trim();
      const clase = tipo.value === "reclamo" ? "reclamo" : "consulta";
      const plazo = sumarHabiles(fecha, diasPlazo(clase), festivosNegocio());
      if (!esIso(fecha) || !plazo || nombre.length < 2 || medio.length < 3 || texto.length < 3) {
        error.hidden = false;
        error.textContent = "Completa el titular, el contacto, la descripción y una fecha de recepción válida.";
        return;
      }
      error.hidden = true;
      ocupado(guardar, true);
      const { error: fallo } = await supabase.from("solicitudes_titulares").insert({
        tipo: clase,
        titular: nombre,
        contacto: medio,
        descripcion: texto,
        recibida: instante(fecha),
        vence: instante(plazo),
        estado: "abierta"
      });
      if (fallo) {
        avisar(mensajeError(fallo));
        ocupado(guardar, false);
        return;
      }
      cerrarHoja(hoja);
      avisar("Solicitud registrada.");
      if (await cargar(true)) pintar();
    });
    hoja.replaceChildren(
      el("div", { class: "asa", "aria-hidden": "true" }),
      el("div", { class: "hoja-cabeza" },
        el("h2", { id: "solicitud-titulo" }, "Nueva solicitud"),
        btn("", "btn-neutro", "close", { "aria-label": "Cerrar", onclick: () => cerrarHoja(hoja) })
      ),
      el("div", { class: "hoja-cuerpo" },
        el("label", { class: "campo", for: "solicitud-tipo" }, "Tipo", tipo),
        el("label", { class: "campo", for: "solicitud-titular" }, "Nombre del titular", titular),
        el("label", { class: "campo", for: "solicitud-contacto" }, "Contacto", contacto),
        el("label", { class: "campo", for: "solicitud-descripcion" }, "Descripción", descripcion),
        el("label", { class: "campo", for: "solicitud-recibida" }, "Fecha de recepción", recibida),
        vence,
        error
      ),
      el("div", { class: "pie-accion" },
        btn("Volver", "btn-neutro btn-lg", "close", { onclick: () => cerrarHoja(hoja) }),
        guardar
      )
    );
    abrirHoja(hoja);
  }

  async function prorrogar(fila) {
    if (fila.estado !== "abierta" || (fila.tipo !== "consulta" && fila.tipo !== "reclamo")) return;
    const extra = diasProrroga(fila.tipo);
    const actual = diaDe(fila.vence) || hoy();
    const plazo = sumarHabiles(actual, extra, festivosNegocio());
    if (!plazo) throw new Error("No pudimos calcular la prórroga.");
    const previa = String(fila.descripcion || "").trim();
    const descripcion = previa.includes(NOTA_PRORROGA) ? previa : (previa ? `${previa}\n${NOTA_PRORROGA}` : NOTA_PRORROGA);
    const { data, error } = await supabase
      .from("solicitudes_titulares")
      .update({ estado: "prorrogada", vence: instante(plazo), descripcion })
      .eq("id", fila.id)
      .eq("estado", "abierta")
      .select("id");
    if (error) throw error;
    if (!data || !data.length) {
      avisar("Esa solicitud ya no se puede prorrogar.");
    } else {
      avisar("Prórroga registrada. Se informó al titular.");
    }
    if (await cargar(true)) pintar();
  }

  function abrirRespuesta(fila) {
    const hoja = hojaDe("hoja-respuesta");
    hoja.setAttribute("aria-labelledby", "respuesta-titulo");
    const texto = el("textarea", { id: "respuesta-texto", rows: "5", maxlength: "2000", required: true });
    const fecha = el("input", { id: "respuesta-fecha", type: "date", value: hoy(), required: true });
    const error = el("p", { class: "form-error", hidden: true });
    const guardar = btn("Guardar respuesta", "btn-principal btn-lg", "check", { "data-foco": "true" });
    guardar.addEventListener("click", async () => {
      const respuesta = texto.value.trim();
      const dia = fecha.value;
      if (respuesta.length < 3 || !esIso(dia)) {
        error.hidden = false;
        error.textContent = "Escribe la respuesta y elige la fecha.";
        return;
      }
      error.hidden = true;
      ocupado(guardar, true);
      const { data, fallo } = await marcarRespondida(fila, respuesta, dia);
      if (fallo) {
        avisar(mensajeError(fallo));
        ocupado(guardar, false);
        return;
      }
      if (!data || !data.length) avisar("Esa solicitud ya no admite la respuesta.");
      else avisar("Solicitud marcada como respondida.");
      cerrarHoja(hoja);
      if (await cargar(true)) pintar();
    });
    hoja.replaceChildren(
      el("div", { class: "asa", "aria-hidden": "true" }),
      el("div", { class: "hoja-cabeza" },
        el("h2", { id: "respuesta-titulo" }, "Marcar respondida"),
        btn("", "btn-neutro", "close", { "aria-label": "Cerrar", onclick: () => cerrarHoja(hoja) })
      ),
      el("div", { class: "hoja-cuerpo" },
        el("label", { class: "campo", for: "respuesta-texto" }, "Respuesta", texto),
        el("label", { class: "campo", for: "respuesta-fecha" }, "Fecha de respuesta", fecha),
        error
      ),
      el("div", { class: "pie-accion" },
        btn("Volver", "btn-neutro btn-lg", "close", { onclick: () => cerrarHoja(hoja) }),
        guardar
      )
    );
    abrirHoja(hoja);
  }

  async function marcarRespondida(fila, respuesta, dia) {
    const resultado = await supabase
      .from("solicitudes_titulares")
      .update({ estado: "respondida", respuesta, respondida_en: instante(dia) })
      .eq("id", fila.id)
      .in("estado", ["abierta", "prorrogada"])
      .select("id");
    return { data: resultado.data, fallo: resultado.error };
  }

  async function cerrarSolicitud(fila) {
    const { data, error } = await supabase
      .from("solicitudes_titulares")
      .update({ estado: "cerrada" })
      .eq("id", fila.id)
      .neq("estado", "cerrada")
      .select("id");
    if (error) throw error;
    if (!data || !data.length) avisar("Esa solicitud ya está cerrada.");
    else avisar("Solicitud cerrada.");
    if (await cargar(true)) pintar();
  }

  function luzDe(fila) {
    if (!ABIERTAS.has(fila.estado)) return null;
    const margen = margenDe(fila);
    const nivel = nivelPlazo(margen);
    return el("span", { class: `luz luz-${nivel}` },
      el("span", { class: "luz-punto", "aria-hidden": "true" }),
      el("span", {}, textoPlazo(margen))
    );
  }

  function accionesSolicitud(fila) {
    const botones = [];
    if (fila.estado === "abierta" && (fila.tipo === "consulta" || fila.tipo === "reclamo")) {
      const extra = diasProrroga(fila.tipo);
      botones.push(btn("Prorrogar", "btn-neutro", "rotate", {
        onclick: () => confirmar(
          "Prorrogar solicitud",
          [`Se suman ${extra} días hábiles al vencimiento. Queda registrado que se informó al titular. Esta prórroga no se puede deshacer.`],
          "Prorrogar",
          "btn-principal",
          "rotate",
          () => prorrogar(fila)
        )
      }));
    }
    if (ABIERTAS.has(fila.estado)) {
      botones.push(btn("Marcar respondida", "btn-principal", "check", { onclick: () => abrirRespuesta(fila) }));
    }
    if (fila.estado !== "cerrada") {
      botones.push(btn("Cerrar", "btn-peligro", "close", {
        onclick: () => confirmar(
          "Cerrar solicitud",
          ["La solicitud queda cerrada."],
          "Cerrar",
          "btn-peligro",
          "close",
          () => cerrarSolicitud(fila)
        )
      }));
    }
    return botones;
  }

  function tarjetaSolicitud(fila) {
    return el("article", { class: "tarjeta bloque" },
      el("div", { class: "linea" },
        luzDe(fila),
        el("span", { class: "insignia" }, TIPOS[fila.tipo] || "Solicitud"),
        el("span", { class: "insignia" }, ESTADOS[fila.estado] || "Estado")
      ),
      el("p", {}, el("strong", {}, fila.titular || "Sin nombre")),
      fila.contacto ? el("p", { class: "muted" }, fila.contacto) : null,
      el("p", {}, fila.descripcion || ""),
      el("p", {}, `Recibida: ${fechaCorta(diaDe(fila.recibida)) || "Sin fecha"}`),
      el("p", {}, `Vence: ${fechaCorta(diaDe(fila.vence)) || "Sin fecha"}`),
      fila.respuesta ? el("p", {}, el("strong", {}, "Respuesta: "), fila.respuesta) : null,
      fila.respondida_en ? el("p", { class: "muted" }, `Respondida: ${fechaCorta(diaDe(fila.respondida_en))}`) : null,
      el("div", { class: "acciones-inline" }, ...accionesSolicitud(fila))
    );
  }

  function listaFiltrada() {
    return solicitudes
      .filter((fila) => (!filtroEstado || fila.estado === filtroEstado) && (!filtroTipo || fila.tipo === filtroTipo))
      .slice()
      .sort((a, b) => (diaDe(a.vence) || "9999-99-99").localeCompare(diaDe(b.vence) || "9999-99-99"));
  }

  function grupoFiltro(etiqueta, actual, opciones, cambiar) {
    const grupo = el("div", { class: "seg", role: "group", "aria-label": etiqueta });
    opciones.forEach(([valor, texto]) => {
      grupo.append(el("button", {
        type: "button",
        "aria-pressed": valor === actual ? "true" : "false",
        onclick: () => cambiar(valor)
      }, texto));
    });
    return grupo;
  }

  function pintarFiltros() {
    const caja = document.querySelector("[data-titular-filtros]");
    if (!caja) return;
    caja.replaceChildren(
      grupoFiltro("Estado", filtroEstado, [["", "Todos"], ["abierta", "Abierta"], ["prorrogada", "Prorrogada"], ["respondida", "Respondida"], ["cerrada", "Cerrada"]], (valor) => {
        filtroEstado = valor;
        pintarFiltros();
        pintarSolicitudes();
      }),
      grupoFiltro("Tipo", filtroTipo, [["", "Todos"], ["consulta", "Consulta"], ["reclamo", "Reclamo"]], (valor) => {
        filtroTipo = valor;
        pintarFiltros();
        pintarSolicitudes();
      })
    );
  }

  function pintarSolicitudes() {
    const caja = document.querySelector("[data-solicitudes]");
    if (!caja) return;
    const lista = listaFiltrada();
    if (!lista.length) {
      caja.replaceChildren(vacio("Sin solicitudes", "Las consultas y los reclamos de los titulares aparecen aquí."));
      return;
    }
    caja.replaceChildren(...lista.map(tarjetaSolicitud));
  }

  function armar(panel) {
    const celular = el("input", {
      id: "titular-celular",
      type: "tel",
      inputmode: "numeric",
      autocomplete: "off",
      maxlength: "10",
      placeholder: "3000000000",
      "aria-describedby": "titular-busca-ayuda"
    });
    celular.addEventListener("input", () => {
      const digitos = soloDigitos(celular.value).slice(0, 10);
      if (celular.value !== digitos) celular.value = digitos;
    });
    const form = el("form", { class: "busca-titular" },
      el("label", { class: "campo", for: "titular-celular" }, "Celular del titular", celular),
      btn("Buscar", "btn-principal", "search", { "data-titular-buscar": "true", type: "submit" })
    );
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      buscar();
    });
    panel.append(
      el("div", { class: "encabezado" },
        el("div", {},
          el("h1", { id: "titulo-titulares" }, "Titulares"),
          el("p", { class: "muted", id: "titular-busca-ayuda" }, "Busca por el celular de 10 dígitos para atender un derecho del titular.")
        )
      ),
      el("section", { class: "tarjeta bloque", "aria-label": "Búsqueda del titular" },
        form,
        el("div", { class: "acciones-inline titular-acciones", "data-titular-acciones": "true" }),
        el("p", { class: "muted titular-aviso", "data-titular-aviso": "true" }),
        el("div", { class: "lista-simple", "data-titular-pedidos": "true", "aria-live": "polite" })
      ),
      el("section", { class: "bloque", "aria-labelledby": "titulo-solicitudes" },
        el("div", { class: "encabezado" },
          el("h2", { id: "titulo-solicitudes" }, "Registro de solicitudes"),
          btn("Nueva solicitud", "btn-principal", "plus", { onclick: abrirNueva })
        ),
        el("div", { class: "bloque", "data-titular-filtros": "true" }),
        el("div", { class: "lista-simple", "data-solicitudes": "true" })
      )
    );
    pintarAcciones();
    pintarFiltros();
    pintarPedidos();
    pintarSolicitudes();
  }

  async function mostrar() {
    pintarSolicitudes();
    if (await cargar(false)) pintar();
  }

  return { armar, mostrar, cargar, pintar, alerta };
}
