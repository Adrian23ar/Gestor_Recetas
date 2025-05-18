<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import DataTable from 'datatables.net-vue3';
import DataTablesCore from 'datatables.net-dt';
import DataTablesResponsive from 'datatables.net-responsive-dt';

DataTable.use(DataTablesCore);
DataTable.use(DataTablesResponsive);

function formatCurrency(value) {
    const num = Number(value);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
}

const props = defineProps({ records: { type: Array, default: () => [] } });
const emit = defineEmits(['edit-record', 'delete-record']);

const dataTableRef = ref(null);
let tableElement = null;
let clickListener = null;

const columns = computed(() => [
    { // Columna 0
        title: 'Produccion', data: null,
        render: (data, type, row) => `${row.productName || 'Receta Desconocida'} <br><span class='text-xs text-text-muted dark:text-dark-text-muted'>Lote: ${row.batchSize || '?'}</span>`
    },
    { data: 'date', title: 'Fecha' }, // Columna 1
    { // Columna 2
        data: 'totalRevenue', title: 'Ingreso Total', className: 'text-right',
        render: (data) => formatCurrency(data)
    },
    { // Columna 3
        data: 'operatingCostRecipeOnly', title: 'Gastos Op. (Ingr.+Emp.)', className: 'text-right',
        render: (data) => formatCurrency(data)
    },
    { // Columna 4
        data: 'laborCostForBatch', title: 'Mano de Obra', className: 'text-right',
        render: (data) => formatCurrency(data)
    },
    { // Columna 5
        data: 'netProfit', title: 'Ganancia Neta', className: 'text-right text-success-700 dark:text-success-400 font-medium',
        render: (data) => formatCurrency(data)
    },
    { // Columna 6
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
        searchPlaceholder: "Buscar registro...",
        info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
        infoEmpty: "No se encontraron registros",
        infoFiltered: "(filtrados de un total de _MAX_ registros)",
        lengthMenu: "Mostrar _MENU_ registros",
        paginate: {
            first: "Primero",
            last: "Ultimo",
            next: "Siguiente",
            previous: "Anterior"
        },
        zeroRecords: "No se encontraron registros",
        emptyTable: "No se encontraron registros",
        loadingRecords: "Cargando...",
        processing: "Procesando...",
    },
    pageLength: 10,
    lengthMenu: [10, 25, 50],
    order: [[1, 'desc']],
    footerCallback: function (tfoot, data, start, end, display) {
        var api = this.api();
        const sumColumnByDataProp = (propName) => api.column(propName + ':name', { page: 'current' }).data().reduce((a, b) => a + (Number(b) || 0), 0);

        const totalRevenue = sumColumnByDataProp('totalRevenue');
        const totalOperatingCostRecipeOnly = sumColumnByDataProp('operatingCostRecipeOnly'); // Sumar por nuevo campo
        const totalLaborCostForBatch = sumColumnByDataProp('laborCostForBatch');       // Sumar nuevo campo
        const totalNetProfit = sumColumnByDataProp('netProfit');

        const footerNode = api.table().footer();
        if (!footerNode) return;
        const footerCells = footerNode.querySelectorAll('th');

        if (footerCells.length >= 6) {
            footerCells[1].innerHTML = formatCurrency(totalRevenue);
            footerCells[2].innerHTML = formatCurrency(totalOperatingCostRecipeOnly);
            footerCells[3].innerHTML = formatCurrency(totalLaborCostForBatch);
            footerCells[4].innerHTML = formatCurrency(totalNetProfit);
            // footerCells[5] (acciones) puede quedar vacío.
        } else {
            console.error("Footer mismatch. Expected at least 6 footer cells based on new column structure. Found:", footerCells.length);
        }
    },
    columnDefs: [
        { name: 'productName', targets: 0 },
        { name: 'date', targets: 1 },
        { name: 'totalRevenue', targets: 2 },
        { name: 'operatingCostRecipeOnly', targets: 3 },
        { name: 'laborCostForBatch', targets: 4 },
        { name: 'netProfit', targets: 5 },
        { name: 'colAcciones', targets: 6 }
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
            const recordData = props.records.find(rec => rec.id === id);

            if (action === 'edit') {
                if (recordData) emit('edit-record', recordData); // Emitir objeto completo
            } else if (action === 'delete') {
                emit('delete-record', id); // Emitir solo ID
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
                    <th>Produccion</th>
                    <th>Fecha</th>
                    <th class="text-right">Ingreso Total</th>
                    <th class="text-right">Gastos Op. (Ingr.+Emp.)</th>
                    <th class="text-right">Mano de Obra</th>
                    <th class="text-right">Ganancia Neta</th>
                    <th class="text-center">Acciones</th>
                </tr>
            </thead>
            <tfoot>
                <tr>
                    <th colspan="2" class="text-right font-bold">TOTALES:</th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                </tr>
            </tfoot>
        </DataTable>
    </div>
</template>