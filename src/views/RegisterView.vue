<script setup>
import { ref, watch, computed } from 'vue';
import TableRegister from '../components/TableRegister.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import EditProductionModal from '../components/EditProductionModal.vue';
import { useUserData } from '../composables/useUserData.js';
import { useToast } from "vue-toastification";
import Multiselect from '@vueform/multiselect'; // Importar Multiselect

// --- Chart.js Imports ---
import { Pie } from 'vue-chartjs'; // Importa el componente Pie chart
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, CategoryScale } from 'chart.js'; // Importa elementos necesarios
import ChartDataLabels from 'chartjs-plugin-datalabels'; // Opcional: para etiquetas dentro del gráfico

// --- Registrar elementos de Chart.js ---
ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale, ChartDataLabels);


// --- Estado y Funciones del Composable ---
// Asegúrate de obtener productionRecords del composable
const {
    productionRecords, recipes, globalIngredients, dataLoading, dataError,
    addProductionRecord, deleteProductionRecord, saveProductionRecord, saveIngredient
} = useUserData();

// --- Estado Local ---
const selectedRecipeId = ref(null); // ID de la receta seleccionada
const productionDate = ref('');     // Fecha de producción


// --- Estado para los Modales de Eliminación y Edición de Registros ---
const showDeleteModal = ref(false);
const recordToDelete = ref(null);
const showEditModal = ref(false);
const editingRecord = ref(null);
// --- Toast Instance ---
const toast = useToast();


const pieChartData = computed(() => ({
    labels: ['Capital (40%)', 'Reinversion (40%)', 'Sueldo (20%)'],
    datasets: [
        {
            backgroundColor: [
                '#a8a29e', // primary-400 (Stone) - Ajusta si quieres otros colores
                '#fbbf24', // secondary-400 (Amber)
                '#f472b6', // accent-400 (Rose)
                // Puedes añadir colores específicos para modo oscuro si usas una función
            ],
            data: [totals.value.capital, totals.value.reinvestment, totals.value.salary],
        },
    ],
}));

const pieChartOptions = ref({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom', // Posición de la leyenda
            labels: {
                color: document.documentElement.classList.contains('dark') ? '#f5f5f4' : '#292524', // Color de texto leyenda (adapta a tu config)
                padding: 15,
                font: { size: 12 }
            }
        },
        title: {
            display: true,
            text: 'Distribución de Ganancia Neta Total',
            color: document.documentElement.classList.contains('dark') ? '#d6d3d1' : '#78716c', // Color de texto título
            font: { size: 16 }
        },
        tooltip: {
            callbacks: {
                label: function (context) {
                    let label = context.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed !== null) {
                        // Muestra el valor en $ y el porcentaje fijo
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                        label += `$${value.toFixed(2)} (${percentage}%)`;
                    }
                    return label;
                }
            }
        },
        datalabels: { // Configuración opcional para etiquetas DENTRO del gráfico
            color: '#ffffff', // Color de la etiqueta
            textAlign: 'center',
            font: {
                weight: 'bold',
                size: 12,
            },
            formatter: (value, ctx) => { // Muestra el porcentaje
                let sum = 0;
                let dataArr = ctx.chart.data.datasets[0].data;
                dataArr.map(data => { sum += data; });
                let percentage = sum > 0 ? (value * 100 / sum).toFixed(0) + "%" : '0%';
                return percentage;
            },
            // anchor: 'end', // Posición de la etiqueta
            // align: 'start',
            // offset: 10
        }
    }
});

// Watch for data errors and show a toast
watch(dataError, (errorMsg) => {
    if (errorMsg) {
        toast.error(errorMsg);
    }
});

// --- Computed Property for Delete Confirmation Message ---
const recordToDeleteName = computed(() => {
    return recordToDelete.value ? recordToDelete.value.productName : 'este registro';
});


// --- Funciones Formulario Añadir ---
async function handleAddRecord() {
    // 1. Validar Selección y Fecha
    if (!selectedRecipeId.value || !productionDate.value) {
        toast.warning('Selecciona una receta e ingresa la fecha.');
        return;
    }

    // 2. Obtener Receta Completa (asegurarse que incluye costos calculados)
    const selectedRecipe = recipes.value.find(r => r.id === selectedRecipeId.value);
    if (!selectedRecipe || selectedRecipe.calculatedTotalCost === undefined || selectedRecipe.calculatedFinalPrice === undefined) {
        toast.error('Datos incompletos o no encontrados para la receta seleccionada. Edita y guarda la receta primero.');
        return;
    }

    // 3. Validar Stock y Preparar Actualizaciones
    let hasSufficientStock = true;
    const stockUpdates = []; // Guardará { ingredientId, newStock }
    const ingredientsToUpdateLocally = []; // Guardará el objeto completo para saveIngredient

    if (!Array.isArray(selectedRecipe.ingredients) || selectedRecipe.ingredients.length === 0) {
        toast.warning(`La receta '${selectedRecipe.name}' no tiene ingredientes definidos.`);
        return; // No se puede producir sin ingredientes
    }

    for (const recipeIng of selectedRecipe.ingredients) {
        const globalIng = globalIngredients.value.find(g => g.id === recipeIng.ingredientId);
        const neededQuantity = Number(recipeIng.quantity);

        if (!globalIng) {
            toast.error(`Ingrediente ID '${recipeIng.ingredientId}' no encontrado.`); hasSufficientStock = false; break;
        }
        const currentStock = Number(globalIng.currentStock) || 0;
        if (currentStock < neededQuantity) {
            toast.error(`Stock insuficiente para '${globalIng.name}'. Necesitas: ${neededQuantity} ${globalIng.unit}, Tienes: ${currentStock} ${globalIng.unit}.`); hasSufficientStock = false;
            break;
        }
        const newStock = currentStock - neededQuantity; ingredientsToUpdateLocally.push({ ...globalIng, currentStock: newStock });
    }
    // 4. Detener si no hay stock
    if (!hasSufficientStock) {
        return;
    }

    const items = Number(selectedRecipe.itemsPerBatch) || 1;
    const ingresoTotal = selectedRecipe.calculatedFinalPrice * items;
    const gastosOperativos = selectedRecipe.calculatedTotalCost;
    const gananciaNeta = ingresoTotal - gastosOperativos; // Ganancia Neta Calculada

    // 5. Crear Objeto de Registro
    const recordToAdd = {
        id: Date.now().toString(),
        recipeId: selectedRecipe.id,
        productName: selectedRecipe.name,
        batchSize: items,
        date: productionDate.value,
        totalRevenue: ingresoTotal,      // Guardar Ingreso
        totalCost: gastosOperativos,     // Guardar Gasto
        netProfit: gananciaNeta,         // Guardar Ganancia Neta Calculada
    };

    // 6. Guardar Registro y Descontar Stock (sin cambios funcionales respecto a la versión anterior)
    productionRecords.value.push(recordToAdd); // Optimista
    console.log("RegisterView: Añadiendo registro optimista:", recordToAdd);
    try {
        const recordAddedSuccess = await addProductionRecord(recordToAdd);
        if (recordAddedSuccess) {
            console.log("RegisterView: Registro guardado en backend.");
            let stockUpdateErrors = [];
            for (const updatedIngredient of ingredientsToUpdateLocally) {
                try {
                    await saveIngredient(updatedIngredient);
                } catch (stockError) {
                    stockUpdateErrors.push(updatedIngredient.name);
                    console.error(`Error al guardar stock para ${updatedIngredient.name}:`, stockError);
                }
            }
            if (stockUpdateErrors.length > 0) {
                toast.error(`Registro guardado, PERO falló actualización de stock para: ${stockUpdateErrors.join(', ')}.`);
            } else {
                toast.success(`Producción de '${recordToAdd.productName}' registrada y stock descontado.`);
            }
            // Limpiar formulario
            selectedRecipeId.value = null;
            productionDate.value = '';
        } else {
            toast.error("Error al guardar el registro de producción.");
            // Rollback ya debería estar en useUserData
        }
    } catch (error) {
        console.error("Error handling add record:", error);
        toast.error("Ocurrió un error inesperado.");
        productionRecords.value = productionRecords.value.filter(r => r.id !== recordToAdd.id); // Rollback manual por si acaso
    }
}

// --- Funciones Modal de Eliminación (Mantener como estaban) ---
function handleDeleteRecord(recordId) {
    const record = productionRecords.value.find(r => r.id === recordId);
    if (record) {
        recordToDelete.value = record;
        showDeleteModal.value = true;
    } else {
        toast.error("Registro no encontrado para eliminar.");
    }
}

async function confirmProductionDeletion() {
    if (recordToDelete.value) {
        const recordId = recordToDelete.value.id;
        const recordName = recordToDelete.value.productName; // Get name for toast BEFORE setting to null

        showDeleteModal.value = false;
        recordToDelete.value = null; // Clear immediately

        try {
            // The composable deleteProductionRecord should return the name
            const deletedName = await deleteProductionRecord(recordId);
            toast.success(`Registro de '${deletedName || recordName}' eliminado exitosamente.`);
        } catch (error) {
            console.error("RegisterView: Error during production record deletion:", error);
            // The watcher on dataError should handle showing a toast if there's a server error
        }
    }
}

function cancelProductionDeletion() {
    showDeleteModal.value = false;
    recordToDelete.value = null;
}

// --- Funciones Modal de Edición (Mantener como estaban) ---
function handleEditRecord(record) {
    editingRecord.value = record;
    showEditModal.value = true;
}

function handleCloseEditModal() {
    showEditModal.value = false;
    editingRecord.value = null;
}

async function handleSaveChanges(updatedRecord) {
    if (!updatedRecord.productName || updatedRecord.batchSize === null || !updatedRecord.date || updatedRecord.netProfit === null) {
        toast.warning('Por favor, completa todos los campos antes de guardar.');
        return;
    }
    if (updatedRecord.batchSize <= 0) {
        toast.warning('El lote debe ser mayor a cero.');
        return;
    }
    if (updatedRecord.netProfit === null || isNaN(updatedRecord.netProfit)) {
        toast.warning('La ganancia neta debe ser un número válido.');
        return;
    }

    // Call the composable function to save changes
    await saveProductionRecord(updatedRecord);

    // Toast success (composable might also do this, but component toast provides direct feedback)
    toast.success(`Registro de '${updatedRecord.productName}' actualizado exitosamente.`);

    handleCloseEditModal(); // Close modal after save attempt
}

// --- NUEVO: Calcular Totales ---
const totals = computed(() => {
    let netProfit = 0;
    let capital = 0;
    let reinvestment = 0;
    let salary = 0;
    productionRecords.value.forEach(record => {
        const profit = Number(record.netProfit) || 0;
        if (!isNaN(profit)) {
            netProfit += profit;
            capital += profit * 0.40;
            reinvestment += profit * 0.40;
            salary += profit * 0.20;
        }
    });
    return { netProfit, capital, reinvestment, salary };
});



// Helper para formato de moneda (local, podría ir a utils)
function formatCurrency(value) {
    const num = Number(value);
    if (isNaN(num)) { return '$0.00'; }
    return `$${num.toFixed(2)}`;
}
</script>

<template>
    <div class="space-y-8 mt-4">
        <div class="bg-contrast p-6 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
            <h2 class="text-xl font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">Registrar Nueva
                Producción</h2>
            <form @submit.prevent="handleAddRecord" class="space-y-4">
                <div class="grid grid-cols-2 gap-8">
                    <div class="col-span-2 md:col-span-1">
                        <label for="select-recipe"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Receta
                            Producida:</label>
                        <Multiselect id="select-recipe" v-model="selectedRecipeId" :options="recipes"
                            placeholder="-- Selecciona una receta --" :searchable="true" valueProp="id" label="name"
                            trackBy="name" :clearOnSelect="false" :closeOnSelect="true" required :classes="{
                                container: 'relative mx-auto w-full flex items-center justify-end box-border cursor-pointer border border-neutral-300 rounded-md bg-contrast text-base leading-snug outline-none mt-1 dark:border-dark-neutral-700 dark:bg-dark-contrast',
                                containerActive: 'ring-2 ring-accent-500/50 border-accent-500 dark:ring-dark-accent-400/50 dark:border-dark-accent-400', // Añadir anillo de foco
                                singleLabelText: 'overflow-ellipsis overflow-hidden block whitespace-nowrap max-w-full text-text-base dark:text-dark-text-base',
                                placeholder: 'flex items-center h-full absolute left-0 top-0 pointer-events-none bg-transparent leading-snug pl-3.5 text-text-muted dark:text-dark-text-muted',
                                dropdown: 'absolute -left-px -right-px bottom-0 transform translate-y-full border border-neutral-300 -mt-px overflow-y-auto z-50 bg-contrast flex flex-col rounded-b-md dark:border-dark-neutral-700 dark:bg-dark-contrast ring-1 ring-black/5 dark:ring-white/5',
                                dropdownHidden: 'hidden',
                                option: 'flex items-center justify-start box-border text-left cursor-pointer text-base leading-snug py-2 px-3 text-text-base dark:text-dark-text-base',
                                optionPointed: 'text-neutral-800 bg-neutral-200 dark:text-dark-neutral-100 dark:bg-dark-neutral-700', // Hover/focused option
                                optionSelected: 'text-accent-700 bg-accent-100 dark:text-dark-accent-100 dark:bg-dark-accent-600',
                                optionDisabled: 'text-neutral-400 cursor-not-allowed dark:text-dark-neutral-500',
                                noOptions: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                noResults: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                search: 'w-full absolute inset-0 outline-none focus:ring-0 appearance-none box-border border-0 text-base font-sans bg-white  dark:bg-dark-contrast rounded pl-3.5 rtl:pl-0 rtl:pr-3.5',

                            }">
                            <template #option="{ option }">
                                <div>{{ option.name }}</div>
                                <div class="text-xs text-text-muted dark:text-dark-text-muted ml-2">
                                    (Lote: {{ option.itemsPerBatch || 'N/A' }} | PVP: {{
                                        formatCurrency(option.calculatedFinalPrice || 0) }})
                                </div>
                            </template>
                        </Multiselect>
                        <p v-if="selectedRecipeId" class="ps-0.5 mt-1 text-xs text-text-muted dark:text-dark-text-muted">
                          Lote: {{ recipes.find(r=>r.id === selectedRecipeId)?.itemsPerBatch || 'N/A' }} items |
                          PVP Final: {{ formatCurrency(recipes.find(r=>r.id === selectedRecipeId)?.calculatedFinalPrice || 0) }} |
                          Gastos Operativos: {{ formatCurrency(recipes.find(r=>r.id === selectedRecipeId)?.calculatedTotalCost || 0) }}
                      </p>
                    </div>

                    <div class="col-span-2 md:col-span-1">
                        <label for="production-date"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Fecha
                            Producción:</label>
                        <input type="date" id="production-date" v-model="productionDate" required
                            class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm bg-contrast dark:border-dark-neutral-700 dark:bg-dark-contrast dark:text-dark-text-base dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                </div>


                <div class="text-right">
                    <button type="submit"
                        class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-medium rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-background transition-all">
                        Registrar y Descontar Stock
                    </button>
                </div>
            </form>
        </div>

        <div class="grid grid-cols-2 gap-8">

            <div class="col-span-2 bg-contrast rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
                <h2 class="text-xl px-6 pt-6 pb-4 font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">
                    Historial de
                    Producción</h2>

                <div v-if="dataLoading" class="text-center text-text-muted italic dark:text-dark-text-muted"> Cargando
                    registros... </div>
                <div v-else-if="dataError" class="text-center text-danger-600 font-medium dark:text-danger-400"> Error:
                    {{ dataError }} </div>
                <TableRegister v-else :records="productionRecords" :totalNetProfit="totals.netProfit"
                    :totalCapital="totals.capital" :totalReinvestment="totals.reinvestment" :totalSalary="totals.salary"
                    @edit-record="handleEditRecord" @delete-record="handleDeleteRecord" />
            </div>

            <div
                class="col-span-2 md:col-span-1 bg-contrast p-6 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
                <h3 class="text-lg font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">Distribución
                    Total</h3>
                <div class="h-64 relative">
                    <Pie v-if="!dataLoading && totals.netProfit > 0" :data="pieChartData" :options="pieChartOptions" />
                    <p v-else-if="!dataLoading && totals.netProfit <= 0"
                        class="text-center text-text-muted dark:text-dark-text-muted italic pt-10">
                        No hay ganancias para mostrar distribución.
                    </p>
                    <p v-if="dataLoading" class="text-center text-text-muted dark:text-dark-text-muted italic pt-10">
                        Calculando...
                    </p>
                </div>
            </div>
            <div
                class="col-span-2 md:col-span-1 bg-contrast p-6 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
                <h3 class="text-lg font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">Sumas Totales
                </h3>
                <div class="space-y-2 text-sm">
                    <p class="flex justify-between"><span>Total Ganancia Neta:</span> <span
                            class="font-bold text-success-700 dark:text-success-400">{{
                                formatCurrency(totals.netProfit) }}</span></p>
                    <hr class="border-neutral-200 dark:border-dark-neutral-700">
                    <p class="flex justify-between"><span>Total Capital (40%):</span> <span class="font-medium">{{
                        formatCurrency(totals.capital) }}</span></p>
                    <p class="flex justify-between"><span>Total Reinversión (40%):</span> <span class="font-medium">{{
                        formatCurrency(totals.reinvestment) }}</span></p>
                    <p class="flex justify-between"><span>Total Sueldo (20%):</span> <span class="font-medium">{{
                        formatCurrency(totals.salary) }}</span></p>
                </div>
            </div>

        </div>

        <ConfirmationModal :show="showDeleteModal" title="Confirmar Eliminación"
            :message="`¿Eliminar registro de '${recordToDeleteName}'?`" @close="cancelProductionDeletion"
            @confirm="confirmProductionDeletion" />
        <EditProductionModal :show="showEditModal" :record="editingRecord" @close="handleCloseEditModal"
            @save="handleSaveChanges" />

    </div>
</template>