# CLAUDE.md

Contexto de proyecto para IA (Claude Code u otra) o desarrolladores que trabajen en este repo.

## Qué es esto

Gestor de recetas para un negocio de repostería/pastelería: recetas y su costeo, inventario de
ingredientes, registro de producción (lotes), contabilidad multimoneda (ingresos/egresos en Bs.,
USD, EUR o USDT), e historial de eventos (auditoría de cambios). Toda la UI está en español
(Venezuela).

## Stack

- Vue 3 (`<script setup>` en todos los componentes) + Vue Router + Pinia
- Firebase: Auth (Google) + Firestore, con persistencia offline vía `persistentLocalCache`
  (`src/main.js`). Fallback a `localStorage` cuando no hay sesión iniciada (`useLocalStorage.js`
  y los stores).
- Tailwind CSS v4 vía `@tailwindcss/vite`. Usa un config JS "legacy" (`tailwind.config.js`)
  puenteado a `src/assets/style.css` con `@config`. **`important: true` está activado
  deliberadamente** — ver gotchas abajo.
- vue-toastification (toasts), @vueform/multiselect (selects), @vuepic/vue-datepicker v14
  (date pickers), date-fns (requerido directamente para el locale del datepicker),
  driver.js (tutoriales guiados)

## Estructura

- `src/views/` — una vista por ruta (ver `src/router/index.js`): `DashboardView` (`/`, recetas),
  `IngredientsView` (`/ingredients`, inventario), `RegisterView` (`/register`, producción),
  `AccountingView` (`/contabilidad`), `EventHistoryView` (`/historial`)
- `src/components/` — modales y componentes de vista. `src/components/ui/` son primitivas
  compartidas sin lógica de negocio (`ResponsiveTable.vue`, `DateField.vue`)
- `src/stores/` — Pinia, **fuente de verdad real** de los datos: `userData.js`
  (recetas/ingredientes/producción) y `accountingData.js` (transacciones/tasas de cambio)
- `src/composables/` — lógica reutilizable. **Ojo:** `useUserData.js` y `useAccountingData.js`
  son versiones VIEJAS pre-Pinia que ya NO se usan en ningún sitio (nada las importa) — no
  asumas que editarlas tiene efecto, confirma con grep de imports antes de tocar cualquiera
  de las dos
- `src/utils/` — helpers puros (formateo, temas compartidos, labels de eventos, conversión
  multimoneda en `currency.js`, contenido de los tutoriales en `tourSteps.js`)

## Sistema de diseño

`REDISENO-GUIA.md` (tokens, catálogo de clases `.ui-*`, breakpoints) y `REDISENO-PLAN.md` (plan
de ejecución por fases) documentan el rediseño visual completo hecho el 2026-08-01 — son la
referencia si hay que tocar UI otra vez. Resumen rápido:

- Paleta: stone (neutro), rose (acento, `accent-*`), emerald/amber/red (éxito/warning/danger).
  Tipografía Nunito.
- Breakpoints desktop-first: 980px / 760px / 640px, con variantes arbitrarias `max-[Npx]:` de
  Tailwind (NO `sm:`/`md:`/`lg:` mobile-first).
- El catálogo `.ui-*` en `style.css` centraliza TODOS los estilos más su variante dark — las
  vistas/componentes no deben escribir clases `dark:` a mano, usan `.ui-card`, `.ui-btn-primary`,
  `.ui-input`, `.ui-badge-success`, etc.
- `tabular-nums` en todo número mostrado en la UI, sin excepción.
- Los 8 overlays (7 modales + `RecipeDrawer`) llevan la clase literal `modal-content` +
  `@click.self` para cerrar al hacer click afuera. Los modales normales usan
  `<Transition name="modal-transition">` (scale+fade); `RecipeDrawer` usa
  `<Transition name="drawer-transition">` (desliza desde la derecha) — son bloques CSS
  independientes en `style.css`, no los fusiones aunque se parezcan.

## Motor multimoneda (contabilidad)

El módulo de contabilidad acepta movimientos en **Bs. (VES), USD, EUR y USDT**. Modelo adaptado
del proyecto hermano `pirulai_finances` (ver su `pirulai_finances_context.md` §4.2).

- **`src/utils/currency.js`** — funciones puras: `toUsdBcv` / `fromUsdBcv`, `parseApiRates`,
  `requiredRateKeys`, y los normalizadores de lectura.
- **Unidad canónica `amountUsdBcv`** (USD a tasa BCV): TODA suma o comparación se hace sobre ese
  campo. Nunca totalizar sobre `amountOriginal` — mezcla bolívares con dólares, euros y USDT.
  `calculateSummary` devuelve USD; la vista convierte a la moneda que elija el usuario.
- **Las tasas son "Bs. por 1 unidad"**: `bcv` (Bs/USD), `eur` (Bs/EUR), `binance` (Bs/USDT).
  Por eso la conversión es asimétrica: VES **divide** entre `bcv`, mientras que EUR y USDT
  **multiplican** por su propia tasa (pasan a Bs.) y recién ahí dividen entre `bcv`.
- **USDT no viene dado por la API**: es el **promedio** de `binanceBuy.rate` y `binanceSell.rate`
  (`parseApiRates`). Si sólo llega una de las dos, se usa esa.
- **Snapshot por transacción**: `rateBcvApplied` / `rateEurApplied` / `rateBinanceApplied` se
  congelan al guardar, junto con `amountUsdBcv`. Un movimiento viejo NO debe cambiar de valor
  porque cambió la tasa de hoy — no recalcular `amountUsdBcv` al leer.
- **Faltar una tasa devuelve `null`, no 0.** Un 0 silencioso contaminaría un total; la UI muestra
  "N/D" y bloquea el guardado.
- **Compatibilidad hacia atrás sin migración**: `normalizeTransaction` / `normalizeRateEntry`
  resuelven EN LA LECTURA los documentos anteriores (transacciones con
  `amountBs`/`exchangeRate`/`amountUsd`, que son bolívares por definición; tasas con sólo `rate`,
  que era la del BCV). No se reescribe nada en Firestore.

## Tutoriales guiados

Cada vista tiene un tutorial paso a paso (driver.js), más uno específico dentro de `RecipeDrawer`
que explica de dónde sale el precio (mano de obra, margen, buffer).

- `src/composables/useTutorial.js` — la capa sobre driver.js. `useViewTutorial(tour, ready)` en
  el `<script setup>` de la vista registra su tour (el botón `?` del header lo dispara) y lo abre
  solo la primera vez, cuando `ready` pasa a true. `startTour()` suelto es para tours que no son
  de una vista (el de `RecipeDrawer`).
- `src/utils/tourSteps.js` — todo el texto, una función por vista. Se ejecutan al ABRIR el
  tutorial, no al importarlas, para poder leer el estado real.
- `src/composables/tutorialDriver.js` — chunk lazy con la librería + su CSS.
- Los anclajes son atributos `data-tour="..."` en las plantillas. **Si mueves o borras uno,
  actualiza `tourSteps.js`** — en dev queda un `console.warn` cuando un selector no encuentra nada.
- **Estados vacíos:** un paso con `optional: true` se descarta si su elemento no está visible, y
  con `when: () => bool` se descarta por condición de datos. Los pasos SIN esas marcas se
  conservan aunque su elemento no exista todavía (los de la pestaña de costos del drawer aparecen
  recién cuando el paso anterior cambia de pestaña con `onNext`).

## Gotchas importantes (aprendidos a la fuerza en la sesión del 2026-08-01)

1. **`important: true` de Tailwind + `@apply`**: las clases `.ui-*` definidas con `@apply` en
   `style.css` se compilan CON `!important` (heredan el `important:true` del config) y se
   emiten después de las utilidades normales de Tailwind — una utilidad suelta (`!py-2` etc.)
   en el mismo elemento pierde contra la clase `.ui-*`, incluso con su propio `!`. Regla: si una
   propiedad necesita override por-uso en algún sitio, no la metas en una clase `.ui-*`
   compartida — usa utilidades planas en el punto de uso.
   **Corolario práctico (2026-08-04):** no pongas dos controles con `w-full` propio en un mismo
   `flex` esperando repartir el ancho con `flex-1`/`min-w-0`/`w-[Npx]`. Tanto `.ui-input` como
   `multiselectTheme.container` traen su `w-full` con `!important`: los dos piden el 100% y se
   desbordan. Usa una grilla y deja que cada uno ocupe su celda (ver el campo Monto/Moneda de
   `TransactionModal.vue`).
2. **`@apply` no resuelve utilidades `animate-*` custom** (definidas en `theme.extend.animation`
   del config legacy) dentro de Tailwind v4. Se aplican como clase literal en el template o,
   más robusto, como `:style="{ animation: 'nombre 1.4s ease-in-out infinite' }"` apuntando al
   `@keyframes` global.
3. **`@vuepic/vue-datepicker` v14 — la mayoría de props NO son flat.** `enable-time-picker`,
   `format`, `close-on-auto-apply`, `clearable`, `input-id` NO existen como props de nivel
   superior en esta versión — van agrupadas: `:time-config="{enableTimePicker:false}"`,
   `:formats="{input:'dd/MM/yyyy'}"`, `:config="{closeOnAutoApply:true}"`,
   `:input-attrs="{id, clearable:false}"`. Vue descarta props desconocidas como atributos HTML
   inertes SIN error ni warning — un typo acá falla en silencio. Verifica siempre contra
   `node_modules/@vuepic/vue-datepicker/dist/index.d.ts` (interfaces `RootProps`/`TimeConfig`/
   `FormatsConfig`/`Config`/`InputAttributesConfig`), no confíes en memoria de versiones
   anteriores de la librería. El prop `locale` espera un objeto Locale de `date-fns/locale`
   (`import { es } from 'date-fns/locale'`), NO un string `"es"` — pasar un string ahí rompe
   con un crash críptico dentro de date-fns (`reading 'preprocessor'`).
4. **Tema del datepicker vía CSS**: la librería aplica su propia clase `.dp--theme-light`/
   `.dp--theme-dark` al MISMO elemento según su prop `dark` (que no usamos, así que siempre es
   `dp--theme-light`). Una regla en el propio elemento SIEMPRE gana sobre un valor heredado de
   un ancestro — por eso los overrides de tema van en `.dp--theme-light { --dp-*: ... }` /
   `.dark .dp--theme-light { --dp-*: ... }` directamente, nunca en `:root`/`.dark` sueltos.
   Además el CSS de la librería se importa desde `DateField.vue` (chunk separado, carga lazy)
   — su orden de carga vs. `style.css` no está garantizado, así que todos los overrides de
   `--dp-*` llevan `!important` (ver sección 8 de `style.css`).
5. **Vue `<Transition>` no anima el cierre si el padre desmonta el componente con su propio
   `v-if`.** Todos los modales de esta app se montan siempre y controlan visibilidad solo con
   la prop `show` — si agregas un modal nuevo, NO lo envuelvas en `v-if` en el sitio de uso
   (rompe la animación de salida), sigue el patrón de `<ConfirmationModal :show="..." />` ya
   usado en las vistas existentes.
6. **`watch(fuente, cb, {immediate:true})` con comparación de "cambió":** en la llamada
   sintética de `immediate`, `oldValue` es `undefined`. Si comparás `newId !== oldId`
   normalizando ambos con `?? null`, el caso "sin dato inicial" (`null !== null`) se evalúa
   `false` y el callback nunca corre. Si necesitás que corra siempre en el mount, chequeá
   `oldValue === undefined` explícitamente además de la comparación de IDs.
7. **driver.js — dos trampas.** (a) Si defines `onNextClick`/`onPrevClick` en un paso, la
   librería **deja de avanzar sola**: el hook reemplaza el comportamiento por defecto y hay que
   llamar a `moveNext()`/`movePrevious()` a mano (así es como el tour del drawer cambia de
   pestaña antes de seguir). (b) El contador de progreso (`{{total}}`) se calcula sobre el array
   de pasos completo, aunque después la librería salte pasos con `skipMissingElement` — por eso
   `resolveSteps()` filtra ANTES de instanciar el driver, y no se delega en esa opción.
8. **Dos stores paralelos con el mismo shape**: `src/stores/userData.js` y
   `src/stores/accountingData.js` son los reales (Pinia, usados por las vistas).
   `src/composables/useUserData.js` y `useAccountingData.js` son restos pre-Pinia sin uso —
   confirmá con grep de imports antes de asumir que un cambio en uno de los dos "composables"
   viejos tiene efecto.

## Integraciones externas

- **Firebase**: Auth (Google) + Firestore, config en `.env` (no versionado, ver
  `.env.example`). Persistencia offline habilitada — la app funciona sin conexión usando el
  caché local de Firestore.
- **Tasas de cambio**: `https://dolarflashve.eu/api/rates/all` (GET público, sin auth). Devuelve
  `bcvUsd`, `bcvEur`, `binanceBuy` y `binanceSell`, cada uno con `{ rate, date }`. La app usa
  `bcvUsd.rate` (Bs/USD), `bcvEur.rate` (Bs/EUR) y el **promedio** de las dos de Binance como
  tasa del USDT — ver el motor multimoneda arriba. Solo devuelve las tasas VIGENTES, no tiene
  lookup por fecha histórica (a diferencia del Supabase edge function que usaba antes). En dev se
  llama vía el proxy de `vite.config.js` (`/api-dolar` → el host real) porque el API no permite
  CORS directo desde otro origen; en producción (build estático, sin proxy) puede volver a fallar
  por CORS si el API no lo permite — **no verificado en producción todavía**.

## Cosas que el usuario pidió explícitamente evitar

No usar herramientas MCP Playwright para verificar cambios visuales — el usuario revisa la UI
él mismo con `npm run dev`. No lanzar checks visuales automatizados salvo que lo pida
explícitamente.
