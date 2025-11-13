<script setup>
import { defineProps, defineEmits, ref, onMounted, onBeforeUnmount } from 'vue';
import { formatCurrency } from '../utils/utils.js';
import DataTable from 'datatables.net-vue3';
import DataTablesCore from 'datatables.net-dt';
import DataTablesResponsive from 'datatables.net-responsive-dt';

// Integrar DataTables con el componente Vue
DataTable.use(DataTablesCore);
DataTable.use(DataTablesResponsive);

const props = defineProps({
    ingredients: {
        type: Array,
        required: true
    }
});

const emit = defineEmits(['edit-ingredient', 'delete-ingredient', 'edit-stock-click']);

// --- NUEVO: Ref para la tabla y listener ---
const dataTableRef = ref(null); // Ref para el componente DataTable
let tableElement = null;        // Para guardar el elemento DOM de la tabla
let clickListener = null;       // Para guardar la referencia al listener y poder removerlo

// --- NUEVO: Helper para Barra de Progreso ---
function renderStockLevelBar(data, type, row) {
    if (type === 'display') {
        const currentStock = Number(row.currentStock) || 0;
        const presentationSize = Number(row.presentationSize) || 0;

        if (presentationSize <= 0) {
            return '<span class="text-xs italic text-neutral-400 dark:text-dark-neutral-500">N/D</span>'; // No disponible si no hay tamaño de referencia
        }

        // Calcular porcentaje, limitado entre 0 y 100
        const percentage = Math.max(0, Math.min(100, (currentStock / presentationSize) * 100));
        let bgColor = 'bg-success-500 dark:bg-success-600'; // Verde por defecto (Alto)

        if (percentage <= 25) {
            bgColor = 'bg-danger-500 dark:bg-danger-600'; // Rojo (Bajo)
        } else if (percentage <= 60) {
            bgColor = 'bg-warning-500 dark:bg-warning-500'; // Amarillo/Ámbar (Medio)
        }

        // Tooltip para mostrar valores exactos al pasar el ratón
        const tooltipText = `${currentStock.toFixed(1)} / ${presentationSize.toFixed(1)} ${row.unit} (${percentage.toFixed(0)}%)`;

        // Renderizar HTML para la barra
        return `
            <div class="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 relative group" title="${tooltipText}">
              <div class="${bgColor} h-2 rounded-full transition-all duration-300 ease-out" style="width: ${percentage}%"></div>
              </div>
        `;
    }
    // Para ordenación/búsqueda, devolver el valor numérico del stock
    return row.currentStock;
}
// --- FIN Helper ---

// --- Definición de Columnas (Ajustar render de Acciones) ---
const columns = [
    { data: 'name', title: 'Nombre', responsivePriority: 1 },
    {
        title: 'Stock', // Nueva columna para Stock Actual
        data: 'currentStock',
        render: (data, type, row) => `${Number(data || 0).toFixed(1)} ${row.unit || ''}`, // Muestra stock y unidad
        responsivePriority: 2
    },
    {
        title: 'Nivel', // Nueva columna para Barra de Progreso
        data: 'currentStock', // Ordenar/Buscar por stock actual
        render: renderStockLevelBar, // Usar helper para renderizar barra
        className: 'min-w-[80px]' // Darle un ancho mínimo a la barra
    },
    { data: 'cost', title: 'Costo Pres.', render: (data) => formatCurrency(data) },
    { data: 'presentationSize', title: 'Tamaño Pres.', },
    { data: 'unit', title: 'Unidad' },
    {
        title: 'Costo Base', // Columna calculada
        data: null, // No mapea directamente a un campo
        render: (data, type, row) => { // 'row' es el objeto ingrediente completo
            const cost = Number(row.cost) || 0;
            const size = Number(row.presentationSize) || 0;
            const unit = row.unit || '';
            if (size > 0) {
                const baseCost = formatCurrency(cost / size);
                const baseUnit = unit === 'Uni' ? 'unidad' : (unit.endsWith('s') ? unit.slice(0, -1) : unit);
                return `${baseCost} / ${baseUnit}`;
            }
            return '-';
        }
    },
    {
        title: 'Acciones', data: null, orderable: false, searchable: false, responsivePriority: 1, className: 'text-center whitespace-nowrap', // Añadido whitespace-nowrap
        render: (data, type, row) => {
            // --- Editar botón de Stock ---
            return `
                <button data-action="edit-stock" data-id="${row.id}" title="Editar Stock" class="px-2 py-1 cursor-pointer bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 transition-all dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-500 dark:focus:ring-offset-dark-contrast mr-1">
                    Stock +
                </button>
                <button data-action="edit" data-id="${row.id}" class="px-2 py-1 cursor-pointer bg-secondary-600 text-white text-xs font-medium rounded hover:bg-secondary-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-secondary-500 transition-all dark:bg-dark-secondary-500 dark:text-dark-text-base dark:hover:bg-dark-secondary-600 dark:focus:ring-dark-secondary-500 dark:focus:ring-offset-dark-contrast mr-1">
                    Editar
                </button>
                <button data-action="delete" data-id="${row.id}" class="px-2 py-1 cursor-pointer bg-danger-600 text-white text-xs font-medium rounded hover:bg-danger-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-danger-500 transition-all dark:bg-danger-700 dark:text-dark-text-base dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:focus:ring-offset-dark-contrast">
                    Eliminar
                </button>
            `;
            // --------------------------
        }
    }
];

// Opciones de DataTables
const options = {
    responsive: true, // Habilitar modo responsivo
    language: { // Textos en español (opcional)
        search: "_INPUT_", // Quita la etiqueta "Buscar:"
        searchPlaceholder: "Buscar ingrediente..."
    },
    pageLength: 10, // Número de items por página
    lengthMenu: [5, 10, 25, 50], // Opciones para cambiar items por página
    order: [[0, 'asc']] // Ordenar por nombre por defecto

};

// --- NUEVO: Lógica de Delegación de Eventos ---
onMounted(() => {
    if (dataTableRef.value?.$el) {
        tableElement = dataTableRef.value.$el;
        clickListener = (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === 'edit') {
                const ingredientData = props.ingredients.find(ing => ing.id === id);
                if (ingredientData) emit('edit-ingredient', ingredientData);
            } else if (action === 'delete') {
                emit('delete-ingredient', id);
            } else if (action === 'edit-stock') { // <-- CAMBIADO: de 'add-stock' a 'edit-stock'
                emit('edit-stock-click', id);   // <-- CAMBIADO: emitir nuevo evento
            }
        };
        tableElement.addEventListener('click', clickListener);
    }
});

onBeforeUnmount(() => {
    // Limpiar el listener al desmontar el componente
    if (tableElement && clickListener) {
        tableElement.removeEventListener('click', clickListener);
    }
});
// --- Fin Lógica Delegación ---

</script>

<template>
    <div class="datatable-container p-4">
        <DataTable ref="dataTableRef" :data="ingredients" :columns="columns" :options="options"
            class="display wrap compact hover cell-border" width="100%" />
    </div>
</template>