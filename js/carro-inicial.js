try {
  const datos = JSON.parse(localStorage.getItem("carrito_reina") || "[]");
  const n = Array.isArray(datos) ? datos.length : 0;
  document.documentElement.dataset.carro = String(n);
} catch {
  document.documentElement.dataset.carro = "0";
}
