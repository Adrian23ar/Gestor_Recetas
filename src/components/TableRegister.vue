<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'; // Añadir ref, onMounted, onBeforeUnmount
import DataTable from 'datatables.net-vue3';
import DataTablesCore from 'datatables.net-dt';
import DataTablesResponsive from 'datatables.net-responsive-dt';

DataTable.use(DataTablesCore);
DataTable.use(DataTablesResponsive);

// Helper para formato de moneda
function formatCurrency(value) {
    const num = Number(value);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
}

const props = defineProps({ records: { type: Array, default: () => [] } });
const emit = defineEmits(['edit-record', 'delete-record']);

// --- NUEVO: Ref para la tabla y listener ---
const dataTableRef = ref(null);
let tableElement = null;
let clickListener = null;

// Definición de Columnas
const columns = [
    {
        title: 'Produccion', data: null,
        render: (data, type, row) => `${row.productName || 'Receta Desconocida'} <br><span class='text-xs text-text-muted dark:text-dark-text-muted'>Lote: ${row.batchSize || '?'}</span>`
    },
    { data: 'date', title: 'Fecha' },
    {
        data: 'totalRevenue', title: 'Ingreso Total', className: 'text-right',
        render: (data) => formatCurrency(data)
    },
    {
        data: 'totalCost', title: 'Gastos Op.', className: 'text-right',
        render: (data) => formatCurrency(data)
    },
    {
        data: 'netProfit', title: 'Ganancia Neta', className: 'text-right text-success-700 dark:text-success-400 font-medium',
        render: (data) => formatCurrency(data)
    },
    {
        title: 'Capital (40%)', data: null, className: 'text-right',
        render: (data, type, row) => formatCurrency((Number(row.netProfit) || 0) * 0.40)
    },
    {
        title: 'Reinversion (40%)', data: null, className: 'text-right',
        render: (data, type, row) => formatCurrency((Number(row.netProfit) || 0) * 0.40)
    },
    {
        title: 'Sueldo (20%)', data: null, className: 'text-right',
        render: (data, type, row) => formatCurrency((Number(row.netProfit) || 0) * 0.20)
    },
    {
        title: 'Acciones', data: null, orderable: false, searchable: false, responsivePriority: 1, className: 'text-center',
        // --- Renderizar HTML simple con data-attributes ---
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
        // -------------------------------------------------
    }
];

// Opciones de DataTables con FooterCallback corregido
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
    order: [[1, 'desc']], // Ordenar por fecha descendente por defecto
    footerCallback: function (tfoot, data, start, end, display) {
        var api = this.api();
        const sumColumn = (colIndex) => api.column(colIndex, { page: 'current' }).data().reduce((a, b) => a + (Number(b) || 0), 0);

        // Indices basados en las NUEVAS columnas (0-8)
        const totalRevenue = sumColumn(2);     // Ingreso Total
        const totalCost = sumColumn(3);        // Gastos Op.
        const totalNetProfit = sumColumn(4);   // Ganancia Neta
        const totalCapital = totalNetProfit * 0.40;
        const totalReinvestment = totalNetProfit * 0.40;
        const totalSalary = totalNetProfit * 0.20;

        const footerNode = api.table().footer();
        if (!footerNode) return;
        const footerCells = footerNode.querySelectorAll('th');

        // Indices para celdas del footer (considerando colspan=2 en la primera)
        // Celda 0: Colspan 2 (Label)
        // Celda 1: Ingreso Total (Col Idx 2)
        // Celda 2: Gastos Op (Col Idx 3)
        // Celda 3: Ganancia Neta (Col Idx 4)
        // Celda 4: Capital (Col Idx 5)
        // Celda 5: Reinversion (Col Idx 6)
        // Celda 6: Sueldo (Col Idx 7)
        // Celda 7: Acciones (Vacía)
        if (footerCells.length >= 8) { // Necesitamos 8 celdas ahora
            footerCells[1].innerHTML = formatCurrency(totalRevenue);
            footerCells[2].innerHTML = formatCurrency(totalCost);
            footerCells[3].innerHTML = formatCurrency(totalNetProfit);
            footerCells[4].innerHTML = formatCurrency(totalCapital);
            footerCells[5].innerHTML = formatCurrency(totalReinvestment);
            footerCells[6].innerHTML = formatCurrency(totalSalary);
        } else {
            console.error("Footer mismatch. Expected 8 cells. Found:", footerCells.length);
        }
    }
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

            // Usar la API de DataTables para obtener los datos de la fila si es necesario
            // let rowData = null;
            // if (action === 'edit') {
            //    try {
            //        const dtInstance = $(tableElement).DataTable(); // Si jQuery está disponible
            //        const tr = button.closest('tr');
            //        if (tr) rowData = dtInstance.row(tr).data();
            //    } catch(e) { console.error("Error getting row data", e); }
            // }
            // Alternativa: Buscar en el array original (menos ideal si hay paginación/filtrado)
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
// --- Fin Lógica Delegación ---

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
                    <th class="text-right">Gastos Op.</th>
                    <th class="text-right">Ganancia Neta</th>
                    <th class="text-right">Capital (40%)</th>
                    <th class="text-right">Reinversion (40%)</th>
                    <th class="text-right">Sueldo (20%)</th>
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
                    <th></th>
                </tr>
            </tfoot>
        </DataTable>
    </div>
</template>