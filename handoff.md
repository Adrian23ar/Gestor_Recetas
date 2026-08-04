# Handoff — sesión 2026-08-04 (multimoneda en Contabilidad)

**Punto de partida:** `ab123b5` — "Tutoriales guiados por vista y mejoras en Historial y
Contabilidad".

Ver también [CLAUDE.md](CLAUDE.md) para contexto de proyecto/arquitectura de cara a futuro.
Este archivo es un registro de lo que pasó en *esta* sesión puntual, no documentación viva.

## Qué se pidió

Manejar multimoneda en el módulo de contabilidad, aprovechando que la API de tasas
(`dolarflashve.eu/api/rates/all`) devuelve cuatro tasas y no una: `bcvUsd`, `bcvEur`,
`binanceBuy` y `binanceSell`. Requisito explícito: **la de Binance debe ser el promedio de compra
y venta, y llamarse USDT**.

Como referencia, el usuario señaló el proyecto hermano `pirulai_finances` (carpeta al lado de
este repo) para copiar su modelo de multimoneda en vez de inventar uno.

## Lo que se sacó del proyecto hermano

De `pirulai_finances_context.md` §4.2 y `src/features/transactions/hooks/useAddTransaction.js`:

1. **Unidad canónica.** Cada movimiento guarda, además del monto original, su equivalente en
   "USD a tasa BCV" (`amount_usd_bcv` allá, `amountUsdBcv` acá). *Todas* las sumas se hacen sobre
   ese campo — es lo único que permite totalizar monedas distintas.
2. **Snapshot de tasas por transacción** (`rate_*_applied`): un movimiento viejo no cambia de
   valor porque cambió la tasa de hoy.
3. **Conversión asimétrica.** Las tasas están en "Bs. por 1 unidad", así que VES *divide* entre
   la del BCV, mientras que EUR y USDT *multiplican* por la suya (pasan a Bs.) y recién ahí
   dividen entre la del BCV. Invertir esto es el error fácil.
4. **Salvavidas ante tasas faltantes**: nunca mostrar 0 cuando falta una tasa.
5. De su handoff del 2026-08-03 se tomó además la lección de fondo: *"la persistencia se resuelve
   en la lectura, no en la copia"* — de ahí la decisión de no migrar datos (ver abajo).

## Decisiones acordadas con el usuario antes de escribir código

| Pregunta | Elección |
|---|---|
| Monedas | Las 4 de Pirulai: **VES, USD, EUR, USDT** |
| Totales | **Selector de moneda** en la vista, como el Dashboard de Pirulai |
| Datos ya registrados | **Normalizar al leer**, sin reescribir nada en Firestore |

## Qué se hizo

### 1. `src/utils/currency.js` (nuevo) — el motor, en funciones puras

`CURRENCIES`, `toUsdBcv` / `fromUsdBcv` (inversas exactas), `requiredRateKeys`, `parseApiRates`,
`normalizeRateEntry`, `normalizeTransaction`, `transactionRates`.

Dos criterios que conviene no aflojar:

- **`null`, nunca 0, cuando falta una tasa.** Un 0 silencioso se sumaría a un total y lo
  falsearía sin que nadie se entere. Quien llama decide qué hacer; la UI muestra "N/D" y bloquea
  el guardado.
- **`requiredRateKeys` es por moneda**: USD no necesita ninguna tasa (ya *es* la unidad), VES sólo
  la del BCV, y EUR/USDT necesitan **dos** (la suya y la del BCV, que es el denominador). Eso es
  lo que decide qué inputs muestra la carga manual y cuándo se puede guardar.

### 2. Store (`src/stores/accountingData.js`)

- `parseApiRates` reemplaza el parseo de `bcvUsd.rate` suelto. **USDT = promedio de `binanceBuy`
  y `binanceSell`**; si sólo llega una de las dos, se usa esa.
- `updateDailyRate` acepta un número (se interpreta como BCV solo, que es como lo llaman el botón
  "Manual" y el modal) **o** el juego completo. Las tasas vacías **no borran** las ya guardadas
  para esa fecha: se mezclan. Así, ajustar el BCV a mano no tumba el EUR/USDT que trajo la API.
- El evento de historial de tasas ahora lista una línea por tasa cambiada, no una fija.
- `getRatesForExactDate` (nueva) devuelve el juego; `getRateForExactDate` quedó como envoltorio
  que devuelve sólo el BCV, para no romper a quien ya la llamaba.
- `_buildTransactionBody` (nueva) centraliza el armado del cuerpo multimoneda de un movimiento;
  la usan `addTransaction` y `saveTransaction`, que antes duplicaban el cálculo.
- `calculateSummary` suma `amountUsdBcv` en vez de `amountBs`. **Devuelve USD**, no bolívares —
  la vista se encarga de convertir.

### 3. Vista, modal y tabla

- **`AccountingView`**: selector de moneda (Bs./USD/EUR/USDT) que convierte los tres totales en
  vivo; la tarjeta de tasas pasó de un número a las tres filas (BCV grande, EUR y USDT abajo), y
  la carga manual pasó de un input a uno por tasa con "deja en blanco las que no quieras cambiar".
- **`TransactionModal`**: selector de moneda junto al monto (con `@vueform/multiselect`, no un
  `<select>` nativo, siguiendo la convención del rediseño). Se conservó la cascada de resolución
  de tasa de cuatro escalones (API → exacta guardada → anterior con elección → manual); lo único
  que cambió es que ahora resuelve el juego `{bcv, eur, binance}` en vez de un número. La carga
  manual muestra un input por cada tasa que falte para la moneda elegida.
- **`AccountingTransactionsTable`**: las columnas Monto (Bs.)/Tasa/Monto (USD) pasaron a
  Monto (en su moneda original) / Tasa aplicada / Equivalente (USD).

### 4. Fix reportado al probar: la caché tapaba las tasas nuevas

Con la app corriendo, la consola mostró
`[Caché] Tasas encontradas para 2026-08-04: {bcv: 748.79, eur: null, binance: null}` — nunca
llegaba a la API a buscar EUR y USDT.

La causa: el corto-circuito de caché de `getRatesFromApi` preguntaba `if (existingRates.bcv)`,
que era una condición correcta cuando existía **una sola** tasa. El registro de hoy ya existía
(creado antes de este cambio, con sólo el BCV), así que se daba por bueno y EUR/USDT quedaban en
`null` para siempre.

Ahora la caché sólo corta el flujo si está **completa**, con dos matices deliberados:

- **Sólo se completa la fecha de hoy.** Para fechas pasadas se sigue devolviendo lo cacheado
  aunque esté incompleto: la API no tiene histórico, y rellenar un día viejo con las tasas de hoy
  sería atribuirle valores que no le corresponden. Para esos días está la carga manual del modal.
- **Al completar no se pisa lo que ya estaba.** Si había un BCV guardado (típicamente cargado a
  mano porque la API venía mal o caída), se conserva y sólo se agregan las que faltaban.
- Si la API falla teniendo caché parcial, se devuelve esa caché en vez de `[]` — antes ese camino
  no existía porque el corto-circuito nunca dejaba llegar a la API.

### 5. Fix reportado al probar: el modal se rompía en el campo de monto

El input de monto quedaba aplastado a unos pocos píxeles, el selector de moneda ocupaba casi todo
el ancho y aparecía una barra de scroll horizontal en el modal.

Causa: monto y moneda estaban en un `flex` con anchos a medida, pero **los dos hijos traen
`w-full` propio con `!important`** — `.ui-input` por su definición en `style.css`, y el contenedor
de `@vueform/multiselect` por `multiselectTheme.container`. Con `important: true` ningún ancho
por-uso (`flex-1`, `w-[116px]`, `min-w-0`) puede ganarles, así que ambos pedían el 100% del ancho
y se desbordaban. Es el gotcha #1 en su forma más literal.

Se resolvió **dejando de pelear**: monto y moneda pasaron a ser dos celdas de una grilla
`grid-cols-2` que colapsa a una columna bajo 640px, igual que la fila Fecha/Categoría de arriba.
Ahí el ancho completo de la celda es justo lo que se quiere, y no hace falta ningún override.

En el mismo pase se quitó el símbolo de moneda que estaba dentro del input: necesitaba un
`padding-left` por-uso para dejarle sitio, override que tampoco podía ganarle al padding
`!important` de `.ui-input` — el selector de al lado ya dice en qué moneda va el monto.

### 6. Historial y tutorial

- `getFieldLabel` de `src/utils/eventLabels.js` ahora conoce los campos de contabilidad. Esto
  **cierra de paso el hueco que quedó anotado en el handoff anterior**: los eventos viejos de
  transacciones sin `label` mostraban "Amount Bs" en vez de "Monto (Bs.)".
- El tutorial de Contabilidad explica la multimoneda, de dónde sale la tasa del USDT y por qué la
  del BCV es la base de todo.

## Estado al cerrar la sesión

- `npm run build` pasa limpio (937 módulos, ~3,4 s). `AccountingView` pesa ahora 41,6 kB
  (antes 34,2 kB); el bundle de entrada quedó igual (668,4 kB).
- **La matemática se verificó ejecutándola** con los números reales que pasó el usuario
  (bcv 748,79 · eur 861,19 · buy 873,33 · sell 829,03):
  - USDT = 851,18 → promedio exacto de compra y venta.
  - 1000 Bs → 1,3355 USD · 100 EUR → 115,0109 USD · 100 USDT → 113,6741 USD.
  - Ida y vuelta (`toUsdBcv` → `fromUsdBcv`) devuelve el valor original exacto en las 4 monedas.
  - Con una tasa faltante devuelve `null`, no 0.
- **Nada se verificó visualmente en el navegador** — restricción explícita del usuario.

## Cosas para tener en el radar

- **Los movimientos viejos se interpretan como bolívares.** Es correcto (hasta esta sesión no
  había otra opción), pero conviene que el usuario lo confirme mirando la tabla: deberían seguir
  mostrando el mismo monto en Bs. y el mismo equivalente en USD que antes.
- **El equivalente de los movimientos viejos viene redondeado a 2 decimales**, porque así se
  guardó en su momento (`amountUsd`). Los nuevos usan 6. En totales grandes puede haber una
  diferencia de centavos frente a un recálculo — se prefirió respetar el valor que el usuario vio
  cuando registró el movimiento antes que recalcularlo hoy.
- **Al editar un movimiento viejo, sus campos `amountBs`/`exchangeRate`/`amountUsd` quedan en el
  documento de Firestore con el valor anterior.** Son inertes (ningún lector los mira una vez que
  existe `currencyOriginal`), pero están ahí. Si algún día molesta, hay que limpiarlos
  explícitamente: un `set(..., {merge:true})` no borra campos.
- **`openAddModal` sigue exigiendo tasa BCV** para abrir el modal, incluso si el movimiento fuera
  a ser en USD (que no necesita ninguna tasa). Es conservador y viene de antes; si el usuario
  quiere registrar movimientos en dólares sin tasa cargada, ahí hay que aflojarlo.
- Sigue pendiente de sesiones anteriores: **CORS en producción sin verificar** para la API, y que
  esa API **no tiene lookup histórico** de tasas.
