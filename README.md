# Mi Pastelería App - Gestor de Recetas

Esta es una aplicación web diseñada para gestionar recetas, ingredientes y registros de producción, probablemente orientada a una pastelería o negocio similar. Permite calcular costos, precios de venta sugeridos y llevar un control del inventario.

## Características Principales

* **Gestión de Recetas:** Crear, editar, eliminar y visualizar recetas detalladas.
* **Gestión de Ingredientes:** Añadir, editar, eliminar y monitorizar el stock de ingredientes globales.
* **Registro de Producción:** Documentar lotes de producción, asociándolos a recetas y calculando ingresos, costos y ganancias netas.
* **Cálculo de Costos y Precios:** Calcula automáticamente el costo total por receta/lote y sugiere un precio de venta final basado en márgenes de ganancia y pérdida.
* **Control de Stock:** Descuenta automáticamente el stock de ingredientes al registrar una producción y permite ajustes manuales.
* **Autenticación:** Inicio de sesión seguro utilizando Google Sign-In a través de Firebase Auth.
* **Persistencia de Datos:** Guarda los datos del usuario (recetas, ingredientes, producción) en Firestore cuando está autenticado, o en el localStorage del navegador si no lo está.
* **Historial de Eventos:** Registra las acciones importantes realizadas en la aplicación (creación, edición, eliminación de recetas, ingredientes, producción, ajustes de stock).
* **Dashboard:** Vista principal con información relevante (probablemente resumen de recetas o producción).
* **Interfaz Responsiva:** Utiliza DataTables con soporte responsivo para visualizar tablas de datos de forma adaptable.
* **Notificaciones:** Muestra mensajes informativos al usuario (éxito, error, advertencia) usando vue-toastification.

## Tecnologías Utilizadas

* **Frontend Framework:** Vue 3
* **Build Tool:** Vite
* **Styling:** Tailwind CSS
* **Backend & Base de Datos:** Firebase (Authentication, Firestore)
* **Gráficos:** Chart.js y vue-chartjs
* **Tablas de Datos:** DataTables.net y datatables.net-vue3
* **Componentes UI:** @vueform/multiselect
* **Notificaciones:** vue-toastification

## Configuración y Uso

### Prerrequisitos

* Node.js y npm (o yarn) instalados.
* Una cuenta de Firebase y un proyecto configurado con Authentication (Google Sign-In) y Firestore habilitados.

### Instalación

1.  Clona el repositorio.
2.  Navega al directorio del proyecto: `cd mi-pasteleria-app`
3.  Instala las dependencias: `npm install` (o `yarn install`)

### Configuración de Firebase

1.  Obtén la configuración de tu proyecto Firebase desde la consola de Firebase.
2.  Reemplaza el objeto `firebaseConfig` en `src/main.js` con tu propia configuración.

### Ejecutar la Aplicación

* **Modo Desarrollo:** `npm run dev`
* **Construir para Producción:** `npm run build`
* **Previsualizar Producción:** `npm run preview`

Accede a la aplicación a través de la URL proporcionada por Vite (generalmente `http://localhost:5173` en modo desarrollo).