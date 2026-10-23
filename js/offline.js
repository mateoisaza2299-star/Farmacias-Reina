import { iniciarPwa } from "./pwa.js";

document.querySelector("[data-reintentar]")?.addEventListener("click", () => location.reload());
iniciarPwa();
