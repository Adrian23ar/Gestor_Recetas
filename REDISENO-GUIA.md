# Guía de referencia del rediseño

> Documento de consulta durante la implementación. Contiene los valores exactos extraídos del diseño, el catálogo de clases, el mapeo claro↔oscuro, los breakpoints y las reglas que no se pueden romper.
> Plan de ejecución: **[REDISENO-PLAN.md](./REDISENO-PLAN.md)**
> Diseño fuente: `redise-o-integral-app-de-recetas/project/Gestor Recetas - Rediseño.dc.html` (1234 líneas)

El objetivo de este archivo es **no tener que reabrir el `.dc.html`** para implementar. Si un valor no está aquí, está ahí — y conviene añadirlo aquí después de buscarlo.

---

## 1. Tipografía

**Fuente: Nunito**, pesos `400;500;600;700;800`. Se carga en `index.html` desde Google Fonts y se declara como `fontFamily.sans` en `tailwind.config.js`.

| Rol | Tamaño | Peso | Tracking | Notas |
|---|---|---|---|---|
| `h1` de vista | 40px | 800 | `-.02em` | `line-height: 1.05`. 32px ≤980px, 28px ≤640px |
| Título de modal | 19px | 600 | `-.01em` | |
| Título de tarjeta de receta | 17px | 600 | `-.01em` | |
| Título de sección / tabla | 16px | 600 | — | "Nuevo lote", "Historial de producción" |
| Título dentro de panel | 15px | 600 | — | "Cómo se forma el precio" |
| Nombre del app en el header | 15px | 600 | `-.01em` | `line-height: 18px` |
| Cuerpo / celda de tabla | 14px | 400-500 | — | |
| Secundario | 13px | 400-600 | — | Botones pequeños, subtítulos de nav |
| Pequeño | 12px | 500-600 | — | Labels de formulario, badges, chips |
| Eyebrow / sutil | 11px | 500-600 | — | "Receta", "PVP final por item", nav móvil |

### Cifras grandes

Todas con `font-weight: 600` y `letter-spacing: -.03em` (salvo donde se indique):

| Contexto | Tamaño |
|---|---|
| Ganancia neta estimada (Producción) | 36px |
| PVP de la tarjeta de receta | 34px |
| Métrica de Inventario | 30px |
| Métrica de Contabilidad | 28px |
| PVP en el drawer | 26px — `-.02em`, color `#fcd34d` |
| USD calculado en el modal de movimiento | 24px — `-.02em` |
| Nombre de receta en la cabecera del drawer | 24px — `-.02em` |
| Stock actual en el modal de stock | 22px |

> **Regla**: **toda** cifra lleva `font-variant-numeric: tabular-nums`. Sin excepción — precios, porcentajes, tasas, horas, stock. Es lo que hace que las columnas numéricas no bailen.

---

## 2. Color

### 2.1 Neutros (base stone)

| Rol | Hex | Token Tailwind |
|---|---|---|
| Fondo de página | `#f5f5f4` | `stone-100` → token `background` |
| Superficie de tarjeta | `#ffffff` | `white` → token `contrast` |
| Superficie interior / cabecera de tabla | `#fafaf9` | `stone-50` → token `surface-muted` |
| Borde | `#e7e5e4` | `stone-200` |
| Borde en hover | `#d6d3d1` | `stone-300` |
| Texto principal | `#292524` | `stone-800` → token `text-base` |
| Texto fuerte secundario | `#44403c` | `stone-700` |
| Texto de label | `#57534e` | `stone-600` |
| Texto tenue | `#78716c` | `stone-500` → token `text-muted` |
| Texto sutil / placeholder | `#a8a29e` | `stone-400` |
| Superficie invertida (tarjetas oscuras, nav móvil, toast) | `#292524` | `stone-800`, texto `#fafaf9` |
| Divisor dentro de superficie invertida | `#44403c` | `stone-700` |

### 2.2 Acento y estados

| Rol | Hex | Token |
|---|---|---|
| CTA primario | `#e11d48` | `rose-600` |
| CTA primario hover | `#be123c` | `rose-700` |
| Borde de peligro suave | `#fecdd3` | `rose-200` |
| Éxito — texto | `#047857` | `emerald-700` |
| Éxito — punto / barra | `#059669` | `emerald-600` |
| Éxito — fondo de badge | `#ecfdf5` | `emerald-50` |
| Éxito — sobre fondo oscuro | `#34d399` | `emerald-400` |
| Peligro — texto | `#b91c1c` | `red-700` |
| Peligro — punto / barra / botón | `#dc2626` | `red-600` |
| Peligro — fondo de badge | `#fef2f2` | `red-50` |
| Peligro — borde de input con error | `#fca5a5` | `red-300` |
| Aviso — texto fuerte | `#92400e` | `amber-800` |
| Aviso — texto | `#b45309` | `amber-700` |
| Aviso — punto / barra | `#f59e0b` | `amber-500` |
| Aviso — fondo de panel | `#fffbeb` | `amber-50` |
| Aviso — fondo de badge | `#fef3c7` | `amber-100` |
| Aviso — borde | `#fde68a` | `amber-200` |
| Aviso — sobre fondo oscuro | `#fcd34d` | `amber-300` |
| Backdrop de overlay | `rgba(28,25,23,.45)` | — |

### 2.3 Barra de desglose de costo (tarjeta de receta)

Tres segmentos sobre pista `stone-100`, altura 8px, `rounded-full`, con leyenda de cuadraditos 6×6px `rounded-[2px]`:

| Segmento | Color |
|---|---|
| Ingredientes | `#292524` `stone-800` |
| Mano de obra | `#a8a29e` `stone-400` |
| Ganancia | `#f59e0b` `amber-500` |

### 2.4 Barra de nivel de stock (Inventario)

Pista `stone-100` de 120px × 6px. Color del relleno **y del porcentaje** según el nivel:

| Nivel | Umbral | Relleno | Texto |
|---|---|---|---|
| Bajo | ≤ 25% | `red-600` | `red-700` |
| Medio | ≤ 60% | `amber-500` | `amber-700` |
| Alto | > 60% | `emerald-600` | `emerald-700` |

> El porcentaje es `currentStock / presentationSize`. Estos umbrales son los de `IngredientsView.getStockLevel`, **no** los absolutos de `useIngredients.stockStatus` — ver tarea 2.4 del plan.

---

## 3. Forma, sombra y movimiento

### 3.1 Radios

| Token | px | Uso |
|---|---|---|
| `rounded-card` | 24 | Tarjetas principales, modales, drawer |
| `rounded-tile` | 22 | Tarjetas de métrica de Contabilidad |
| `rounded-panel` | 20 | Tarjetas de métrica de Inventario, paneles dentro del drawer |
| `rounded-nav` | 18 | Barra de navegación móvil |
| `rounded-box` | 16 | Paneles interiores (`#fafaf9`), avisos ámbar, toast |
| `rounded-field` | 14 | Inputs, selects, botones primarios, contenedor de nav |
| `rounded-control` | 12 | Botones secundarios, chip de usuario, botón `×` |
| `rounded-chip` | 11 | Botones rápidos, píldoras de pestaña |
| `rounded-[10px]` | 10 | Botones de acción dentro de tablas |
| `rounded-full` | — | Badges, chips de filtro, barras de progreso, puntos |

### 3.2 Sombras

| Token | Valor | Uso |
|---|---|---|
| `shadow-card` | `0 1px 2px rgba(41,37,36,.04)` | Tarjetas de métrica, inputs |
| `shadow-raised` | `0 1px 2px rgba(41,37,36,.04), 0 8px 24px -18px rgba(41,37,36,.5)` | Tarjetas principales y de tabla |
| `shadow-lift` | `0 2px 4px rgba(41,37,36,.05), 0 18px 34px -20px rgba(41,37,36,.55)` | Hover de tarjeta de receta (+ `translateY(-2px)`) |
| `shadow-cta` | `0 6px 16px -8px rgba(225,29,72,.7)` | Botón primario rose |
| `shadow-modal` | `0 30px 60px -20px rgba(28,25,23,.5)` | Caja de modal |
| `shadow-drawer` | `-24px 0 60px -30px rgba(28,25,23,.6)` | Drawer lateral |
| `shadow-toast` | `0 20px 40px -18px rgba(28,25,23,.7)` | Toast |
| `shadow-navbar` | `0 18px 40px -18px rgba(28,25,23,.75)` | Barra de nav móvil |
| `shadow-pill` | `0 1px 2px rgba(41,37,36,.08)` | Píldora de nav activa, segmento activo |

### 3.3 Animaciones

```css
@keyframes shimmer { 0% { opacity:.55 } 50% { opacity:1 } 100% { opacity:.55 } }
@keyframes riseIn  { from { opacity:0; transform: translateY(8px) }  to { opacity:1; transform:none } }
@keyframes slideIn { from { opacity:.4; transform: translateX(24px) } to { opacity:1; transform:none } }
```

| Animación | Duración | Uso |
|---|---|---|
| `shimmer` | `1.4s ease-in-out infinite` | Skeletons. Delays escalonados `0 / .15s / .3s` entre tarjetas |
| `riseIn` | `.2s ease-out` | Caja de modal, toast (`.18s`) |
| `slideIn` | `.22s ease-out` | Drawer lateral |

### 3.4 Foco

Regla global sobre `input, select, textarea`:

```css
outline: 2px solid rgba(225,29,72,.35);
outline-offset: 1px;
border-color: #e11d48;
```

---

## 4. Layout

| Elemento | Escritorio | ≤980px |
|---|---|---|
| Ancho máximo | `1240px` centrado | igual |
| Padding del header | `14px 28px` | `12px 16px` |
| Padding del `<main>` | `36px 28px 0` | `24px 16px 0` |
| Padding inferior del contenedor raíz | `64px` | `96px` (deja sitio a la nav fija) |
| Gap del header | `24px` | `12px` |

### Rejillas

| Vista | Grid |
|---|---|
| Tarjetas de receta | `repeat(auto-fill, minmax(300px, 1fr))` gap 20px |
| Métricas de Inventario | `repeat(auto-fit, minmax(200px, 1fr))` gap 16px |
| Métricas de Contabilidad | `repeat(auto-fit, minmax(230px, 1fr))` gap 16px |
| Producción | `1.15fr .85fr` gap 20px → **1 columna ≤980px** |
| Campos de costos del drawer | `repeat(3, 1fr)` gap 14px → **1 columna ≤640px** |
| Fecha + Categoría en modales | `1fr 1fr` gap 14px → **1 columna ≤640px** |

---

## 5. Breakpoints — qué cambia en cada uno

Tres cortes, cada uno con un significado concreto. En el prototipo son `data-r` + media queries; en Vue se traducen a variantes de Tailwind y a `v-if` cuando hace falta.

### ≤ 980px — la navegación cambia de sitio

- El header pierde la nav central y se compacta.
- La nav pasa a **barra inferior fija**: `left:10px right:10px bottom:10px`, `z-index:55`, fondo `stone-800`, padding 6px, radio 18px, `shadow-navbar`, gap 2px, scroll horizontal con la barra oculta.
- Botones: `flex:1`, `min-width:62px`, padding `11px 6px`, texto 11px. Inactivo transparente con texto `stone-400`; activo `bg-stone-50 text-stone-800 rounded-[13px]`.
- El contenedor raíz gana `padding-bottom: 96px`.
- El header pierde el `backdrop-filter` y pasa a blanco sólido (rendimiento en móvil).
- `h1` → 32px.
- Los toasts suben a `bottom: 86px` y ocupan `left:16px right:16px`.
- La rejilla de Producción pasa a una columna.

### ≤ 760px — las tablas colapsan

- El `<thead>` se oculta.
- Cada fila es una tarjeta de 2 columnas: **celda principal** | **columna de acciones** (máx. 128px, botones apilados a ancho completo).
- Colapsada, sólo se ve el primer botón de acción; el resto aparece al expandir.
- Bajo la celda principal aparece el afijo `"ver detalles"` / `"ocultar detalles"` en 11px/700 `stone-400`.
- Al expandir, el resto de celdas se apilan a ancho completo con su **etiqueta de columna encima** (11px/700 `stone-400`) y separador `1px dashed stone-200`.
- La fila de TOTALES se apila como pares etiqueta↔valor justificados a los extremos.

> En el prototipo esto se hace con `nth-child` y `content:` escritos a mano en el CSS. **No replicar ese enfoque**: `ResponsiveTable` toma las etiquetas de la definición de columnas, que es la misma fuente que alimenta el `<thead>`. Un cambio de columna no puede desincronizarse.

### ≤ 640px — todo a una columna

- `h1` → 28px.
- El nombre del usuario se oculta en el header (queda el avatar).
- Los inputs de ancho fijo pasan a `width:100%` con `box-sizing:border-box`.
- Todas las rejillas de 2 y 3 columnas pasan a 1.
- El drawer pierde el radio (ocupa la pantalla completa).
- Las barras de filtro envuelven y sus hijos pasan a `flex:1 1 auto`.
- Las filas del historial envuelven; la descripción salta a línea completa.

---

## 6. Catálogo de clases `.ui-*`

Se definen **una sola vez** en `src/assets/style.css` con `@apply`, cada una con su variante `dark:`. Ninguna vista debe repetir cadenas largas de utilidades ni escribir `dark:` a mano.

### Superficies

| Clase | Qué es |
|---|---|
| `.ui-card` | Tarjeta principal: `rounded-card`, fondo `contrast`, `shadow-raised` |
| `.ui-card-flat` | Igual pero con `shadow-card` (métricas, paneles interiores) |
| `.ui-panel` | Panel interior sobre `surface-muted`, `rounded-box`, sin sombra |
| `.ui-card-inverted` | Tarjeta oscura: fondo `stone-800`, texto `stone-50`, divisores `stone-700` |
| `.ui-stat` | Tarjeta de métrica: `rounded-panel`/`rounded-tile`, padding 20-22px, `shadow-card` |

### Controles

| Clase | Qué es |
|---|---|
| `.ui-input` / `.ui-select` / `.ui-textarea` | `rounded-field`, padding `12px 14px`, borde `stone-200`, foco rose |
| `.ui-input-sm` | Variante compacta de barras de filtro: `rounded-control`, padding `9px 12px`, 13px |
| `.ui-input-error` | Borde `red-300` + fondo `red-50`. Se combina con `.ui-input` |
| `.ui-label` | 12px / 600 / `stone-600` / `margin-bottom: 6px`, `display:block` |

### Botones

| Clase | Qué es |
|---|---|
| `.ui-btn-primary` | Rose-600, texto blanco, `rounded-field`, `shadow-cta`, padding `12px 20px` |
| `.ui-btn-dark` | Stone-800, texto `stone-50` — acción principal dentro de tarjetas ("Ver receta", "Añadir") |
| `.ui-btn-outline` | Fondo `contrast` + borde `stone-200`, texto `stone-700` |
| `.ui-btn-subtle` | Fondo `surface-muted` + borde `stone-200` — acción de tabla ("Ajustar stock", "Editar") |
| `.ui-btn-ghost` | Transparente, texto `stone-500`, hover con fondo gris |
| `.ui-btn-danger-ghost` | Como ghost, pero hover a `red-600` con fondo `red-50` — todos los "Eliminar" |
| `.ui-btn-disabled` | Fondo `stone-100`, texto `stone-400`, `cursor: not-allowed` |

### Píldoras y navegación

| Clase | Qué es |
|---|---|
| `.ui-chip` / `.ui-chip-active` | Chips de filtro `rounded-full`. Activo: fondo `stone-800`, texto `stone-50` |
| `.ui-badge-success` / `-warning` / `-danger` / `-neutral` | Badges `rounded-full`, 11-12px / 600, con los pares fondo+texto de §2.2 |
| `.ui-seg` / `.ui-seg-active` | Control segmentado dentro de un contenedor `bg-stone-100 p-1 rounded-control`. Activo blanco con `shadow-pill` |
| `.ui-nav-pill` / `.ui-nav-pill-active` | Píldora de navegación del header (misma mecánica que el segmentado) |

### Tabla

| Clase | Qué es |
|---|---|
| `.ui-table` | `width:100%`, `border-collapse`, `min-width` para el scroll horizontal |
| `.ui-thead-th` | 12px / 500 / `stone-400`, fondo `surface-muted`, padding `13px 16px`, `whitespace-nowrap` |
| `.ui-td` | padding `16px`, 14px. Primera y última celda con padding lateral 22px |
| `.ui-tr` | Borde superior `stone-100`, hover `surface-muted`, `cursor:pointer` en móvil |
| `.ui-table-toolbar` | Cabecera de la tarjeta de tabla: flex, wrap, padding `20px 22px`, borde inferior |
| `.ui-table-footer` | Pie de paginación: flex justificado, padding `16px 22px`, borde superior |

### Overlays

| Clase | Qué es |
|---|---|
| `.ui-backdrop` | `fixed inset-0 z-[60]`, `bg-[rgba(28,25,23,.45)]`, flex de centrado |
| `.ui-modal-box` | `rounded-card`, fondo `contrast`, padding 26px, `shadow-modal`, `animate-riseIn`. **En el template debe llevar además la clase literal `modal-content`** |
| `.ui-drawer` | `width: min(760px,100%)`, altura completa, columna flex, `shadow-drawer`, `animate-slideIn`. Sin radio ≤640px |

### Estado

| Clase | Qué es |
|---|---|
| `.ui-skeleton` | Bloque `stone-100` con `rounded-lg` y `animate-shimmer` |
| `.ui-empty` | Tarjeta con `border-dashed stone-300`, `rounded-card`, padding `64px 32px`, centrado |

---

## 7. Mapeo claro → oscuro

**Referencia única.** El diseño es sólo claro; esta tabla es la fuente de verdad para las variantes `dark:` de todas las clases del §6. No inventar colores oscuros fuera de aquí.

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo de página | `stone-100` | `stone-900` |
| Superficie de tarjeta | `white` | `stone-800` (`dark-contrast`) |
| Superficie interior | `stone-50` | `stone-900/60` |
| Borde | `stone-200` | `stone-700` |
| Borde en hover | `stone-300` | `stone-600` |
| Texto principal | `stone-800` | `stone-100` |
| Texto de label | `stone-600` | `stone-300` |
| Texto tenue | `stone-500` | `stone-400` |
| Texto sutil | `stone-400` | `stone-500` |
| Tarjeta invertida | `stone-800` / texto `stone-50` | `stone-950` / texto `stone-100` |
| Divisor en tarjeta invertida | `stone-700` | `stone-800` |
| CTA primario | `rose-600` → hover `rose-700` | `rose-500` → hover `rose-600` |
| Éxito: texto / fondo | `emerald-700` / `emerald-50` | `emerald-400` / `emerald-500/10` |
| Peligro: texto / fondo | `red-700` / `red-50` | `red-400` / `red-500/10` |
| Aviso: texto / fondo / borde | `amber-700` / `amber-50` / `amber-200` | `amber-400` / `amber-500/10` / `amber-500/25` |
| Skeleton | `stone-100` | `stone-700/50` |
| Backdrop | `rgba(28,25,23,.45)` | `rgba(0,0,0,.6)` |

> La tarjeta invertida baja a `stone-950` en oscuro **a propósito**: en modo oscuro la tarjeta normal ya es `stone-800`, así que la invertida necesita bajar un escalón para seguir leyéndose como una superficie distinta.

---

## 8. Invariantes — lo que no se puede romper

Cosas que parecen decorativas pero son funcionales. Verificar cada una antes de dar por cerrado un componente.

| Invariante | Dónde | Qué pasa si se rompe |
|---|---|---|
| La caja interior de todo modal lleva la clase literal **`modal-content`**, envuelta en `<Transition name="modal-transition">` | los 8 modales | `style.css:67-77` anima ese selector; el modal aparece de golpe sin escala |
| `EditStockModal` emite `save` con un **Number crudo**, no un objeto | `EditStockModal.vue:39` | `IngredientsView.vue:157` construye el objeto a partir de ese número; con un objeto, el stock se guarda como `NaN` |
| El payload de `save` del drawer de receta incluye `calculatedRecipeOnlyCost`, `calculatedTotalBatchCostAllIncluded` y `calculatedFinalPrice` | `EditRecipeModal.vue:218-230` | `useProductionRecords.js:74` **rechaza registrar producción** con "Edita y guarda la receta primero" |
| `RecipeCard` tiene **un solo elemento raíz** | `RecipeCard.vue` | Vive en un `<TransitionGroup name="card-list">`; con varios raíces la transición falla |
| `RecipeCard` emite `delete-recipe` con el **id** y `edit-recipe` con el **objeto** | `RecipeCard.vue:76,19` | `DashboardView` no encuentra la receta a borrar |
| `EventDetailsModal` renderiza `changes[]` verbatim vía `formatValue()` | `EventDetailsModal.vue:19-93` | Se pierde el diff de eventos; cualquier campo nuevo dejaría de aparecer solo |
| La cascada de tasa de `TransactionModal` (API → exacta → anterior con elección → manual) y el `:disabled` del submit | `TransactionModal.vue:132-172,388` | Se pueden guardar movimientos sin tasa, con `amountUsd` corrupto |
| El computed **writable** `formattedNetProfit` con input `type="text" inputmode="decimal"` | `EditProductionModal.vue:35-46,121` | Un `type="number"` rompe el formateo a 2 decimales y el manejo de vacío |
| `EventHistoryView` conserva `loadHistory`, la paginación por cursor y el fallback a `localStorage` | `EventHistoryView.vue:99-178` | El historial deja de funcionar sin conexión |

---

## 9. Convenciones acordadas

1. **Validación en línea, no `alert()`.** Los mensajes aparecen bajo el campo y el botón de guardar queda deshabilitado mientras haya errores. Hoy `AddRecipeModal`, `EditIngredientModal`, `EditProductionModal` y `EditRecipeModal` usan `alert()` nativo — todos migran.
2. **Los toasts sólo confirman resultados de operaciones asíncronas** (guardado, borrado, tasa obtenida). Nunca se usan para validar un formulario.
3. **Los estados de carga son skeletons**, no texto "Cargando…". El skeleton imita la forma del contenido que va a llegar.
4. **Los estados vacíos explican y ofrecen salida.** Título, párrafo de una o dos frases y al menos un CTA. Nunca una línea suelta de texto gris.
5. **Un solo backdrop.** Los 8 modales usan `.ui-backdrop`; se acabaron `backdrop-brightness-50`, `bg-black/60` y `bg-black/80` conviviendo.
6. **Toda cifra lleva `tabular-nums`** (ver §1).
7. **Las acciones destructivas** usan `.ui-btn-danger-ghost` (neutro en reposo, rojo al hover), nunca un botón rojo sólido en una tabla.
8. **Los botones de acción de tabla emiten con `@click` de Vue.** Se acabaron los `render()` con HTML en strings y los `data-action` con listeners delegados.
9. **El modo oscuro se resuelve en `style.css`**, no en las vistas. Si estás escribiendo `dark:` en un `.vue`, probablemente falta una clase `.ui-*`.

---

## 10. Mapa pantalla → archivos

| Pantalla | Vista | Componentes | Datos |
|---|---|---|---|
| **Recetas** | `views/DashboardView.vue` | `RecipeCard`, `AddRecipeModal`, `RecipeDrawer`, `ConfirmationModal`, `ErrorMessage` | `composables/useDashboard.js`, `useRecipeCosts.js` |
| **Inventario** | `views/IngredientsView.vue` | `IngredientsTable`→`ResponsiveTable`, `IngredientModal`, `EditStockModal`, `ConfirmationModal` | `composables/useIngredients.js` |
| **Producción** | `views/RegisterView.vue` | `TableRegister`→`ResponsiveTable`, `EditProductionModal`, `ConfirmationModal` | `composables/useProductionRecords.js`, `useRecipeCosts.js` |
| **Contabilidad** | `views/AccountingView.vue` | `AccountingTransactionsTable`→`ResponsiveTable`, `TransactionModal`, `ConfirmationModal` | `stores/accountingData.js` (Pinia) |
| **Historial** | `views/EventHistoryView.vue` | `EventDetailsModal` | Firestore directo + `utils/eventLabels.js` |
| **Shell** | `App.vue` | — | `composables/useAuth.js`, `router/index.js` |
| **Base** | — | `ui/ResponsiveTable.vue` | `assets/style.css`, `tailwind.config.js`, `index.html` |

### Rutas

| Path | Nombre | Vista |
|---|---|---|
| `/` | `Dashboard` | Recetas |
| `/ingredients` | `Ingredients` | Inventario |
| `/register` | `ProductionRegister` | Producción |
| `/contabilidad` | `Accounting` | Contabilidad |
| `/historial` | `EventHistory` | Historial |

---

## 11. Secciones del diseño fuente

Por si hace falta volver al `.dc.html`:

| Sección | Líneas |
|---|---|
| Estilos globales y media queries | 14-92 |
| Header / shell | 96-121 |
| Vista Recetas | 125-403 |
| Vista Inventario | 405-567 |
| Vista Producción | 569-692 |
| Vista Contabilidad | 694-840 |
| Vista Historial | 842-890 |
| Drawer de receta | 893-1007 |
| Modal de confirmación (escribir el nombre) | 1009-1022 |
| Modal de ajuste de stock | 1024-1056 |
| Modal de movimiento contable | 1058-1120 |
| Toast | 1122-1127 |
| Lógica del prototipo (estados, helpers) | 1131-1231 |
