export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key === "hidden") node.hidden = true;
    else if (key === "disabled") node.disabled = true;
    else if (key === "checked") node.checked = true;
    else if (key === "value") node.value = String(value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function limpiar(node) {
  node.replaceChildren();
}

export function fragmento(texto) {
  const frag = document.createDocumentFragment();
  const partes = String(texto).split(/(EDITAR(?::[^.]*)?)/g);
  for (const parte of partes) {
    if (!parte) continue;
    if (parte.startsWith("EDITAR")) {
      const marca = document.createElement("span");
      marca.className = "por-confirmar";
      marca.textContent = "Por confirmar";
      frag.append(marca);
    } else frag.append(document.createTextNode(parte));
  }
  return frag;
}
