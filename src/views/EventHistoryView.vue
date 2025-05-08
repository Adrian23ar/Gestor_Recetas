<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { db } from '../main';
import { collection, getDocs, query, orderBy, limit, startAfter, onSnapshot } from 'firebase/firestore';
import { useEventHistory } from '../composables/useEventHistory'; // Aún no lo usamos para leer, pero podría ser útil
import EventDetailsModal from '../components/EventDetailsModal.vue'; // Ajusta la ruta

// Importa DataTables y su CSS si no está global
import DataTable from 'datatables.net-vue3';
import DataTablesCore from 'datatables.net-dt';
import 'datatables.net-responsive-dt';

DataTable.use(DataTablesCore);
DataTable.use(DataTablesCore.Responsive);

const { user } = useAuth();

const localHistoryEntries = ref([]); // Para entradas de localStorage o snapshot de Firestore
const historyLoading = ref(true);
const historyError = ref(null);

const isDetailsModalVisible = ref(false);
const selectedEventEntry = ref(null);

const historyTableRef = ref(null); // Referencia para el elemento de la tabla
let dtInstance = null; // Instancia de DataTables

// --- Funciones para el Modal de Detalles ---
const showDetails = (eventEntry) => {
    selectedEventEntry.value = eventEntry;
    isDetailsModalVisible.value = true;
};

const closeDetailsModal = () => {
    isDetailsModalVisible.value = false;
    selectedEventEntry.value = null;
};

// --- Formateo y Mapeo de Datos para la Tabla ---
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Fecha desconocida';
    // Si es un timestamp de Firestore
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
    }
    // Si es un string ISO (de localStorage)
    if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleString();
    }
    return 'Fecha inválida';
};

const getEventTypeLabel = (eventType) => {
    const labels = {
        RECIPE_CREATED: 'Nueva Receta',
        RECIPE_EDITED: 'Receta Editada',
        RECIPE_DELETED: 'Receta Eliminada',
        INGREDIENT_CREATED: 'Nuevo Ingrediente',
        INGREDIENT_EDITED: 'Ingrediente Editado',
        INGREDIENT_DELETED: 'Ingrediente Eliminado',
        PRODUCTION_RECORD_CREATED: 'Nuevo Registro de Producción',
        PRODUCTION_RECORD_EDITED: 'Registro de Producción Editado',
        PRODUCTION_RECORD_DELETED: 'Registro de Producción Eliminado',
        STOCK_MANUAL_EDIT: 'Stock Editado Manualmente',
        STOCK_ADJUST_BY_PRODUCTION_ADD: 'Stock Descontado por Producción',
        STOCK_ADJUST_BY_PRODUCTION_DELETE: 'Stock Restaurado (Prod. Eliminada)',
        STOCK_ADJUST_BY_PRODUCTION_EDIT: 'Stock Ajustado por Edición de Prod.',
        TRANSACTION_CREATED: 'Transacción Creada',
        TRANSACTION_EDITED: 'Transacción Editada',
        TRANSACTION_DELETED: 'Transacción Eliminada',
        EXCHANGE_RATE_UPDATED: 'Tasa de Cambio Actualizada',
        // Añade más según tus eventType
    };
    return labels[eventType] || eventType;
};

const formattedHistoryEntries = computed(() => {
    return localHistoryEntries.value.map(entry => ({
        ...entry,
        // Campos para DataTables (deben coincidir con `columns.data` y `columns.render`)
        displayTimestamp: formatTimestamp(entry.timestamp),
        displayEntity: `${entry.entityType}: ${entry.entityName || (entry.entityId ? `ID ${entry.entityId}` : 'N/A')}`,
        displayEventType: getEventTypeLabel(entry.eventType),
        // 'originalEntry' permite pasar el objeto completo al render de acciones si es necesario
        originalEntry: entry
    }));
});


// --- Lógica de Carga de Datos del Historial ---
let unsubscribeSnapshot = null;

const PAGE_SIZE = 100; // Cuántos cargar a la vez
const lastVisibleDoc = ref(null);
const allDataLoaded = ref(false);

async function loadHistory(loadMore = false) {
    if (loadMore && allDataLoaded.value) return;
    historyLoading.value = true;
    historyError.value = null;

    // No necesitamos desuscribirnos si solo cargamos lotes con getDocs
    // Si usaras onSnapshot con paginación, sería más complejo

    if (dtInstance && !loadMore) { // Si es una carga nueva (ej. cambio de usuario), destruir tabla
        dtInstance.destroy();
        dtInstance = null;
        localHistoryEntries.value = []; // Limpiar datos anteriores
        lastVisibleDoc.value = null;
        allDataLoaded.value = false;
    }

    try {
        if (user.value) {
            let q = query(
                collection(db, `users/${user.value.uid}/eventHistory`),
                orderBy("timestamp", "desc"),
                limit(PAGE_SIZE)
            );

            if (loadMore && lastVisibleDoc.value) {
                q = query(
                    collection(db, `users/${user.value.uid}/eventHistory`),
                    orderBy("timestamp", "desc"),
                    startAfter(lastVisibleDoc.value), // Paginación
                    limit(PAGE_SIZE)
                );
            }

            const snapshot = await getDocs(q);
            const newEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (loadMore) {
                localHistoryEntries.value = [...localHistoryEntries.value, ...newEntries];
            } else {
                localHistoryEntries.value = newEntries;
            }

            lastVisibleDoc.value = snapshot.docs[snapshot.docs.length - 1] || null;
            if (snapshot.docs.length < PAGE_SIZE) {
                allDataLoaded.value = true;
            }

            console.log(`Historial cargado/actualizado: ${newEntries.length} nuevas entradas. Total: ${localHistoryEntries.value.length}`);

        } else {
            // Para localStorage, la paginación tendría que ser simulada cortando el array
            // O cargar todo si no es masivo. Por simplicidad, si es local, cargamos todo.
            const storedHistory = JSON.parse(localStorage.getItem('eventHistoryLog') || '[]');
            localHistoryEntries.value = storedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            allDataLoaded.value = true; // Asumimos que todo se carga de localStorage
        }
    } catch (e) {
        console.error("Error cargando historial:", e);
        historyError.value = "No se pudo cargar el historial.";
    } finally {
        historyLoading.value = false;
        nextTick(() => {
            initializeDataTable(); // Ya no necesita el parámetro
        });
    }
}

function initializeDataTable() { // Ya no necesita isIncrementalLoad como parámetro aquí
    if (dtInstance) {
        dtInstance.destroy();
        dtInstance = null;
        console.log("DataTables: Instancia previa destruida.");
    }

    if (historyTableRef.value && formattedHistoryEntries.value.length > 0) {
        dtInstance = new DataTablesCore(historyTableRef.value, {
            ...dtOptions,
            data: formattedHistoryEntries.value, // Siempre usa la lista completa formateada
            columns: dtColumns,
        });

        historyTableRef.value.removeEventListener('click', handleTableClick);
        historyTableRef.value.addEventListener('click', handleTableClick);
        console.log("DataTables: Instancia inicializada/recreada con " + formattedHistoryEntries.value.length + " filas.");
    } else if (historyTableRef.value) {
        dtInstance = new DataTablesCore(historyTableRef.value, {
            ...dtOptions,
            data: [],
            columns: dtColumns,
        });
        console.log("DataTables: Instancia inicializada/recreada con 0 filas.");
    }
}

// En el template, añadir un botón "Cargar Más"
// <button v-if="!allDataLoaded && !historyLoading" @click="loadHistory(true)">Cargar Más</button>

onMounted(() => {
    // loadHistory() se llamará a través del watcher de authLoading y luego user,
    // o directamente si no hay usuario. No es necesario llamarlo explícitamente aquí
    // si los watchers en useUserData y useAuth están bien configurados.
    // Sin embargo, para asegurar la carga inicial si no hay usuario, o si el usuario ya está
    // cargado antes de que este componente se monte, una llamada aquí puede ser necesaria.
    // Vamos a mantenerlo por ahora pero con cuidado.
    loadHistory();

    watch(user, (newUser, oldUser) => {
        // Solo recargar si el UID realmente cambió, o si uno es null y el otro no.
        const newUid = newUser ? newUser.uid : null;
        const oldUid = oldUser ? oldUser.uid : null;

        if (newUid !== oldUid) {
            console.log(`EventHistoryView: User state changed (Old: ${oldUid}, New: ${newUid}). Reloading history.`);
            lastVisibleDoc.value = null;
            allDataLoaded.value = false;
            if (dtInstance) { // Destruir tabla antes de cargar nuevos datos de usuario
                dtInstance.destroy();
                dtInstance = null;
                localHistoryEntries.value = []; // Limpiar para evitar mostrar datos viejos
            }
            loadHistory(false); // Carga completa para el nuevo estado de usuario
        }
    }, { deep: true }); // deep: true por si acaso, aunque UID es primitivo
});

// --- Configuración de DataTables ---
const dtColumns = [
    {
        title: 'Fecha y Hora',
        data: 'displayTimestamp',
        render: (data, type, row) => type === 'display' ? data : (row.timestamp?.seconds || new Date(row.timestamp).getTime() / 1000) // Para ordenamiento
    },
    { title: 'Elemento Modificado', data: 'displayEntity' },
    { title: 'Tipo de Cambio', data: 'displayEventType' },
    {
        title: 'Acciones',
        data: null, // No se enlaza directamente a un campo de datos
        orderable: false,
        searchable: false,
        responsivePriority: 1,
        className: 'text-center',
        render: (data, type, row) => {
            // 'row' aquí es el objeto de formattedHistoryEntries, que incluye 'originalEntry'
            return `
          <button data-action="details" data-id="${row.id}" 
                  class="px-3 py-1 cursor-pointer bg-secondary-600 text-white text-xs font-medium rounded hover:bg-secondary-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-secondary-500 transition-all dark:bg-dark-secondary-500 dark:text-dark-text-base dark:hover:bg-dark-secondary-600 dark:focus:ring-dark-secondary-500 dark:focus:ring-offset-dark-contrast">
            Detalles
          </button>
        `;
        }
    }
];

const dtOptions = {
    responsive: true,
    language: {
        search: "_INPUT_",
        searchPlaceholder: "Buscar en historial...",
        emptyTable: "No hay eventos registrados.",
        info: "Mostrando _START_ a _END_ de _TOTAL_ entradas",
        infoEmpty: "Mostrando 0 a 0 de 0 entradas",
        infoFiltered: "(filtrado de _MAX_ entradas totales)",
        lengthMenu: "Mostrar _MENU_ entradas",
        loadingRecords: "Cargando...",
        processing: "Procesando...",
        zeroRecords: "No se encontraron registros coincidentes",
        paginate: {
            first: "Primero",
            last: "Último",
            next: "Siguiente",
            previous: "Anterior"
        },
        aria: {
            sortAscending: ": activar para ordenar la columna ascendente",
            sortDescending: ": activar para ordenar la columna descendente"
        }
    },
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    order: [[0, 'desc']] // Ordenar por la primera columna (Fecha) descendente por defecto
};


function handleTableClick(event) {
    const button = event.target.closest('button[data-action="details"]');
    if (button) {
        const entryId = button.dataset.id;
        const entry = localHistoryEntries.value.find(e => e.id === entryId);
        if (entry) {
            showDetails(entry);
        }
    }
}

onMounted(() => {
    loadHistory(); // Carga inicial
    // Observar cambios en el usuario para recargar el historial
    watch(user, () => {
        console.log("Cambio de usuario detectado en EventHistoryView, recargando historial.");
        loadHistory();
    }, { immediate: false }); // No immediate aquí, ya que authLoading lo maneja
});

onUnmounted(() => {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
    }
    if (dtInstance) {
        dtInstance.destroy();
        dtInstance = null;
    }
    if (historyTableRef.value) {
        historyTableRef.value.removeEventListener('click', handleTableClick);
    }
});

</script>

<template>
    <div class="space-y-8 mt-4">
        <h1 class="text-2xl font-semibold text-primary-800 dark:text-dark-primary-200">
            Historial de Eventos del Sistema
        </h1>
        <div v-if="historyLoading" class="text-center py-10 text-text-muted italic dark:text-dark-text-muted">
            Cargando historial...
        </div>
        <div v-else-if="historyError" class="text-center py-10 text-danger-600 font-medium dark:text-danger-400">
            Error al cargar el historial: {{ historyError }}
        </div>
        <div v-else-if="formattedHistoryEntries.length === 0"
            class="text-center py-10 text-text-muted italic dark:text-dark-text-muted">
            No hay eventos registrados en el historial.
        </div>
        <div v-else class="bg-contrast p-0 rounded-lg shadow-md dark:bg-dark-contrast dark:shadow-lg overflow-hidden">
            <div class="ps-4 mt-4">
                <button v-if="!allDataLoaded && !historyLoading && formattedHistoryEntries.length > 0"
                    @click="loadHistory(true)"
                    class="cursor-pointer px-2 py-1 text-sm transition-all bg-accent-500 text-white font-semibold rounded-md shadow-sm hover:bg-accent-600">
                    Cargar Más Resultados
                </button>
                <p v-if="allDataLoaded && formattedHistoryEntries.length > 0"
                    class="text-text-muted dark:text-dark-text-muted">
                    Todos los eventos han sido cargados.
                </p>
            </div>
            <div class="datatable-container p-4">
                <table class="display wrap compact hover cell-border" style="width:100%" ref="historyTableRef">
                </table>
            </div>
        </div>

        <EventDetailsModal :show="isDetailsModalVisible" :event-entry="selectedEventEntry" @close="closeDetailsModal" />
    </div>
</template>



<style scoped>
/* Estilos específicos para esta vista si son necesarios */
/* Los estilos de DataTables deben importarse globalmente o en main.css */
</style>