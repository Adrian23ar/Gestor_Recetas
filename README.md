# Mi Pastelería App - Gestor de Recetas

Aplicación web para la gestión integral de recetas, ingredientes, registros de producción y
contabilidad básica, orientada a negocios de pastelería o similares. Permite calcular costos,
precios de venta sugeridos, llevar control del inventario, registrar transacciones financieras y
monitorizar tasas de cambio. Toda la interfaz está en español (Venezuela).

## Características Principales

* **Gestión de Recetas:**
    * Crear, editar, eliminar y visualizar recetas detalladas.
    * Asociar ingredientes con cantidades y unidades específicas.
    * Cálculo automático de costos por receta/lote: el precio se recalcula solo cuando cambia el
      costo de un ingrediente en el inventario.
    * Sugerencia de precio de venta final basado en margen de ganancia y buffer de pérdida.
* **Gestión de Ingredientes Globales:**
    * Añadir, editar y eliminar ingredientes con su costo, tamaño de presentación y unidad.
    * Nivel de stock (alto / medio / bajo) calculado sobre el tamaño de la presentación.
* **Registro de Producción:**
    * Documentar lotes de producción, asociándolos a recetas existentes.
    * Descuento automático del stock de ingredientes utilizados (y restauración al eliminar el
      registro).
    * Cálculo de ingresos totales, costos de producción y ganancia neta por lote.
* **Módulo de Contabilidad (multimoneda):**
    * Registro de transacciones de ingresos y egresos en **Bs. (VES), USD, EUR o USDT**, mezcladas
      libremente. Cada movimiento conserva el monto y la moneda tal como se cargaron.
    * Para poder totalizar monedas distintas, todo se guarda además convertido a una unidad
      común (dólares a tasa BCV), junto con las tasas del momento: un movimiento viejo no cambia
      de valor aunque la tasa de hoy sea otra.
    * Selector para leer los totales (ingresos, egresos y saldo neto) en cualquiera de las cuatro
      monedas, en vivo.
    * Gestión de tasas de cambio diarias (Bs/USD, Bs/EUR y Bs/USDT), con obtención automática y
      carga manual como alternativa.
    * Filtrado y resumen de transacciones por periodo y tipo.
* **Historial de Eventos:**
    * Registro detallado de acciones importantes (creación, edición y eliminación de recetas,
      ingredientes, producción, transacciones y tasas, además de los ajustes de stock).
    * Búsqueda por texto y filtros por día, semana, mes y últimos 3 meses.
* **Tutoriales guiados:**
    * Un recorrido paso a paso por cada vista, que se abre solo en la primera visita y puede
      reabrirse con el botón `?` de la barra superior.
    * Un tutorial específico dentro de la ficha de receta que explica de dónde sale el precio:
      mano de obra, items por lote, margen de ganancia y buffer de pérdida.
    * Los pasos que apuntan a algo que no está en pantalla (estados vacíos, avisos condicionales)
      se omiten automáticamente.
* **Autenticación de Usuarios:**
    * Inicio de sesión mediante Google Sign-In a través de Firebase Authentication.
* **Persistencia de Datos:**
    * Almacenamiento en Firestore cuando el usuario está autenticado, con **caché offline
      habilitado** (`persistentLocalCache`): la app sigue funcionando sin conexión.
    * Uso de `localStorage` como fallback para usuarios no autenticados.
* **Interfaz de Usuario:**
    * **Recetas** (`/`), **Inventario** (`/ingredients`), **Producción** (`/register`),
      **Contabilidad** (`/contabilidad`) e **Historial** (`/historial`).
    * Diseño responsive desktop-first: las tablas se convierten en tarjetas expandibles en
      móvil y la navegación pasa a una barra inferior fija.
    * Soporte para modo claro y oscuro.
    * Notificaciones (toasts) para feedback al usuario con `vue-toastification`.

## Tecnologías Utilizadas

* **Framework Frontend:** Vue 3 (`<script setup>` en todos los componentes)
* **Herramienta de Build:** Vite
* **Estilos CSS:** Tailwind CSS v4 (vía `@tailwindcss/vite`, con config JS "legacy" puenteado
  desde `src/assets/style.css`). Catálogo propio de clases `.ui-*` que centraliza los estilos y
  sus variantes de modo oscuro.
* **Enrutamiento:** Vue Router
* **Gestión de Estado:** Pinia (`src/stores/`) + composables para la lógica de cada vista
* **Backend y Base de Datos:** Firebase
    * Firebase Authentication (Google Sign-In)
    * Firestore, con persistencia offline
* **Componentes UI Adicionales:**
    * `@vueform/multiselect` (selects enriquecidos)
    * `@vuepic/vue-datepicker` (selectores de fecha; requiere `date-fns` para el locale)
    * `driver.js` (tutoriales guiados)
* **Notificaciones:** `vue-toastification`
* **Tipografía:** Nunito (vía Google Fonts)

## Estructura del Proyecto (Simplificada)

```text
mi-pasteleria-app/
├── public/
├── src/
│   ├── assets/
│   │   └── style.css          # Tailwind + catálogo de clases .ui-* y overrides de librerías
│   ├── components/            # Modales y componentes de vista
│   │   └── ui/                # Primitivas compartidas sin lógica de negocio
│   │       ├── ResponsiveTable.vue
│   │       └── DateField.vue
│   ├── composables/           # Lógica reutilizable por vista
│   │   ├── useAuth.js
│   │   ├── useDashboard.js
│   │   ├── useIngredients.js
│   │   ├── useProductionRecords.js
│   │   ├── useRecipeCosts.js  # Fórmula única de costeo de recetas
│   │   ├── useDataTable.js
│   │   ├── useEventHistory.js
│   │   ├── useLocalStorage.js
│   │   └── useTutorial.js     # Sistema de tutoriales guiados
│   ├── router/
│   │   └── index.js
│   ├── stores/                # Fuente de verdad de los datos (Pinia)
│   │   ├── userData.js        # Recetas, ingredientes y producción
│   │   └── accountingData.js  # Transacciones y tasas de cambio
│   ├── utils/                 # Helpers puros
│   │   ├── utils.js
│   │   ├── currency.js        # Motor multimoneda: conversiones y normalización
│   │   ├── eventLabels.js     # Etiquetas de eventos y campos del historial
│   │   └── tourSteps.js       # Contenido de los tutoriales
│   ├── views/                 # Una vista por ruta
│   │   ├── DashboardView.vue
│   │   ├── IngredientsView.vue
│   │   ├── RegisterView.vue
│   │   ├── AccountingView.vue
│   │   └── EventHistoryView.vue
│   ├── App.vue
│   └── main.js                # Vue, Pinia y Firebase (incl. persistencia offline)
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js             # Incluye el proxy /api-dolar para desarrollo
├── CLAUDE.md                  # Contexto de arquitectura y gotchas del proyecto
└── README.md
```

> Nota: `src/composables/useUserData.js` y `src/composables/useAccountingData.js` son versiones
> anteriores a la migración a Pinia y **ya no se usan** (ningún archivo las importa). Los
> archivos reales son los de `src/stores/`.

## Configuración y Uso

### Prerrequisitos

* Node.js y npm instalados.
* Una cuenta de Firebase con un proyecto configurado:
    * **Authentication:** habilitar el proveedor de Google Sign-In.
    * **Firestore:** crear una base de datos.

### Instalación

1.  Clona el repositorio:
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    ```
2.  Navega al directorio del proyecto:
    ```bash
    cd mi-pasteleria-app
    ```
3.  Instala las dependencias:
    ```bash
    npm install
    ```

### Configuración de variables de entorno

Copia `.env.example` a `.env` y completa los valores. El archivo `.env` no está versionado.

```env
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
VITE_FIREBASE_MEASUREMENT_ID=""   # Opcional, sólo si usas Analytics
VITE_DOLARVENEZUELA_API_URL="https://dolarflashve.eu/api/rates/all"
```

### API de tasas de cambio

Las tasas se obtienen de `https://dolarflashve.eu/api/rates/all` (GET público, sin
autenticación). No requiere token. La respuesta trae cuatro tasas:

```json
{
  "bcvUsd":      { "rate": 748.79, "date": "..." },
  "bcvEur":      { "rate": 861.19, "date": "..." },
  "binanceBuy":  { "rate": 873.33, "date": "..." },
  "binanceSell": { "rate": 829.03, "date": "..." }
}
```

La app usa `bcvUsd` (Bs/USD), `bcvEur` (Bs/EUR) y el **promedio de `binanceBuy` y `binanceSell`**
como tasa del USDT.

Dos limitaciones a tener presentes:

* **CORS:** la API no permite peticiones directas desde otro origen, así que en desarrollo se
  llama a través del proxy `/api-dolar` definido en `vite.config.js`. Ese proxy sólo existe con
  `npm run dev`; en un build estático no hay servidor que haga de intermediario.
* **Sin histórico:** la API sólo devuelve las tasas vigentes. Si registras un movimiento con una
  fecha pasada para la que nunca se guardaron tasas, se usarán las de hoy. Para esos casos
  conviene cargarlas manualmente desde la vista de Contabilidad.

### Ejecutar la Aplicación

* **Modo Desarrollo (con Hot Reload):**
    ```bash
    npm run dev
    ```
* **Construir para Producción:**
    ```bash
    npm run build
    ```
* **Previsualizar la Build de Producción Localmente:**
    ```bash
    npm run preview
    ```

Accede a la aplicación a través de la URL que indique Vite (por defecto `http://localhost:5173`).

## Documentación adicional

* [`CLAUDE.md`](CLAUDE.md) — arquitectura, convenciones y *gotchas* del proyecto. Léelo antes de
  tocar el código.
* [`REDISENO-GUIA.md`](REDISENO-GUIA.md) y [`REDISENO-PLAN.md`](REDISENO-PLAN.md) — tokens de
  diseño, catálogo de clases `.ui-*` y breakpoints.
* [`handoff.md`](handoff.md) — registro de la última sesión de trabajo.
