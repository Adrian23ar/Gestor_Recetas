# CLAUDE.md

Contexto de proyecto para IA (Claude Code u otra) o desarrolladores que trabajen en este repo.

## Qué es esto

Gestor de recetas para un negocio de repostería/pastelería: recetas y su costeo, inventario de
ingredientes, registro de producción (lotes), contabilidad (ingresos/egresos en Bs. con tasa de
cambio USD/Bs.), e historial de eventos (auditoría de cambios). Toda la UI está en español
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
  (date pickers), date-fns (requerido directamente para el locale del datepicker)

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
- `src/utils/` — helpers puros (formateo, temas compartidos, labels de eventos)

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

## Gotchas importantes (aprendidos a la fuerza en la sesión del 2026-08-01)

1. **`important: true` de Tailwind + `@apply`**: las clases `.ui-*` definidas con `@apply` en
   `style.css` se compilan CON `!important` (heredan el `important:true` del config) y se
   emiten después de las utilidades normales de Tailwind — una utilidad suelta (`!py-2` etc.)
   en el mismo elemento pierde contra la clase `.ui-*`, incluso con su propio `!`. Regla: si una
   propiedad necesita override por-uso en algún sitio, no la metas en una clase `.ui-*`
   compartida — usa utilidades planas en el punto de uso.
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
7. **Dos stores paralelos con el mismo shape**: `src/stores/userData.js` y
   `src/stores/accountingData.js` son los reales (Pinia, usados por las vistas).
   `src/composables/useUserData.js` y `useAccountingData.js` son restos pre-Pinia sin uso —
   confirmá con grep de imports antes de asumir que un cambio en uno de los dos "composables"
   viejos tiene efecto.

## Integraciones externas

- **Firebase**: Auth (Google) + Firestore, config en `.env` (no versionado, ver
  `.env.example`). Persistencia offline habilitada — la app funciona sin conexión usando el
  caché local de Firestore.
- **Tasa de cambio USD/Bs.**: `https://dolarflashve.eu/api/rates/all` (GET público, sin auth,
  campo `bcvUsd.rate`). Solo devuelve la tasa VIGENTE, no tiene lookup por fecha histórica (a
  diferencia del Supabase edge function que usaba antes). En dev se llama vía el proxy de
  `vite.config.js` (`/api-dolar` → el host real) porque el API no permite CORS directo desde
  otro origen; en producción (build estático, sin proxy) puede volver a fallar por CORS si el
  API no lo permite — **no verificado en producción todavía**.

## Cosas que el usuario pidió explícitamente evitar

No usar herramientas MCP Playwright para verificar cambios visuales — el usuario revisa la UI
él mismo con `npm run dev`. No lanzar checks visuales automatizados salvo que lo pida
explícitamente.
