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
{ // MODIFICADA Columna 6: Estado de Venta
        title: 'Vendido',
        // Usar una función para data para manejar de forma segura la propiedad 'isSold' ausente
        data: row => row.hasOwnProperty('isSold') ? row.isSold : false,
        className: 'text-center',
        render: (data, type, row) => {
            // 'data' aquí es el resultado de la función data de arriba (true o false)
            return data ?
                 '<span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-800 dark:bg-green-600 rounded-full">Sí</span>' :
                 '<span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-700 dark:bg-red-600 rounded-full">No</span>';
        }
    },
    { // Columna 7 (antes 6)
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
    order: [[1, 'desc']], // Ordena por fecha por defecto
    footerCallback: function (tfoot, data, start, end, display) {
        var api = this.api();
        const sumColumnByDataProp = (propName) => api.column(propName + ':name', { page: 'current' }).data().reduce((a, b) => a + (Number(b) || 0), 0);

        const totalRevenue = sumColumnByDataProp('totalRevenue');
        const totalOperatingCostRecipeOnly = sumColumnByDataProp('operatingCostRecipeOnly');
        const totalLaborCostForBatch = sumColumnByDataProp('laborCostForBatch');
        const totalNetProfit = sumColumnByDataProp('netProfit');

        const footerNode = api.table().footer();
        if (!footerNode) return;
        const footerCells = footerNode.querySelectorAll('th');

        // Ahora hay 7 columnas en el cuerpo, pero el footer tiene 6 celdas para totales + 1 de acciones
        // La celda de "Vendido" en el footer no mostrará un total.
        if (footerCells.length >= 7) { // Corresponde al número de <th> en <tfoot>
            // La primera celda del footer (colspan=2) es para "TOTALES:"
            // Las siguientes celdas corresponden a los totales
            footerCells[1].innerHTML = formatCurrency(totalRevenue); // Columna Ingreso Total
            footerCells[2].innerHTML = formatCurrency(totalOperatingCostRecipeOnly); // Columna Gastos Op.
            footerCells[3].innerHTML = formatCurrency(totalLaborCostForBatch); // Columna Mano de Obra
            footerCells[4].innerHTML = formatCurrency(totalNetProfit); // Columna Ganancia Neta
            // footerCells[5] (Vendido) queda vacío o con un guion si se desea
            // footerCells[6] (Acciones) queda vacío
        } else {
            console.error("Footer mismatch. Expected at least 7 footer th elements. Found:", footerCells.length);
        }
    },
    columnDefs: [
        { name: 'productName', targets: 0 },
        { name: 'date', targets: 1 },
        { name: 'totalRevenue', targets: 2 },
        { name: 'operatingCostRecipeOnly', targets: 3 },
        { name: 'laborCostForBatch', targets: 4 },
        { name: 'netProfit', targets: 5 },
        { name: 'isSold', targets: 6, orderable: true, searchable: false }, // Nueva definición para isSold
        { name: 'colAcciones', targets: 7 } // Acciones ahora es target 7
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
            // props.records ahora debería incluir el campo isSold para cada registro
            const recordData = props.records.find(rec => rec.id === id);

            if (action === 'edit') {
                if (recordData) emit('edit-record', recordData);
            } else if (action === 'delete') {
                emit('delete-record', recordData); // Para eliminar, solo se usa el ID como antes
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
                    <th class="text-center">Vendido</th>
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
                    <th></th>
                </tr>
            </tfoot>
        </DataTable>
    </div>
</template>