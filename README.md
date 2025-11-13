# Mi Pastelería App - Gestor de Recetas

Esta es una aplicación web diseñada para la gestión integral de recetas, ingredientes, registros de producción y contabilidad básica, orientada a negocios de pastelería o similares. Permite calcular costos, precios de venta sugeridos, llevar un control del inventario, registrar transacciones financieras y monitorizar tasas de cambio.

## Características Principales

* **Gestión de Recetas:**
    * Crear, editar, eliminar y visualizar recetas detalladas.
    * Asociar ingredientes con cantidades y unidades específicas.
    * Cálculo automático de costos por receta/lote.
    * Sugerencia de precio de venta final basado en márgenes de ganancia y pérdida.
* **Gestión de Ingredientes Globales:**
    * Añadir, editar y eliminar ingredientes con su costo, tamaño de presentación y unidad.
    * Monitorizar el stock actual de cada ingrediente.
* **Registro de Producción:**
    * Documentar lotes de producción, asociándolos a recetas existentes.
    * Descuento automático del stock de ingredientes utilizados.
    * Cálculo de ingresos totales, costos de producción y ganancia neta por lote.
* **Módulo de Contabilidad (Nuevo):**
    * Registro de transacciones de ingresos y egresos.
    * Cálculo de montos en USD basado en tasas de cambio.
    * Gestión de tasas de cambio diarias.
    * Obtención automática de la tasa de cambio del BCV (Banco Central de Venezuela) para la fecha actual o fechas específicas.
    * Filtrado y resumen de transacciones por fecha, tipo y categoría.
* **Autenticación de Usuarios:**
    * Inicio de sesión seguro utilizando Google Sign-In a través de Firebase Authentication.
* **Persistencia de Datos:**
    * Almacenamiento de datos (recetas, ingredientes, producción, contabilidad) en Firestore cuando el usuario está autenticado.
    * Uso de `localStorage` como fallback o para usuarios no autenticados, permitiendo el uso offline o sin cuenta.
* **Historial de Eventos:**
    * Registro detallado de acciones importantes realizadas en la aplicación (creación, edición, eliminación de recetas, ingredientes, producción, transacciones, tasas de cambio y ajustes de stock).
* **Interfaz de Usuario:**
    * **Dashboard:** Vista principal con información relevante.
    * **Ingredientes:** Sección para la gestión de ingredientes globales.
    * **Registro de Producción:** Para ingresar nuevos lotes de producción.
    * **Historial de Eventos:** Para auditar cambios en el sistema.
    * **Contabilidad:** Nuevo módulo para la gestión financiera.
    * Uso de DataTables con soporte responsivo para la visualización de datos tabulares.
    * Notificaciones (Toast) para feedback al usuario (éxito, error, información) usando `vue-toastification`.
    * Selección múltiple mejorada con `@vueform/multiselect`.
    * Gráficos para visualización de datos (usando `chart.js` y `vue-chartjs`).
    * Soporte para modo oscuro.

## Tecnologías Utilizadas

* **Framework Frontend:** Vue 3 (con Composition API)
* **Herramienta de Build:** Vite
* **Estilos CSS:** Tailwind CSS (con configuración personalizada para temas claro/oscuro y paleta de colores)
* **Enrutamiento:** Vue Router
* **Gestión de Estado/Lógica Reutilizable:** Vue Composables (`useAuth`, `useUserData`, `useAccountingData`, `useEventHistory`, `useLocalStorage`)
* **Backend y Base de Datos:** Firebase
    * Firebase Authentication (Google Sign-In)
    * Firestore (Base de datos NoSQL en tiempo real)
* **Visualización de Datos:**
    * Chart.js
    * vue-chartjs
    * chartjs-plugin-datalabels
* **Tablas de Datos:**
    * DataTables.net
    * datatables.net-vue3
    * datatables.net-responsive-dt
* **Componentes UI Adicionales:**
    * @vueform/multiselect (para selects enriquecidos)
* **Notificaciones:**
    * vue-toastification
* **Tipografía:**
    * Inter (via Google Fonts)

## Estructura del Proyecto (Simplificada)

```text
mi-pasteleria-app/
├── public/
│   └── receta.ico             # Favicon (inferido de index.html)
├── src/
│   ├── assets/
│   │   └── style.css          # Estilos globales y de Tailwind
│   ├── composables/           # Lógica reutilizable (Vue Composables)
│   │   ├── useAuth.js
│   │   ├── useEventHistory.js
│   │   ├── useLocalStorage.js
│   ├── router/
│   │   └── index.js           # Configuración de rutas de Vue Router
│   ├── stores/                # Gestores de estado globales (Pinia)
│   │   ├── userData.js
│   │   └── accountingData.js
│   ├── views/                 # Componentes de página (Vistas)
│   │   ├── AccountingView.vue
│   │   ├── DashboardView.vue
│   │   ├── EventHistoryView.vue
│   │   ├── IngredientsView.vue
│   │   └── RegisterView.vue   # Para el registro de producción
│   ├── App.vue                # Componente raíz de la aplicación
│   └── main.js                # Punto de entrada, inicialización de Vue, Pinia y Firebase
├── .vscode/
│   └── extensions.json      # Recomendaciones de extensiones para VS Code
├── index.html               # Plantilla HTML principal
├── package.json             # Dependencias y scripts del proyecto
├── package-lock.json        # Lockfile de dependencias
├── tailwind.config.js       # Configuración de Tailwind CSS
├── vite.config.js           # Configuración de Vite
└── README.md                # Este archivo
```

## Configuración y Uso

### Prerrequisitos

* Node.js (versión recomendada según `package.json` o superior) y npm (o yarn) instalados.
* Una cuenta de Firebase y un proyecto configurado con:
    * **Authentication:** Habilitar el proveedor de Google Sign-In.
    * **Firestore:** Crear una base de datos Firestore.

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
    # o si usas yarn
    # yarn install
    ```

### Configuración de Firebase

1.  Obtén la configuración de tu proyecto Firebase desde la Consola de Firebase (Configuración del proyecto -> Tus apps -> SDK de Firebase -> Configuración).
2.  Crea un archivo `.env` en la raíz del proyecto.
3.  Añade tus credenciales de Firebase al archivo `.env` con las siguientes claves (estas claves se usan en `src/main.js` a través de `import.meta.env`):
    ```env
    VITE_FIREBASE_API_KEY="TU_API_KEY"
    VITE_FIREBASE_AUTH_DOMAIN="TU_AUTH_DOMAIN"
    VITE_FIREBASE_PROJECT_ID="TU_PROJECT_ID"
    VITE_FIREBASE_STORAGE_BUCKET="TU_STORAGE_BUCKET"
    VITE_FIREBASE_MESSAGING_SENDER_ID="TU_MESSAGING_SENDER_ID"
    VITE_FIREBASE_APP_ID="TU_APP_ID"
    VITE_FIREBASE_MEASUREMENT_ID="TU_MEASUREMENT_ID" # Opcional si no usas Analytics
    ```
    Asegúrate de reemplazar `"TU_..."` con tus valores reales.

### Configuración de API Externa (Opcional pero Recomendado)

La aplicación utiliza una API para obtener la tasa de cambio del BCV. En `src/composables/useAccountingData.js`, se usa un token para la API `pydolarve.org`.
* **Token API:** `...` (Este token está hardcodeado. Considera moverlo a variables de entorno si es sensible o si la API lo requiere para uso personal).

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

Accede a la aplicación a través de la URL proporcionada por Vite (generalmente `http://localhost:5173` en modo desarrollo).