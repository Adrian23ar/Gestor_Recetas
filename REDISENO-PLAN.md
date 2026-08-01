# Rediseño integral del frontend — Plan de ejecución

> Documento de trabajo. Marcar las casillas conforme se completa cada tarea.
> Referencia visual y convenciones: **[REDISENO-GUIA.md](./REDISENO-GUIA.md)**
> Diseño fuente: `redise-o-integral-app-de-recetas/project/Gestor Recetas - Rediseño.dc.html`

---

## Contexto

La app (Vue 3 + Pinia + Firebase + Tailwind v4) funciona, pero su UI creció por acumulación:

- Cada vista inventa sus propios estados de carga / error / vacío.
- Hay 8 modales con 8 backdrops distintos (`backdrop-brightness-50`, `bg-black/60`, `bg-black/80`…).
- Las tablas son DataTables con HTML en strings dentro de `render()` y listeners delegados por `data-action`.
- Sólo existen 3 clases CSS reutilizables (`.input-field-style`, `.input-filter-style`, `.form-radio`) y se usan de forma inconsistente.
- La matemática de costos está duplicada y **divergente** entre `RecipeCard` y `EditRecipeModal`.

El rediseño hecho en Claude Design cubre las 5 vistas y 4 modales con un lenguaje visual coherente: tarjetas de radio 24px, paleta stone/rose/emerald/amber, tipografía Nunito, tablas propias que colapsan a tarjetas en móvil y nav inferior fija.

**Objetivo:** misma lógica de negocio y misma capa de datos, frontend completamente nuevo, 100% responsive, con modo oscuro, y 3 dependencias menos.

### Decisiones tomadas

| # | Decisión |
|---|---|
| 1 | **Se mantiene el modo oscuro**, derivando variantes para cada superficie nueva (el diseño es sólo claro). |
| 2 | **Se reemplaza DataTables** por tablas Vue nativas + composable propio. |
| 3 | **Se implementan todas las funciones nuevas del diseño** (buscadores, chips de filtro, banner de alerta, barra de desglose de costo, tarjeta de estimación, timeline agrupado). |
| 4 | El formulario de ingrediente pasa a **modal**, y `EditRecipeModal` pasa a **drawer lateral** con pestañas *Ingredientes* / *Costos y márgenes* (sin pestaña *Historial*: no hay fuente de datos por receta). |

---

## Regla de oro

**No se toca la capa de datos.** Stores (`src/stores/*.js`), composables de datos y las funciones de Firebase quedan intactas salvo los 4 cambios quirúrgicos de la Fase 2. Todo lo demás es plantilla + estilos.

Contratos que **deben** preservarse al reescribir plantillas:

| Contrato | Dónde | Por qué |
|---|---|---|
| `<Transition name="modal-transition">` + div interno con clase `modal-content` | los 8 modales | `src/assets/style.css:67-77` anima ese selector; sin la clase se rompe la animación |
| `EditStockModal` emite `save` con un **Number crudo** | `src/components/EditStockModal.vue:39` | `src/views/IngredientsView.vue:157` reconstruye el objeto a partir de ese número |
| `EditRecipeModal.saveChanges` escribe `calculatedRecipeOnlyCost`, `calculatedTotalBatchCostAllIncluded`, `calculatedFinalPrice` en el payload | `src/components/EditRecipeModal.vue:218-230` | `src/composables/useProductionRecords.js:74` **rechaza registrar producción** si faltan |
| `RecipeCard` emite `delete-recipe` con `id` y `edit-recipe` con el objeto | `src/components/RecipeCard.vue:76,19` | `DashboardView` los consume |
| Un solo elemento raíz en `RecipeCard` | — | va dentro de `<TransitionGroup name="card-list">` |
| `EventDetailsModal` renderiza `changes[]` verbatim | `src/components/EventDetailsModal.vue:19-93` | cualquier campo nuevo aparece solo, sin tocar el componente |
| `TransactionModal` — cascada de resolución de tasa y `:disabled` del submit | `src/components/TransactionModal.vue:132-172,388` | lógica de negocio real; sólo se re-maqueta |

Los `data-action` / `data-id` **desaparecen** junto con DataTables: las nuevas tablas usan `@click` de Vue directamente.

---

## Fase 0 — Documentación

- [x] `REDISENO-PLAN.md` — este documento
- [x] `REDISENO-GUIA.md` — valores exactos del diseño, catálogo de clases, mapeo claro↔oscuro, breakpoints, invariantes y convenciones

---

## Fase 1 — Fundaciones (tokens, tipografía, clases base)

Nada de esto es visible por sí solo, pero todo lo demás depende de ello. **Hacer primero y completo**, o se escribe dos veces.

### 1.1 Tipografía Nunito

- [ ] `index.html:7-12` — reemplazar el `<link>` de Inter por Nunito con pesos `400;500;600;700;800` (el diseño usa 800 en los `<h1>`). Mantener los `preconnect`.
- [ ] `tailwind.config.js:54-56` — `fontFamily.sans: ['Nunito', ...defaultTheme.fontFamily.sans]`

### 1.2 Tokens de color

Los colores del diseño ya corresponden a la paleta existente en `tailwind.config.js` (stone / rose / emerald / red / amber). Único ajuste:

- [ ] `background`: `stone-50` → **`stone-100`** (`#f5f5f4`, el fondo de página del diseño)
- [ ] Añadir `'surface-muted': colors.stone['50']` (`#fafaf9`, superficie interior de tarjetas y cabeceras de tabla)

### 1.3 Tokens de forma, sombra y animación

- [ ] Añadir a `theme.extend` en `tailwind.config.js`:

```js
borderRadius: {
  card: '24px', tile: '22px', panel: '20px', nav: '18px',
  box: '16px', field: '14px', control: '12px', chip: '11px',
},
boxShadow: {
  card:    '0 1px 2px rgba(41,37,36,.04)',
  raised:  '0 1px 2px rgba(41,37,36,.04), 0 8px 24px -18px rgba(41,37,36,.5)',
  lift:    '0 2px 4px rgba(41,37,36,.05), 0 18px 34px -20px rgba(41,37,36,.55)',
  cta:     '0 6px 16px -8px rgba(225,29,72,.7)',
  modal:   '0 30px 60px -20px rgba(28,25,23,.5)',
  drawer:  '-24px 0 60px -30px rgba(28,25,23,.6)',
  toast:   '0 20px 40px -18px rgba(28,25,23,.7)',
  navbar:  '0 18px 40px -18px rgba(28,25,23,.75)',
  pill:    '0 1px 2px rgba(41,37,36,.08)',
},
keyframes: { shimmer, riseIn, slideIn },   // ver REDISENO-GUIA.md §5
animation: {
  shimmer: 'shimmer 1.4s ease-in-out infinite',
  riseIn:  'riseIn .2s ease-out',
  slideIn: 'slideIn .22s ease-out',
},
```

### 1.4 Sistema de clases en `src/assets/style.css` — **la pieza central**

Este archivo se reescribe casi por completo. Es donde vive **toda** la derivación de modo oscuro: se escribe una vez aquí y ninguna vista vuelve a repetir cadenas de 8 clases `dark:`.

- [ ] **Quitar**: los `@import` de DataTables (líneas 7-8) y todo el bloque de overrides `div.dt-*` / `table.dataTable` / `tfoot th:nth-child(n)` (líneas 79-154)
- [ ] **Mantener**: `@config`, `@import "tailwindcss"`, el import de multiselect, y las transiciones `modal-transition` / `card-list` / `slide-fade` / `fade-transition`
- [ ] **Definir** el catálogo de clases `.ui-*` con `@apply`, cada una con su variante `dark:` — el catálogo completo con su propósito está en **[REDISENO-GUIA.md §3](./REDISENO-GUIA.md)**:
  - [ ] Superficies — `.ui-card`, `.ui-card-flat`, `.ui-panel`, `.ui-card-inverted`, `.ui-stat`
  - [ ] Controles — `.ui-input`, `.ui-input-sm`, `.ui-input-error`, `.ui-select`, `.ui-textarea`, `.ui-label`
  - [ ] Botones — `.ui-btn-primary`, `.ui-btn-dark`, `.ui-btn-outline`, `.ui-btn-subtle`, `.ui-btn-ghost`, `.ui-btn-danger-ghost`, `.ui-btn-disabled`
  - [ ] Píldoras — `.ui-chip` / `.ui-chip-active`, `.ui-badge-{success,warning,danger,neutral}`, `.ui-seg` / `.ui-seg-active`, `.ui-nav-pill` / `.ui-nav-pill-active`
  - [ ] Tabla — `.ui-table`, `.ui-thead-th`, `.ui-td`, `.ui-tr`, `.ui-table-toolbar`, `.ui-table-footer`
  - [ ] Overlays — `.ui-backdrop`, `.ui-modal-box`, `.ui-drawer`
  - [ ] Estado — `.ui-skeleton`, `.ui-empty`
- [ ] Overrides de `vue-toastification` (píldora oscura abajo a la derecha, ver §3.3 de la Fase 3)

### 1.5 Nota sobre `important: true`

`tailwind.config.js:60` fuerza `!important` en todas las utilidades. Existía para ganarle a DataTables. Al eliminarlo sólo queda `@vueform/multiselect` como CSS de terceros — **mantenerlo por ahora**; quitarlo es un riesgo de regresión gratuito. Anotado como limpieza posterior.

---

## Fase 2 — Lógica compartida (4 cambios quirúrgicos)

### 2.1 `src/composables/useRecipeCosts.js` — **nuevo**

Hoy la matemática de costos está **duplicada y divergente**: `EditRecipeModal.vue:133-188` trata como 0 un ingrediente irresoluble, mientras `RecipeCard.vue:42-45` muestra `"Faltan datos."` — la tarjeta y el modal pueden contradecirse para la misma receta. Además el diseño necesita esos números en tres sitios nuevos.

- [ ] Extraer una función pura `computeRecipeCosts(recipe, globalIngredients)` con **exactamente** la fórmula de `EditRecipeModal` (no cambiar la matemática: `useProductionRecords` depende de los valores persistidos), devolviendo:
  - `ingredientCosts{}`, `totalIngredientCost`, `recipeOnlyCost`, `laborCostPerIndividualItem`, `baseCostPerIndividualItem`, `totalCostPerIndividualItem`, `sellingPrice`, `finalPrice` *(igual que hoy)*
  - `missingIngredients: [{ id, name, reason }]` — los que no se resuelven o tienen `presentationSize <= 0`
  - `isComplete: boolean` — sin faltantes, con ≥1 ingrediente e `itemsPerBatch > 0`
  - `breakdown: { ingredientsPct, laborPct, profitPct }` — para la barra de 3 segmentos: `baseCostPerIndividualItem/finalPrice`, `laborCostPerIndividualItem/finalPrice`, resto
- [ ] Consumidores: `RecipeCard`, drawer de receta, filtros del Dashboard, tarjeta de estimación de `RegisterView`

### 2.2 `src/composables/useDataTable.js` — **nuevo**

Sustituye a DataTables.

- [ ] Firma `useDataTable(rows, { searchFields, pageSize = 10, defaultSort })`
- [ ] Devuelve `{ query, page, pageSize, sortKey, sortDir, filtered, paged, total, totalPages, rangeFrom, rangeTo, next, prev, toggleSort }`
- [ ] Filtrado por substring case-insensitive sobre `searchFields`, orden estable, paginación. `query` resetea `page` a 1

### 2.3 `src/utils/eventLabels.js` — **nuevo**

El mapa de 19 tipos de evento está duplicado en `EventHistoryView.vue:56-80` y `EventDetailsModal.vue:141-166`.

- [ ] Unificarlo exportando `getEventMeta(eventType) → { label, tone }`, con `tone ∈ 'success' | 'warning' | 'danger' | 'neutral'` (creado→success, editado/actualizado→warning, eliminado→danger, stock/tasa→neutral)

### 2.4 Ajustes puntuales en composables existentes

- [ ] `useProductionRecords.js:196` — añadir `globalIngredients` al `return`. Ya está destructurado en la línea 12, sólo no se expone. Lo necesita el aviso ámbar de descuento de stock
- [ ] `useIngredients.js:165-172` — `stockStatus` usa umbrales **absolutos** (`<=5` bajo, `<=15` medio) que contradicen `IngredientsView.vue:174-182`, que usa **porcentaje** de `presentationSize` (`<=25%`, `<=60%`) — y el porcentaje es lo que dibuja el diseño. Pasar `stockStatus` a porcentaje, devolver también `stockPercent`, y borrar `getStockLevel` de la vista
- [ ] `ErrorMessage.vue` — añadir `<slot />` bajo el mensaje. Hoy `AccountingView.vue:406-413` le pasa contenido de slot que se descarta en silencio

---

## Fase 3 — Shell (`src/App.vue`)

Referencia: `.dc.html` líneas 94-123 (header) y 26-38 (media query ≤980px).

### 3.1 Escritorio (>980px)

- [ ] Header sticky, `bg-white/92` + `backdrop-blur-md`, borde inferior. Contenido en `max-w-[1240px] mx-auto px-7 py-3.5`
- [ ] **Izquierda**: logo `src/assets/icon.png` 34px `rounded-xl` + título "Mi Gestor de Recetas" (15px/600) y subtítulo "Pastelería · datos al día" (11px, stone-400)
- [ ] **Centro**: contenedor `bg-stone-100 p-1 rounded-field` con 5 `RouterLink` como píldoras (`.ui-nav-pill`); la activa es blanca con `shadow-pill`. **Sustituye a `.router-links` / `.router-link-active`** — eliminar ese CSS de `App.vue`
- [ ] **Derecha**: toggle de tema (hereda `toggleDarkMode` tal cual) + chip de usuario (`bg-stone-100 rounded-control`, avatar cuadrado stone-800 con la inicial + nombre)
- [ ] El chip abre un **menú desplegable** con "Cerrar Sesión" — el diseño no lo dibuja pero `signOutUser` tiene que caber
- [ ] Estados: `authLoading` → chip skeleton; sin usuario → `.ui-btn-primary` "Iniciar Sesión"

### 3.2 Móvil (≤980px)

- [ ] Header compacto (`px-4 py-3`), sin nav
- [ ] La nav pasa a **barra inferior fija**: `fixed left-2.5 right-2.5 bottom-2.5 z-[55] bg-stone-800 p-1.5 rounded-nav shadow-navbar`, 5 botones flex `min-w-[62px]`, texto 11px, activo `bg-stone-50 text-stone-800 rounded-[13px]`, scroll horizontal sin barra visible
- [ ] Contenedor raíz con `pb-24`
- [ ] Ocultar el nombre del usuario ≤640px (queda sólo el avatar)
- [ ] **Eliminar por completo** el menú hamburguesa y el drawer `slide-fade` (`App.vue:58-65` y `127-192`) — la barra inferior lo reemplaza
- [ ] `<main>` → `max-w-[1240px] mx-auto px-7 pt-9` (`px-4 pt-6` en móvil). Conservar la `<Transition name="fade-transition">` del `RouterView`

### 3.3 Toasts

- [ ] `main.js:46-49` — `POSITION.TOP_RIGHT` → `BOTTOM_RIGHT`
- [ ] Overrides de `.Vue-Toastification__toast` en `style.css`: píldora `bg-stone-800`, texto `stone-50` 14px/500, `rounded-box`, `shadow-toast`, `animate-riseIn`, punto de color a la izquierda según el tipo
- [ ] En `≤980px` desplazarlos a `bottom: 86px` para que no queden bajo la barra de navegación

---

## Fase 4 — Vistas

Todas siguen el mismo patrón de cabecera: `<h1>` 40px/800 `letter-spacing:-.02em` (32px ≤980px, 28px ≤640px) + subtítulo de contexto + acción primaria a la derecha, con `flex-wrap`.

### 4.1 `DashboardView` — "Recetas" *(.dc.html:125-403)*

- [ ] Cabecera: subtítulo `"{n} recetas activas · precios recalculados con el costo de hoy"`, input de búsqueda + `.ui-btn-primary` "Nueva receta"
- [ ] **Banner de alerta de stock** (líneas 138-150): `v-if` hay ingredientes con `stockPercent <= 60`; panel ámbar con una píldora por ingrediente (punto rojo ≤25%, ámbar ≤60%) + botón "Revisar inventario" → `router.push('/ingredients')`. Datos: `globalIngredients`, ya expuesto por `useDashboard`
- [ ] **Chips de filtro**: `Todas · n` / `Margen alto · n` / `Datos incompletos · n`. "Margen alto" = `profitMarginPercent >= 45`; "Datos incompletos" = `!costs.isComplete`
- [ ] **Skeleton** (líneas 158-179): 3 tarjetas `.ui-skeleton` con delays escalonados (0 / .15s / .3s), reemplaza el texto "Cargando recetas..."
- [ ] **Vacío** (líneas 181-191): tarjeta con borde punteado, título, párrafo explicativo y dos CTAs (Crear receta / Añadir ingredientes)
- [ ] **Grid**: `repeat(auto-fill, minmax(300px,1fr))` gap 20px, dentro del `<TransitionGroup name="card-list">` actual

**`RecipeCard` se reescribe entero** *(líneas 196-231, variante incompleta 307-324)*:

- [ ] Nombre + `"{itemsPerBatch} items por lote · {n} ingredientes"` + badge de margen
- [ ] Label "PVP final por item" + precio 34px + `"costo $X"`
- [ ] **Barra de desglose de 3 segmentos** (stone-800 / stone-400 / amber-500) con leyenda Ingredientes / Mano de obra / Ganancia
- [ ] Pie con `Ver receta` / `Producir` / `Eliminar`
- [ ] **Variante incompleta**: badge rojo "Incompleta" + panel gris que **nombra los ingredientes que faltan** (`missingIngredients`) + botón "Completar datos" → `/ingredients`. En esa variante no se muestra "Producir"
- [ ] `"Producir"` navega a `/register?recipe={id}` para preseleccionar

> *No se implementa* el precio en Bs. (línea 210): en el prototipo es una prop con default `false` y acoplaría el Dashboard al store de contabilidad.

### 4.2 `IngredientsView` — "Inventario" *(.dc.html:405-567)*

- [ ] **Eliminar la tarjeta de formulario inline.** El botón "Nuevo ingrediente" abre el modal (ver 5.3)
- [ ] 4 tarjetas de métrica (`repeat(auto-fit,minmax(200px,1fr))`): Total / Stock alto (emerald) / Stock medio (amber) / Stock bajo (red), con punto de color. Los computeds ya existen en la vista
- [ ] Tarjeta de tabla con toolbar: chips `Todos / Stock bajo / Stock medio / Stock alto` + input de búsqueda
- [ ] Columnas: **Ingrediente** (nombre + `"Presentación {size} {unit}"`, fusiona las columnas "Tamaño Pres." y "Unidad" de hoy), **Stock actual**, **Nivel** (barra 120px + % coloreado), **Costo presentación**, **Costo base** (`$X / unidad`, conservar la singularización de `IngredientsTable.vue:82-92`), **Acciones** (`Ajustar stock` / `Editar` / `Eliminar`)
- [ ] Pie con `"Mostrando X–Y de N ingredientes"` + Anterior/Siguiente
- [ ] Reescribir `IngredientsTable.vue` sobre `ResponsiveTable` + `useDataTable`; desaparecen `render()`, `data-action` y el listener delegado

### 4.3 `RegisterView` — "Producción" *(.dc.html:569-692)*

- [ ] Grid `1.15fr .85fr` gap 20px, **una sola columna ≤980px**
- [ ] **Izquierda, "Nuevo lote"**: selector de receta, Fecha de producción, "Items del lote" de sólo lectura derivado de `recipe.itemsPerBatch`
- [ ] **Aviso ámbar** que enumera lo que se va a descontar (`"Al registrar se descontarán 500 Gr de harina… X quedará en 0 Gr"`), calculado con `recipe.ingredients` + `globalIngredients.currentStock` (por eso el cambio 2.4)
- [ ] CTA "Registrar lote y descontar stock"
- [ ] **Derecha, tarjeta oscura de estimación**: Ganancia neta estimada (36px) + Ingreso total / Gastos op. / Mano de obra / Margen sobre ingreso. Reemplaza la cadena de una línea `selectedRecipeInfo` (`RegisterView.vue:32-39`). Misma aritmética que `useProductionRecords.js:83-87`
- [ ] Tabla "Historial de producción" con búsqueda y **fila de TOTALES** al final del tbody (fondo `surface-muted`, "Ganancia neta" en emerald)
- [ ] Extraer el objeto `:classes` del Multiselect a `src/utils/multiselectTheme.js`, compartido con el drawer — hoy está duplicado en `RegisterView.vue:93-107` y `EditRecipeModal.vue:277-291`, y **ambas copias sólo sobrescriben 12 de ~25 claves**; añadir `clear`, `caret`, `spinner`, `optionsList`, `singleLabel` para que el re-tematizado sea completo

> ⚠️ **Cambio de comportamiento intencional**: hoy `TableRegister.vue:92-118` totaliza **sólo la página visible**, escribiendo por índice en `<th>` y dependiendo del `colspan="2"`. La fila nueva es un `computed` sobre **todas las filas filtradas**, coherente con el rótulo "Totales del periodo" del diseño. Al desaparecer el `<tfoot>` se borran también las reglas `tfoot th:nth-child(n)` de `style.css`.

### 4.4 `AccountingView` — "Contabilidad" *(.dc.html:694-840)*

- [ ] 4 tarjetas: **Ingresos** (emerald, Bs. + equivalente USD debajo), **Egresos** (red), **Saldo neto** (tarjeta oscura invertida), **Tasa del día** con badge "BCV" verde, valor en ámbar 28px y botones `Actualizar del BCV` / `Manual`
- [ ] "Manual" alterna la aparición del input `newRateInput` dentro de la misma tarjeta (hoy está siempre visible)
- [ ] Sub-valor en USD = `summary.total* / currentDailyRate`
- [ ] Barra de filtros: "Periodo" + dos `<input type="date">` a la izquierda; **control segmentado** `Todos / Ingresos / Egresos` a la derecha, reemplazando el `<select v-model="filterType">`
- [ ] Tabla: **Fecha**, **Movimiento** (píldora Ingreso/Egreso + descripción, fusiona dos columnas de hoy), **Categoría**, **Monto (Bs.)**, **Tasa**, **Monto (USD)** (egresos con `−` en rojo), **Acciones**. Pie de paginación
- [ ] **Arreglar de paso**: el estado vacío comprueba `transactions.length` en vez de `filteredTransactions.length` (`AccountingView.vue:415`), y el botón de refresco usa `bg-blue-500` fuera de paleta (`línea 349`)
- [ ] **Borrar código muerto**: `totalUsdMovimientos` (113-122) y `generalError` (134-141), ninguno se renderiza

### 4.5 `EventHistoryView` — "Historial" *(.dc.html:842-890)*

El cambio más profundo: **deja de ser una tabla**.

- [ ] Cabecera + input "Buscar en el historial" (filtra `formattedHistoryEntries` en cliente)
- [ ] Tarjeta única con **cabeceras de grupo por fecha** (`"Hoy · 31 de julio"`, `"Ayer · 30 de julio"`, o `"D de mes"`) sobre fondo `surface-muted`
- [ ] Una fila por evento: hora `HH:mm` (56px, tabular), badge de tipo coloreado por `getEventMeta().tone`, descripción flexible, botón "Ver detalle"
- [ ] La descripción combina `entityName` con un resumen del primer `changes[]` (`"{label} {oldValue} → {newValue}"`), cayendo a `entry.description` si no hay cambios
- [ ] En ≤640px la fila envuelve y la descripción salta a línea completa
- [ ] Botón "Cargar más eventos" centrado al pie — ya existe como `loadHistory(true)`
- [ ] **Limpieza obligatoria del script**: eliminar `DataTablesCore`, `historyTableRef`, `dtInstance`, `initializeDataTable`, `dtColumns`, `dtOptions`, `handleTableClick`, y el **`onMounted` y el `watch(user)` duplicados** (líneas 210-236 duplican 307-325)
- [ ] **Conservar**: `loadHistory`, la paginación por cursor de Firestore, el fallback a `localStorage` y el `onUnmounted`

---

## Fase 5 — Componentes y modales

### 5.1 `src/components/ui/ResponsiveTable.vue` — **nuevo**

Reemplaza a DataTables en las 3 tablas. El diseño resuelve el móvil con selectores CSS frágiles (`[data-r~=dt] tr[data-open] td:nth-child(n)::before`, con las etiquetas escritas a mano en el CSS, líneas 40-76). Aquí se logra el **mismo resultado visual** de forma robusta: las etiquetas salen de la definición de columnas, no de `content:`.

- [ ] Props: `columns` (`[{ key, label, align, mobilePrimary?, class? }]`), `rows`, `rowKey`, `loading`, `empty`
- [ ] Slots: `cell-{key}` por columna, `actions`, `footer`, `toolbar`
- [ ] **>760px**: `<table>` real, `thead` con fondo `surface-muted`, `min-width` con scroll horizontal en el contenedor
- [ ] **≤760px**: cada fila es una tarjeta de 2 columnas (celda `mobilePrimary` | columna de acciones de máx. 128px con botones apilados). Al tocarla se expande mostrando el resto de celdas con su `label` encima y el afijo `"ver detalles"` / `"ocultar detalles"`; colapsada sólo se ve el primer botón de acción
- [ ] Pie: `"Mostrando X–Y de N {noun}"` + Anterior/Siguiente (deshabilitado en gris `stone-300`)

### 5.2 Drawer de receta — `EditRecipeModal.vue` → `RecipeDrawer.vue` *(.dc.html:893-1007)*

- [ ] Panel derecho `width: min(760px, 100%)`, `animate-slideIn`, backdrop clicable para cerrar (**hoy no cierra al hacer clic fuera**, se añade). A pantalla completa sin radios ≤640px
- [ ] Cabecera fija: eyebrow "Receta" + el nombre como **input transparente** que se revela al hover, y botón `×`
- [ ] **Pestañas**: *Ingredientes* / *Costos y márgenes*
- [ ] *Ingredientes*: fila de añadir/editar (Multiselect + Cantidad + botón `Añadir`/`Actualizar`), lista con costo calculado por línea y botones `Editar`/`Quitar`, y total "Costo total de ingredientes por lote". Conservar íntegra la lógica de `saveRecipeIngredient` / `startEdit` / `removeRecipeIngredient`, incluida la detección de duplicados
- [ ] En un ingrediente cuya cantidad supere el stock, mostrar el subtexto ámbar `"solo quedan X en stock"` (línea 943)
- [ ] *Costos y márgenes*: grid de 5 campos (Empaque, Mano de obra, Items por lote, Margen %, Buffer %) — una sola columna ≤640px — con **validación en línea**: `itemsPerBatch < 1` pinta el campo con `.ui-input-error` y muestra el mensaje bajo él
- [ ] **Tarjeta oscura "Cómo se forma el precio"** que sustituye al bloque "Resumen Financiero Sugerido": cascada Ingredientes → Empaque → Mano de obra → Costo unitario → + ganancia % → + buffer % → **PVP final** en ámbar 26px
- [ ] Pie fijo: mensaje de validación a la izquierda + `Descartar` / `Guardar cambios`, **deshabilitado mientras haya errores**. Los 5 `alert()` de `EditRecipeModal.vue:196-234` se convierten en mensajes en línea
- [ ] **Mantener textualmente** la escritura de `calculatedRecipeOnlyCost` / `calculatedTotalBatchCostAllIncluded` / `calculatedFinalPrice` en el payload de `save`, ahora tomándolos de `useRecipeCosts`

> La pestaña *Historial* del diseño **se omite**: requeriría una consulta extra a Firestore por receta abierta y no hay filtro por `entityId` implementado.

### 5.3 Modales adaptados al nuevo estilo

Todos comparten `.ui-backdrop` + `.ui-modal-box` (con la clase `modal-content` obligatoria), cabecera con eyebrow + título 19px + botón `×` de 34px, y pie con `Cancelar` a la izquierda y la acción principal a la derecha. **Se unifican los 8 backdrops distintos de hoy en uno solo.**

- [ ] **`EditStockModal`** *(diseño: 1024-1056)* — Panel de "Stock actual" + badge de %, input de nuevo stock, **4 botones rápidos** `+100 / +250 / +500 / 1 pres.` (el último fija `presentationSize`), y línea "Diferencia registrada en el historial: **±X**". Sigue emitiendo un **Number crudo**
- [ ] **`TransactionModal`** *(diseño: 1058-1120)* — Radios `.form-radio` → **segmentado Ingreso/Egreso**. Fecha y Categoría en grid de 2 (1 col ≤640px), Descripción, Monto en Bs., **panel "Equivale a"** con USD 24px + tasa aplicada + origen ("BCV del 31/07"), Notas. **Conservar intacta** la cascada de resolución de tasa (API → exacta → anterior con elección → manual) y el `:disabled` del submit. La caja de tasa obsoleta pasa a `.ui-panel` con borde ámbar
- [ ] **`ConfirmationModal`** *(diseño: 1009-1022)* — Añadir prop opcional **`confirmPhrase`**: si viene, exige escribirla y mantiene el botón deshabilitado hasta que coincida (`trim().toLowerCase()`). Sin ella se comporta como hoy, así no se rompen las 3 llamadas de Ingredientes / Producción / Contabilidad. Añadir prop `details` para la línea de consecuencias. El Dashboard la usa con `confirmPhrase = recipeToDeleteName`
- [ ] **`IngredientModal`** *(nuevo — fusiona el formulario inline de `IngredientsView` con `EditIngredientModal`)* — Un solo componente con prop `ingredient` (`null` = alta). Campos: Nombre, grid de 3 (Costo presentación / Tamaño presentación / Unidad), y **Stock inicial sólo en alta** (en edición el stock se muestra de sólo lectura con enlace a "Ajustar stock", como hoy). Dispara `addNewIngredient` o `saveIngredientChanges` según el modo
- [ ] **`AddRecipeModal`** — Modal pequeño (`max-w-md`) sólo con el input de nombre. Sustituir el `alert()` de validación por mensaje en línea + botón deshabilitado
- [ ] **`EditProductionModal`** — Nombre, grid de 2 (Lote / Fecha), Ganancia neta, y el checkbox "Lote Vendido" como **toggle** con el mismo estilo de píldora Vendido/Pendiente de la tabla. **Mantener** el computed *writable* `formattedNetProfit` y su input `type="text" inputmode="decimal"`
- [ ] **`EventDetailsModal`** — Cabecera con badge de tipo (`getEventMeta().tone`), panel de resumen (usuario / fecha / entidad) en `.ui-panel`, y la tabla de cambios como lista de 3 filas apiladas en móvil (Parámetro / Valor original → Nuevo valor). `formatValue()` se conserva sin cambios

> **Consistencia de errores**: hoy `AddRecipeModal`, `EditIngredientModal`, `EditProductionModal` y `EditRecipeModal` usan `alert()` nativo mientras `EditStockModal` y `TransactionModal` usan toasts. Unificar en **validación en línea + botón deshabilitado**, dejando los toasts sólo para confirmar resultados de operaciones asíncronas.

### 5.4 Limpieza

- [ ] Borrar `IngredientsTable.vue`, `TableRegister.vue`, `AccountingTransactionsTable.vue` una vez migradas a `ResponsiveTable`
- [ ] Desinstalar `datatables.net-dt`, `datatables.net-responsive-dt`, `datatables.net-vue3`
- [ ] `chart.js`, `vue-chartjs` y `chartjs-plugin-datalabels` están declaradas pero **no se importan en ningún sitio** (verificado). Quitar en el mismo commit
- [ ] Código muerto: `IngredientsView.vue:52-60,109-112`; `AccountingTransactionsTable.vue:13-22` (`formatCurrencyBs`/`formatCurrencyUsd` sin uso); `AddRecipeModal.vue:54` (`ref="inputRef"` sin uso)
- [ ] Duplicación en `App.vue` `<style>`: `.slide-fade-*` y `.card-list-*` están definidas **dos veces** con duraciones distintas (`App.vue:241-274` vs `style.css:19-51`). Dejar sólo la copia de `style.css`

---

## Orden de ejecución

Cada paso deja la app arrancable. Conviene commitear por fase.

| Orden | Qué | Por qué en esta posición |
|---|---|---|
| 0 | Fase 0 — documentación | Sin cambios de código |
| 1 | Fase 1 completa | Sin los tokens y las clases `.ui-*`, todo lo demás se escribe dos veces |
| 2 | Fase 2 completa | Las vistas dependen de `useRecipeCosts` y `useDataTable` |
| 3 | Fase 3 — `App.vue` | Deja el marco visible y permite validar el modo oscuro sobre superficies reales |
| 4 | `ResponsiveTable` (5.1) + `IngredientsView` (4.2) | La primera vista de tabla valida el componente antes de replicarlo |
| 5 | `DashboardView` + `RecipeCard`, `RegisterView`, `AccountingView`, `EventHistoryView` | — |
| 6 | Modales: drawer (5.2) primero por ser el más grande, luego los 7 restantes | — |
| 7 | Limpieza (5.4) y desinstalación de dependencias | Cuando ya nada las importa |

---

## Verificación

**Ejecutar:** `npm run dev` → `http://localhost:5173`

Checklist funcional — con sesión iniciada, en **modo claro y oscuro**, y a **1440px / 980px / 760px / 375px**:

- [ ] **Shell** — la nav de píldoras marca la ruta activa; a ≤980px se convierte en barra inferior fija sin tapar contenido; el chip de usuario abre el menú y `Cerrar Sesión` funciona; el toggle de tema persiste tras recargar (`localStorage.theme`); el estado sin sesión muestra "Iniciar Sesión"
- [ ] **Recetas** — crear receta; el banner de stock aparece sólo si hay ingredientes ≤60%; los 3 chips filtran y sus contadores cuadran; una receta con un ingrediente sin `presentationSize` muestra la variante "Incompleta" **nombrando ese ingrediente**; el buscador filtra; borrar exige escribir el nombre exacto
- [ ] **Inventario** — "Nuevo ingrediente" abre el modal y lo crea; las 4 métricas cuadran con los chips; "Ajustar stock" con `+250` y "1 pres." actualiza el valor y la barra de nivel; la paginación es correcta en los bordes
- [ ] **Producción** — al elegir receta se rellenan "Items del lote", el aviso ámbar y la tarjeta oscura de estimación; registrar un lote **descuenta el stock** (verificar en Inventario); la fila de TOTALES suma todas las filas filtradas, no sólo la página
- [ ] **Contabilidad** — "Actualizar del BCV" trae tasa; "Manual" revela el input y lo persiste; el segmentado filtra; el modal de movimiento resuelve la tasa en las **4 rutas** (API / exacta guardada / anterior con elección / manual) y el preview en USD reacciona al monto; guardar y editar un movimiento
- [ ] **Historial** — los eventos se agrupan por día con "Hoy"/"Ayer"; el badge toma el color correcto por tipo; el buscador filtra; "Cargar más eventos" pagina; "Ver detalle" muestra la tabla de cambios
- [ ] **Tablas en móvil (375px)** — la fila colapsada muestra la celda principal + el primer botón; al tocarla se expande con las etiquetas correctas por columna; **ninguna página produce scroll horizontal en el `body`**
- [ ] **Modales** — los 8 abren con la animación (`modal-transition` + `modal-content` intactos), cierran con clic fuera y con `Esc`, y ninguno deja `alert()` nativo
- [ ] **Regresión de datos** — editar una receta y comprobar en Firestore/localStorage que `calculatedRecipeOnlyCost`, `calculatedTotalBatchCostAllIncluded` y `calculatedFinalPrice` siguen escribiéndose. Si no, `useProductionRecords` rechazará registrar producción
- [ ] **Build limpio** — sin errores de DataTables residuales en consola; `npm run build` sin warnings nuevos
