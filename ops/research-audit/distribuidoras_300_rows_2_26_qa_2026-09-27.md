# Auditoría QA — `Distribuidoras_300`, filas 2–26

- Fecha de lectura: 2026-09-27 (America/Buenos_Aires)
- Spreadsheet: `1HoVbDf_In8urKkiUnfkE-j3TPq0vrI4pjfPoAYKJYl8`
- Solapa: `Distribuidoras_300`
- Alcance: primer bloque contiguo de 25 registros existentes, filas 2–26.
- Modo: sólo lectura. No se modificó Google Sheets ni se realizó ningún envío.

## Resultado ejecutivo

| Resultado | Cantidad |
| --- | ---: |
| PASS | 0 |
| REVIEW | 8 |
| DISCARD | 17 |
| Total | 25 |

La estructura comercial sí conserva exactamente las 12 columnas exigidas, en el orden correcto:

`Rubro`, `Empresa`, `Ubicación`, `WhatsApp`, `Web`, `Email`, `Rating`, `Reseñas analizadas`, `Problemas`, `ANALISIS NEGOCIO`, `Mensaje WhatsApp`, `Mensaje Email`.

Ninguna fila está lista para `RESEARCH_VALIDADO` ni para aprobación de copy:

1. Las 25 filas incumplen `Reseñas analizadas = analizadas/total accesible`: todas contienen sólo un entero (`3`, `8`, `10`, `11`, `12`, `13` o `17`). Por eso tampoco se puede demostrar desde la planilla que la muestra incluya exclusivamente reseñas de 1–3 estrellas.
2. Los 25 pares de borradores están presentes y tienen algún grado de personalización, pero todos fallan el contrato actual: incluyen `¿`, agregan `Saludos, WIS` desde copy, no ofrecen dos horarios concretos y no aclaran que la idea se entrega aunque no haya contratación posterior. Las filas 2 y 23 además contienen la frase prohibida “En WIS armamos automatizaciones”. Las filas 23–26 ni siquiera ofrecen prototipo.
3. Los análisis suelen ser coherentes internamente con `Problemas`, pero no traen evidencia durable (URL/ficha de reseñas, fecha, estrellas y universo accesible). Deben tratarse como hipótesis hasta recapturar evidencia.
4. Diecisiete registros son corporaciones grandes, grupos multinacionales o cadenas de escala incompatible con el foco mediana/chica.

## Criterio de estado

- `PASS`: cumple tamaño, canal corporativo verificable, WhatsApp explícito cuando se carga, conteo `x/y`, problemas sustentados y copy conforme.
- `REVIEW`: el prospecto podría servir, pero faltan verificaciones o correcciones materiales.
- `DISCARD`: empresa claramente grande/multinacional o fuera del foco definido; no conviene invertir en reparar la fila.

## Hallazgos por fila

### Fila 2 — Makro Argentina — DISCARD

- Tamaño: cadena nacional de gran escala; su web oficial lista múltiples tiendas. Incompatible con el foco mediana/chica.
- Contacto: sólo web en la fila; faltan email/WhatsApp corporativos, aunque la web oficial sí publica correos para compras por volumen/proveedores.
- Reseñas: `11`, formato inválido; no demuestra universo accesible ni filtro 1–3 estrellas.
- Problema/análisis: coherencia interna, pero intenta una solución regional/multisucursal propia de una cuenta enterprise.
- Copy: personalizado, pero no aprobable; además usa “En WIS armamos automatizaciones”.
- Corrección propuesta: descartar la fila, no reparar copy. Fuente: https://makro.com.ar/tiendas/ y https://makro.com.ar/preguntas-frecuentes/

### Fila 3 — Supermercados Mayoristas Yaguar S.A. — DISCARD

- Tamaño: cadena de 19 sucursales visibles en el sitio oficial; fuera del foco mediana/chica.
- Contacto: la fila deja email/WhatsApp vacíos, aunque el material oficial publica contactos de sucursal y un WhatsApp oficial.
- Reseñas: `3`, formato inválido y cobertura indeterminada.
- Problema/análisis: coherentes, pero abarcan operación por sucursal de una cadena grande.
- Copy: personalizado, no conforme con el cierre/gates actuales.
- Corrección propuesta: descartar. Fuente: https://yaguar.com.ar/sucursales/

### Fila 4 — Ricardo Nini S.A. (NINI Mayorista) — DISCARD

- Tamaño: aunque tiene dos sucursales, la propia empresa declara tienda de 14.000 m², centros de distribución de 30.000 m², 80+ camiones diarios y 4.500 clientes; escala incompatible.
- Contacto: sólo web; no hay canal corporativo directo en la fila.
- Reseñas: `13`, formato inválido.
- Problema/análisis: consistentes, pero la solución propuesta es enterprise/multisector.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://www.nini.com.ar/nosotros

### Fila 5 — Maxiconsumo S.A. — DISCARD

- Tamaño: la página oficial enumera decenas de sucursales en todo el país; no es mediana/chica.
- Contacto: sólo web en la fila.
- Reseñas: `13`, formato inválido.
- Problema/análisis: coherentes, pero demasiado amplios (precio, promociones, cajas y gerencia) para el contrato de un único problema verificable.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://www.maxiconsumo.com/sucursales/

### Fila 6 — Masivos S.A. — REVIEW

- Tamaño: operación familiar concentrada en Mataderos/CABA; encaja mejor que las cadenas nacionales, pero conviene documentar tamaño antes de aprobar.
- Contacto: `ventas@masivos.com` y `11 4187-7697` están publicados por la empresa como correo de ventas y WhatsApp. Cumple canal verificable y WhatsApp explícito.
- Reseñas: `13`, formato inválido; falta `analizadas/total accesible` y evidencia de estrellas.
- Problema/análisis: coherencia alta entre precios/promociones, pedidos, entregas y flujo propuesto; reducir a un solo problema verificable.
- Copy: presente y personalizado, pero no aprobable por los incumplimientos comunes.
- Corrección propuesta: mantener en REVIEW; recapturar reseñas 1–3 con `x/y`, elegir un único patrón y reescribir ambos mensajes. Fuente: https://www.masivos.com/app

### Fila 7 — Tadicor S.A. — REVIEW

- Tamaño: la web muestra una operación local, pero la vinculación pública con Grupo Dinosaurio requiere aclarar propiedad/escala antes de decidir.
- Contacto: sólo web; no hay email ni WhatsApp corporativo cargado.
- Reseñas: `8`, formato inválido.
- Problema/análisis: internamente coherente alrededor de cajas/espera; mezcla además precio, surtido y reposición.
- Copy: personalizado, no aprobable.
- Corrección propuesta: verificar razón social/propiedad y un canal corporativo; si sigue dentro de tamaño, recapturar reseñas y concentrar el caso en espera/cajas. Fuentes: https://tadicorcordoba.com/ y https://grupodinosaurio.com/gracias-tadicor/

### Fila 8 — David Rosental e Hijos S.A.C.I. — DISCARD

- Tamaño: distribuidor nacional que además presenta Cadena DAR con más de 50 supermercados; excede el foco.
- Contacto: `ventas@rosental.com.ar` es oficial. La web confirma “Pedidos Whatsapp”, pero no permitió corroborar en texto el número exacto `+54 9 341 615-8882`; no debe darse por verificado sólo por la etiqueta de la celda.
- Reseñas: `17`, formato inválido.
- Problema/análisis: mezcla atención, listas, proveedores y cobranzas; no es un único problema.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://www.rosental.com.ar/

### Fila 9 — Casa Oslé S.A.C.I.F.I. y A. — REVIEW

- Tamaño: parece empresa regional/familiar y puede entrar en foco; falta evidencia explícita de dotación/cobertura.
- Contacto: la fila publica WhatsApp y email de sucursal, pero la tienda oficial actual visible expone otro WhatsApp general (`+54 9 11 5834-9524`) y `info@osle.com.ar`. El contacto de la fila debe reverificarse para esa sucursal.
- Reseñas: `13`, formato inválido.
- Problema/análisis: coherente; conviene elegir facturación A o precios visibles, no cinco fricciones a la vez.
- Copy: personalizado, no aprobable.
- Corrección propuesta: confirmar canal vigente de Los Polvorines, recapturar reseñas y reescribir sobre un solo problema. Fuente: https://osle.tiendapropio.com/search?categoryId=0b0a76c8-d0cd-11ee-939f-02b74da699f1

### Fila 10 — Distribuidora Lamadrid S.R.L. — REVIEW

- Tamaño: la web oficial la define como empresa familiar de capital nacional, una instalación de 4.000 m²; compatible en principio.
- Contacto: `dralamadrid@speedy.com.ar` está confirmado. El sitio oficial sólo publica `4280-4394` como teléfono; no hay evidencia de que `+54 9 11 3568-1246` sea WhatsApp empresarial.
- Reseñas: `13`, formato inválido.
- Problema/análisis: el circuito facturación–pago–control–despacho es consistente; retirar ruido/camiones y el reclamo de producto no atribuible.
- Copy: personalizado, no aprobable.
- Corrección propuesta: vaciar WhatsApp salvo prueba oficial, conservar email, recapturar reseñas y centrar el copy en el circuito de espera. Fuente: https://www.distrilamadrid.com.ar/

### Fila 11 — Luvik S.A. — REVIEW

- Tamaño: distribuidora con foco GBA, 180+ proveedores y 2.600 SKU; parece mediana, pero debe quedar documentado.
- Contacto: `info@luvik.com.ar` y `+54 9 11 4057-0629` aparecen en la web oficial; el sitio ofrece canal de WhatsApp. Cumple contacto verificable.
- Reseñas: `10`, formato inválido.
- Problema/análisis: alta coherencia en respuesta, pedido, factura, entrega y posventa; aún son demasiadas variantes para un solo mensaje.
- Copy: personalizado, no aprobable.
- Corrección propuesta: mantener en REVIEW, reconstruir `x/y` con reseñas 1–3 y focalizar en seguimiento de pedidos o SLA de respuesta. Fuente: https://luvik.com.ar/

### Fila 12 — Café América Mayorista S.A. — REVIEW

- Tamaño: empresa familiar regional con casa central y seis sucursales; límite superior del foco, pero no una corporación nacional.
- Contacto: `recepcion@cafeamerica.com.ar` está confirmado y el sitio ofrece WhatsApp; el número exacto `+54 9 264 481-2242` no quedó visible en la fuente textual y requiere validar el enlace.
- Reseñas: `13`, formato inválido.
- Problema/análisis: consistente, pero mezcla colas, POS, promociones, precio, teléfono y calidad.
- Copy: personalizado, no aprobable.
- Corrección propuesta: validar el destino exacto del botón WhatsApp; recapturar reseñas; elegir POS/promociones o colas como único patrón. Fuentes: https://www.americamayorista.com/quienessomos y https://www.americamayorista.com/contacto

### Fila 13 — Cormorán S.A. Servicio Mayorista — REVIEW

- Tamaño: cobertura regional declarada en Santa Fe, Córdoba, Santiago del Estero y Entre Ríos; falta cuantificar escala para decidir si sigue en foco.
- Contacto: la fila sólo tiene web, pero el sitio oficial publica `info@cormoran.com.ar` y `03492 506003`. Debe incorporarse un canal corporativo verificable en una revisión posterior.
- Reseñas: `13`, formato inválido.
- Problema/análisis: coherente con ingreso/descarga de proveedores, aunque parece más un caso logístico B2B que un problema de cliente final; descartar críticas genéricas sin detalle.
- Copy: personalizado, no aprobable.
- Corrección propuesta: validar tamaño y pertinencia; si continúa, usar el email oficial, recapturar reseñas y limitar la propuesta a turnos/descarga. Fuentes: https://www.cormoran.com.ar/registro y https://www.cormoran.com.ar/ayuda/contacto

### Fila 14 — Autoservicio Mayorista Diarco S.A. — DISCARD

- Tamaño: la empresa declara más de 90 sucursales; fuera del foco.
- Contacto: `info@diarco.com.ar` es corporativo, pero no compensa el desajuste de tamaño.
- Reseñas: `13`, formato inválido.
- Problema/análisis: coherente, pero diseñado para 98 sucursales/escala enterprise.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://www.diarco.com.ar/nosotros/

### Fila 15 — Supermayorista Vital (Maycar S.A.) — DISCARD

- Tamaño: 20 sucursales oficiales en el país; cadena grande.
- Contacto: email presente. El número de WhatsApp cargado no incluye evidencia explícita en la celda y no se confirmó en la web oficial consultada.
- Reseñas: `13`, formato inválido.
- Problema/análisis: consistente, pero multisucursal/enterprise.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://www.vital.com.ar/sucursales/

### Fila 16 — Mayorista Oscar David — REVIEW

- Tamaño: actor regional de Cuyo; falta evidencia concluyente para clasificarlo como mediano o grande.
- Contacto: sólo web y sin canal directo en la fila.
- Reseñas: `13`, formato inválido.
- Problema/análisis: coherente entre circulación, reposición, caja y control, pero no está reducido a un único problema.
- Copy: personalizado, no aprobable.
- Corrección propuesta: documentar cantidad de locales/dotación y canal corporativo; si entra en foco, recapturar reseñas y centrar el mensaje en circulación/reposición o POS. Fuente secundaria de sucursales: https://tarjetaultra.com/oscar-david-mayorista/

### Fila 17 — Coca-Cola FEMSA de Buenos Aires S.A. — DISCARD

- Tamaño: embotellador multinacional; en Argentina declara 58.000 puntos de venta, tres centros de distribución y dos plantas.
- Contacto: email corporativo presente, pero la empresa está fuera de foco.
- Reseñas: `13`, formato inválido.
- Problema/análisis: propone trazabilidad masiva B2B; solución enterprise.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://coca-colafemsa.com/sobre-nosotros/presencia-internacional.html

### Fila 18 — Coca-Cola Andina Argentina — DISCARD

- Tamaño: grupo con operaciones en cuatro países; la franquicia argentina declara 64.000+ clientes y 17,3 millones de habitantes cubiertos.
- Contacto: sólo web en la fila.
- Reseñas: `13`, formato inválido.
- Problema/análisis: consistente, pero enterprise.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://www.koandina.com/nuestra-compania/nuestras-operaciones/

### Fila 19 — Cervecería y Maltería Quilmes S.A.I.C.A. y G. — DISCARD

- Tamaño: forma parte de AB InBev; la información corporativa publicada describe miles de empleados, plantas, centros de distribución y red nacional.
- Contacto: sólo web en la fila.
- Reseñas: `12`, formato inválido.
- Problema/análisis: basado en experiencia de transportistas/planta y con señales históricas; no encaja con el prospecto pyme.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://cerveceriaymalteriaquilmes.com/

### Fila 20 — CCU Argentina — DISCARD

- Tamaño: compañía multinacional con siete plantas productivas y varios centros de distribución en Argentina.
- Contacto: email presente; fuera de foco por escala.
- Reseñas: `13`, formato inválido.
- Problema/análisis: solución de red logística, claramente enterprise.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://www.ccu.com.ar/somos-ccu/como-lo-hacemos/nuestras-plantas/

### Fila 21 — Grupo Cepas — DISCARD

- Tamaño: grupo líder multicategoría, exportador a cinco continentes y socio/distribuidor de marcas globales.
- Contacto: `info@grupocepas.com` es corporativo; la escala invalida el prospecto.
- Reseñas: `13`, formato inválido.
- Problema/análisis: mezcla calidad, atención y alta comercial; alcance de grupo.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuentes: https://grupocepas.com/es/gc-en-el-mundo y https://www.grupocepas.com/es/nuestros-negocios

### Fila 22 — Grupo Peñaflor S.A.U. — DISCARD

- Tamaño: 2.900 empleados, 12 instalaciones, presencia en más de 95 países y top 10 mundial; incompatibilidad directa.
- Contacto: email corporativo presente; fuera de foco.
- Reseñas: `12`, formato inválido.
- Problema/análisis: además se apoya en señales mayormente históricas de ecommerce.
- Copy: personalizado, no aprobable.
- Corrección propuesta: descartar. Fuente: https://grupopenaflor.com.ar/es/quienes-somos

### Fila 23 — Bodega Norton — DISCARD

- Tamaño: una de las cinco principales exportadoras argentinas, cinco viñedos y presencia en más de 70 países; fuera del foco.
- Contacto: email presente. El número de WhatsApp no está rotulado como empresarial ni quedó corroborado en la web consultada.
- Reseñas: `13`, formato inválido; además la descripción reconoce mezclar 10 críticas con 3 reseñas destacadas, contrario a analizar exclusivamente 1–3 estrellas.
- Problema/análisis: mezcla turismo, reservas, señalización, precio y porciones; no es un único problema.
- Copy: personalizado, pero usa “En WIS armamos automatizaciones”, no ofrece prototipo y falla los cierres obligatorios.
- Corrección propuesta: descartar. Fuente: https://www.norton.com.ar/historia/

### Fila 24 — Fratelli Branca Destilerías Argentina — DISCARD

- Tamaño: subsidiaria/operación de un grupo internacional; fuera del foco mediana/chica.
- Contacto: sólo web; sin email o WhatsApp corporativo en la fila.
- Reseñas: `13`, formato inválido.
- Problema/análisis: reconoce comentarios no corroborados y mezcla producto, acceso, guardia y logística; evidencia insuficiente.
- Copy: presente y algo personalizado, pero no ofrece prototipo y falla los cierres obligatorios.
- Corrección propuesta: descartar. Fuente corporativa local: https://www.branca.com.ar/

### Fila 25 — Campari Argentina — DISCARD

- Tamaño: subsidiaria de un grupo global con red directa en 26 mercados y 25 sitios productivos; fuera del foco.
- Contacto: email presente; fuera de foco.
- Reseñas: `13`, formato inválido.
- Problema/análisis: coherencia parcial en ruteo de consultas, pero combina consumidores, distribuidores, disponibilidad y calidad.
- Copy: presente y personalizado, pero no ofrece prototipo y falla los cierres obligatorios.
- Corrección propuesta: descartar. Fuente: https://www.camparigroup.com/sites/default/files/downloads/01.1%20Campari%20Group_Annual%20Report%20for%20the%20year%20ended%2031%20December%202024_0.pdf

### Fila 26 — Pernod Ricard Argentina — DISCARD

- Tamaño: operación local de un grupo multinacional de bebidas; incompatible con el foco.
- Contacto: email corporativo presente; fuera de foco.
- Reseñas: `13`, formato inválido.
- Problema/análisis: ruteo de consumidores/distribuidores a escala corporativa; no es pyme.
- Copy: presente y personalizado, pero no ofrece prototipo y falla los cierres obligatorios.
- Corrección propuesta: descartar; no invertir en recaptura ni copy.

## Orden sugerido para QA del orquestador

1. Marcar como `DESCARTADO` las 17 filas `DISCARD`; no reciclar sus borradores.
2. Mantener las 8 filas `REVIEW` fuera de `RESEARCH_VALIDADO` hasta que el rol owner recapture evidencia de reseñas 1–3 y complete `analizadas/total accesible`.
3. Resolver tamaño y contacto primero en filas 7, 9, 13 y 16; así se evita rehacer copy de prospectos que después podrían descartarse.
4. Validar/corregir WhatsApp en filas 9, 10 y 12. En la fila 10 debe vaciarse si no aparece evidencia oficial explícita.
5. Para filas 6, 11 y 12, priorizar recaptura porque ya tienen email corporativo verificable y mejor ajuste de tamaño.
6. Rehacer copy únicamente después de QA de research; usar un problema verificable, dos variantes controladas, sin `¿`, sin firma, con prototipo, garantía de entrega de la idea aun sin continuidad y dos horarios concretos.

