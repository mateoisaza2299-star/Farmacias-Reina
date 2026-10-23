# Droguerías Reina

Tienda de pedidos con domicilio a Funza y Mosquera. El horario de atención es de lunes a sábado, de 8:00 am a 8:00 pm. El cliente paga al recibir, en efectivo o por transferencia. El pago en línea con Wompi está visible y apagado.

## Editar `js/config.js`

Ahí vive lo que no sale de Supabase:

- `modoPrueba`: en `true` la tienda publica `noindex` y los botones de WhatsApp usan `whatsappPrueba`. Para salir a producción hay que dejarlo en `false`. Hoy se queda en `true` a propósito.
- `pagoEnLinea`: déjalo en `false` hasta que Wompi esté desplegado y con llaves. En `false` no hay cobro en línea.
- `pagoAlRecibir`: déjalo en `true`. Así se puede pagar en efectivo o por transferencia al recibir.
- `instalable`: en `true` la tienda se puede instalar como app y registra el service worker. En `false` quita el worker, borra sus cachés y esconde los botones de instalación.
- `whatsappPrueba` y `whatsappPedidos`: el número de prueba y el de la droguería, en formato `57` + celular, sin signos.
- Nombre, dirección, horario, cobertura, Instagram y datos legales (`razonSocial`, `nit`, `regente`). Lo que siga en `Por confirmar` se ve así en el pie.

No pongas llaves de Wompi en este archivo. El navegador no las necesita.

## Cargar productos por CSV

En el panel interno, pestaña Productos, usa Importar CSV. La primera fila es el encabezado. Sirve coma o punto y coma.

Columnas:

`nombre`, `marca`, `presentacion`, `categoria`, `precio`, `stock`, `requiere_formula`

- `precio` y `stock` van en números. El stock es entero y no puede ser negativo.
- `requiere_formula` acepta `si`, `no`, `true`, `false`, `1` o `0`. Vacío cuenta como no.
- Si el nombre y la presentación ya existen, esa fila actualiza el producto. Si no, lo crea activo.

Categorías válidas, con el nombre exacto:

- Medicamentos
- Cuidado personal
- Bebé
- Belleza y dermocosmética
- Vitaminas y suplementos
- Botiquín
- Adulto mayor
- Hogar y aseo

El importador también reconoce, sin importar mayúsculas ni tildes, estos alias: `medicamentos`, `cuidado personal`, `bebe`, `belleza`, `belleza y dermocosmetica`, `vitaminas`, `vitaminas y suplementos`, `botiquin`, `adulto mayor`, `hogar`, `hogar y aseo`. Una categoría distinta se guarda tal cual y puede no aparecer en los filtros de la tienda.

## Domicilio y pedido mínimo

En el panel, pestaña Ajustes:

- Costo de domicilio
- Pedido mínimo
- Recibiendo pedidos

Los dos montos son pesos colombianos y se leen de la fila `config` de Supabase (`domicilio` y `pedido_minimo`). Si apagas Recibiendo pedidos, la tienda muestra el aviso y no deja confirmar.

## De modo prueba a producción

1. Completa en `js/config.js` la razón social, el NIT y el regente. Hoy dicen `Por confirmar`.
2. Confirma que `whatsappPedidos` es el WhatsApp real de la droguería.
3. Revisa domicilio y pedido mínimo en Ajustes.
4. Haz un pedido de prueba de punta a punta: catálogo, pago al recibir, Mis pedidos y WhatsApp.
5. Deja `pagoEnLinea` en `false` y `pagoAlRecibir` en `true`.
6. Cambia `modoPrueba` a `false`. Con eso los botones de WhatsApp pasan al número de pedidos y las páginas públicas dejan de llevar `noindex`. El panel, el acceso interno y la página 404 siguen en `noindex`.

## Activar Wompi más adelante

Hoy el pago en línea se muestra apagado, con la etiqueta Próximamente, y no hay campos de tarjeta. No lo enciendas todavía. Falta esto:

1. Desplegar las funciones de Supabase. La tienda llama a `crear-pago` y espera `publicKey`, `referencia`, `centavos` y `firma`.
2. Dejar creadas las llaves de Wompi en esas funciones, no en el repositorio. Si la llave pública es de pruebas (`pub_test_`), la pantalla lo dice.
3. Confirmar que, cuando Wompi avisa el pago, el pedido pasa a `pagado`. El seguimiento solo espera ese estado: esa confirmación todavía no está cerrada en este proyecto.
4. Después de eso, y solo después, pon `pagoEnLinea` en `true` en `js/config.js`. `pagoAlRecibir` puede seguir en `true`.

Los datos de la tarjeta se escriben en la pantalla de Wompi, nunca en esta tienda.

## Instalar la app

Con `instalable` en `true`, el sitio ofrece el botón Instalar app en el menú, el pie, la confirmación del pedido y Mis pedidos.

- Android o computador con Chrome o Edge: abre la tienda publicada, espera a que cargue y toca Instalar app. El navegador pide confirmación y agrega el acceso directo.
- iPhone o iPad: toca Instalar app y sigue los tres pasos (Compartir, Agregar a pantalla de inicio, Agregar). Si la página está abierta dentro de Instagram, Facebook, TikTok u otra app, primero ábrela en Safari o Chrome.
- Para probar en el computador también sirve Chrome, con el sitio servido por HTTPS o en `localhost`. En el panel Aplicación deben verse el manifiesto, los íconos y el service worker activo.

La app guarda el cascarón en cachés que empiezan por `reina-`. Al publicar un cambio grande, sube el número de `reina-shell-vN` y `reina-img-vN` en `sw.js`. Quien ya tenga la app abierta ve el aviso “Hay una versión nueva” y, al tocar Actualizar, carga esa versión. Las cachés viejas de ese prefijo se borran solas.

Si algún día la tienda sale de GitHub Pages a un dominio propio, cambia en `manifest.webmanifest` el `id`, el `scope` y el `start_url` para que apunten a ese origen. El `id` tiene que ser único y quedar dentro del `scope`. Hoy el `id` es `/Farmacias-Reina/` porque ese dominio de GitHub Pages también aloja otras páginas.
