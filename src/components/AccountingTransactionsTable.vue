<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import DataTable from 'datatables.net-vue3';
import DataTablesCore from 'datatables.net-dt';
import DataTablesResponsive from 'datatables.net-responsive-dt';

DataTable.use(DataTablesCore);
DataTable.use(DataTablesResponsive);

// Helper function to format currency (Bs.)
function formatCurrencyBs(value) {
    const num = Number(value);
    return isNaN(num) ? 'Bs. 0.00' : `Bs. ${num.toFixed(2)}`;
}

// Helper function to format currency (USD)
function formatCurrencyUsd(value) {
    const num = Number(value);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
}

// Helper function to format date as DD/MM/YYYY
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha Inválida';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

const props = defineProps({ records: { type: Array, default: () => [] } });
const emit = defineEmits(['edit-transaction', 'delete-transaction']);

const dataTableRef = ref(null);
let tableElement = null;
let clickListener = null;

const columns = computed(() => [
    { // Columna 0: Fecha
        title: 'Fecha', data: 'date',
        render: (data) => formatDate(data)
    },
    { // Columna 1: Tipo
        title: 'Tipo', data: 'type',
        render: (data, type, row) => {
            if (data === 'income') {
                return `<span class="text-success-700 dark:text-success-400">Ingreso</span>`;
            } else if (data === 'expense') {
                return `<span class="text-danger-700 dark:text-danger-400">Egreso</span>`;
            }
            return data;
        }
    },
    { // Columna 2: Descripción
        title: 'Descripción', data: 'description'
    },
    { // Columna 3: Categoría
        title: 'Categoría', data: 'category'
    },
    { // Columna 4: Monto (Bs.)
        title: 'Monto (Bs.)', data: 'amountBs', className: 'text-right',
        render: (data) => formatCurrencyBs(data)
    },
    { // Columna 5: Tasa (Bs/USD)
        title: 'Tasa (Bs/USD)', data: 'exchangeRate', className: 'text-right',
        render: (data) => (data ? Number(data).toFixed(2) : 'N/A')
    },
    { // Columna 6: Monto (USD)
        title: 'Monto (USD)', data: 'amountUsd', className: 'text-right',
        render: (data) => formatCurrencyUsd(data)
    },
    { // Columna 7: Acciones
        title: 'Acciones', data: null, orderable: false, searchable: false, responsivePriority: 1, className: 'text-center',
        render: (data, type, row) => {
            return `
                <button data-action="edit" data-id="${row.id}" class="px-2 py-1 cursor-pointer bg-secondary-600 text-white text-xs font-medium rounded hover:bg-secondary-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-secondary-500 transition-all dark:bg-dark-secondary-500 dark:text-dark-text-base dark:hover:bg-dark-secondary-600 dark:focus:ring-dark-secondary-500 dark:focus:ring-offset-dark-contrast mr-2">
                    Editar
                </button>
                <button data-action="delete" data-id="${row.id}" class="px-2 py-1 cursor-pointer bg-danger-600 text-white text-xs font-medium rounded hover:bg-danger-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-danger-500 transition-all dark:bg-danger-700 dark:text-dark-text-base dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:focus:ring-offset-dark-contrast">
                    Eliminar
                </button>
            `;
        }
    }
]);

const options = {
    responsive: true,
    language: {
        search: "_INPUT_",
        searchPlaceholder: "Buscar transacción...",
        info: "Mostrando _START_ a _END_ de _TOTAL_ transacciones",
        infoEmpty: "No se encontraron transacciones",
        infoFiltered: "(filtradas de un total de _MAX_ transacciones)",
        lengthMenu: "Mostrar _MENU_ transacciones",
        paginate: {
            first: "Primero",
            last: "Ultimo",
            next: "Siguiente",
            previous: "Anterior"
        },
        zeroRecords: "No se encontraron transacciones que coincidan",
        emptyTable: "No hay transacciones registradas",
        loadingRecords: "Cargando...",
        processing: "Procesando...",
    },
    pageLength: 10,
    lengthMenu: [10, 25, 50],
    order: [[0, 'desc']], // Ordenar por Fecha (columna 0) descendente
    // footerCallback removed as per requirements
    columnDefs: [ // Added name properties for clarity, matching data properties
        { name: 'date', targets: 0 },
        { name: 'type', targets: 1 },
        { name: 'description', targets: 2 },
        { name: 'category', targets: 3 },
        { name: 'amountBs', targets: 4 },
        { name: 'exchangeRate', targets: 5 },
        { name: 'amountUsd', targets: 6 },
        { name: 'actions', targets: 7, orderable: false, searchable: false } // Ensure actions column is not orderable/searchable
    ]
};

onMounted(() => {
    if (dataTableRef.value?.$el) {
        tableElement = dataTableRef.value.$el;

        clickListener = (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;
            // Find the transaction record by its ID. Ensure props.records is correctly populated.
            const transactionData = props.records.find(rec => String(rec.id) === String(id));


            if (action === 'edit') {
                if (transactionData) emit('edit-transaction', transactionData);
            } else if (action === 'delete') {
                // For delete, we typically just need the ID.
                if (transactionData) emit('delete-transaction', transactionData);
            }
        };
        tableElement.addEventListener('click', clickListener);
    }
});

onBeforeUnmount(() => {
    if (tableElement && clickListener) {
        tableElement.removeEventListener('click', clickListener);
    }
});
</script>

<template>
    <div class="datatable-container p-4">
        <DataTable ref="dataTableRef" :data="records" :columns="columns" :options="options"
            class="display wrap compact hover cell-border" width="100%">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th class="text-right">Monto (Bs.)</th>
                    <th class="text-right">Tasa (Bs/USD)</th>
                    <th class="text-right">Monto (USD)</th>
                    <th class="text-center">Acciones</th>
                </tr>
            </thead>
            <!-- tfoot removed as per requirements -->
        </DataTable>
    </div>
</template>
