<template>
    <Transition name="modal-transition">
        <div v-if="show"
            class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-6 sm:pt-10 pb-6"
            @click.self="closeModal">
            <div
                class="modal-content relative mx-auto p-5 sm:p-6 border border-neutral-300 w-full max-w-lg shadow-lg rounded-md bg-contrast dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
                <div
                    class="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4 dark:border-dark-neutral-700">
                    <h3 class="text-xl font-semibold text-primary-800 dark:text-dark-primary-200">
                        {{ isEditing ? 'Editar' : 'Registrar' }} Movimiento
                    </h3>
                    <button @click="closeModal"
                        class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
                </div>

                <form @submit.prevent="save" class="space-y-4">
                    <div class="flex items-center space-x-4">
                        <span class="text-sm font-medium text-text-base dark:text-dark-text-base">Tipo:</span>
                        <label class="flex items-center">
                            <input type="radio" v-model="formData.type" value="income" name="transactionType"
                                class="form-radio h-4 w-4 text-accent-600 border-neutral-300 focus:ring-accent-500 dark:border-dark-neutral-600 dark:bg-dark-neutral-700 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                            <span class="ml-2 text-sm text-text-base dark:text-dark-text-base">Ingreso</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" v-model="formData.type" value="expense" name="transactionType"
                                class="form-radio h-4 w-4 text-accent-600 border-neutral-300 focus:ring-accent-500 dark:border-dark-neutral-600 dark:bg-dark-neutral-700 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                            <span class="ml-2 text-sm text-text-base dark:text-dark-text-base">Egreso</span>
                        </label>
                    </div>

                    <div>
                        <label for="tx-date"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Fecha:</label>
                        <input type="date" id="tx-date" v-model="formData.date" required class="mt-1 input-field-style">
                        <p v-if="rateErrorMessage" class="text-xs text-danger-600 dark:text-danger-400 mt-1">{{
                            rateErrorMessage }}</p>
                    </div>

                    <div>
                        <label for="tx-description"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Descripción:</label>
                        <input type="text" id="tx-description" v-model="formData.description" required
                            placeholder="Ej: Venta torta, Compra harina" class="mt-1 input-field-style">
                    </div>

                    <div>
                        <label for="tx-category"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Categoría:</label>
                        <input type="text" id="tx-category" v-model="formData.category"
                            placeholder="Ej: Ventas, Materia Prima, Gastos Op." class="mt-1 input-field-style">
                    </div>

                    <div>
                        <label for="tx-amount-bs"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Monto
                            (Bs.):</label>
                        <input type="number" id="tx-amount-bs" v-model.number="formData.amountBs" required min="0.01"
                            step="0.01" class="mt-1 input-field-style">
                    </div>

                    <div class="p-2 bg-neutral-50 rounded dark:bg-dark-neutral-800/50 text-sm">
                        <p>Tasa Aplicada (Bs/USD): <strong class="dark:text-dark-secondary-300">{{ applicableRate ?
                            applicableRate.toFixed(2) : 'N/A' }}</strong></p>
                        <p>Monto USD (Calculado): <strong class="dark:text-dark-secondary-300">${{ amountUsdDisplay
                        }}</strong></p>
                    </div>

                    <div>
                        <label for="tx-notes"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Notas
                            (Opcional):</label>
                        <textarea id="tx-notes" v-model="formData.notes" rows="2"
                            class="mt-1 input-field-style"></textarea>
                    </div>

                    <div
                        class="flex justify-end pt-4 border-t border-neutral-200 mt-4 space-x-3 dark:border-dark-neutral-700">
                        <button type="button" @click="closeModal"
                            class="px-4 py-2 bg-neutral-300 text-text-base transition-all rounded-md hover:bg-neutral-400 dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
                            Cancelar
                        </button>
                        <button type="submit"
                            :disabled="!!rateErrorMessage || !formData.amountBs || formData.amountBs <= 0 || !formData.date || !formData.description"
                            class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-semibold transition-all rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                            {{ isEditing ? 'Guardar Cambios' : 'Añadir Movimiento' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useAccountingData } from '../composables/useAccountingData'; // Ajusta la ruta
import { useToast } from 'vue-toastification';

const props = defineProps({
    show: { type: Boolean, required: true },
    transactionData: { type: Object, default: null }, // Datos para editar
});

const emit = defineEmits(['close', 'save']);
const toast = useToast();

const { getRateForDate } = useAccountingData(); // Solo necesitamos esta función aquí

const defaultFormData = () => ({
    id: null,
    type: 'expense', // Default to expense
    date: new Date().toISOString().split('T')[0], // Default to today
    description: '',
    category: '',
    amountBs: null,
    exchangeRate: null, // Se asignará al seleccionar fecha
    amountUsd: 0,
    notes: '',
    // No necesitamos createdAt/updatedAt aquí, se manejan en el composable
});

const formData = ref(defaultFormData());
const applicableRate = ref(null);
const rateErrorMessage = ref('');
const isEditing = computed(() => !!props.transactionData?.id);

// Observador para resetear/llenar el formulario cuando el modal se abre/cambia el dato
watch(() => props.show, (newShow) => {
    if (newShow) {
        rateErrorMessage.value = ''; // Limpiar error al abrir
        if (props.transactionData) {
            // Modo Edición: Copia profunda y busca tasa inicial
            formData.value = JSON.parse(JSON.stringify(props.transactionData));
            // Asegurarse de que los números sean números
            formData.value.amountBs = Number(formData.value.amountBs);
            formData.value.exchangeRate = Number(formData.value.exchangeRate);
            formData.value.amountUsd = Number(formData.value.amountUsd);
            fetchRateForDate(formData.value.date, true); // Busca tasa al abrir en modo edición
        } else {
            // Modo Añadir: Resetea y busca tasa para hoy
            formData.value = defaultFormData();
            fetchRateForDate(formData.value.date);
        }
        // Enfocar el primer campo útil (ej. descripción)
        nextTick(() => {
            const input = document.getElementById('tx-description');
            input?.focus();
        });
    } else {
        // Limpiar al cerrar (opcional, pero buena práctica)
        formData.value = defaultFormData();
        applicableRate.value = null;
        rateErrorMessage.value = '';
    }
});

// Observador para la fecha, busca la tasa aplicable
watch(() => formData.value.date, (newDate) => {
    if (newDate) {
        fetchRateForDate(newDate);
    } else {
        applicableRate.value = null;
        rateErrorMessage.value = 'Selecciona una fecha válida.';
    }
});

async function fetchRateForDate(dateString, isInitialEditLoad = false) {
    const rate = getRateForDate(dateString);
    if (rate !== null && rate > 0) {
        applicableRate.value = rate;
        rateErrorMessage.value = '';
        // Si no es la carga inicial del modo edición,
        // o si es la carga inicial PERO la tasa encontrada es DIFERENTE a la guardada,
        // entonces actualizamos la tasa y recalculamos USD.
        // Esto evita recalcular si la fecha no cambió realmente o si la tasa era la misma.
        if (!isInitialEditLoad || (isInitialEditLoad && rate !== Number(formData.value.exchangeRate))) {
            formData.value.exchangeRate = rate; // Actualiza la tasa en el form
            recalculateUsd();
        }
    } else {
        applicableRate.value = null;
        rateErrorMessage.value = `No hay tasa definida para ${dateString}. Registra la tasa del día o selecciona otra fecha.`;
        formData.value.exchangeRate = null; // Asegurar que no se use una tasa inválida
        formData.value.amountUsd = 0; // Resetear USD
    }
}

function recalculateUsd() {
    if (formData.value.amountBs && applicableRate.value) {
        formData.value.amountUsd = formData.value.amountBs / applicableRate.value;
    } else {
        formData.value.amountUsd = 0;
    }
}

// Observar cambios en Monto Bs para recalcular USD (si ya hay tasa)
watch(() => formData.value.amountBs, () => {
    if (applicableRate.value) {
        recalculateUsd();
    }
});


const closeModal = () => {
    emit('close');
};

const save = () => {
    // Validaciones adicionales si son necesarias
    if (!formData.value.description.trim()) {
        toast.warning("La descripción no puede estar vacía.");
        return;
    }
    if (!formData.value.amountBs || formData.value.amountBs <= 0) {
        toast.warning("El monto en Bs. debe ser mayor a cero.");
        return;
    }
    if (!applicableRate.value) {
        toast.error(rateErrorMessage.value || "Falta la tasa de cambio para la fecha seleccionada.");
        return;
    }

    // Asegurar que la tasa y el USD calculado estén en el objeto final
    const dataToSave = {
        ...formData.value,
        exchangeRate: applicableRate.value,
        amountUsd: formData.value.amountUsd // Ya calculado
    };

    emit('save', dataToSave);
    // El modal se cierra en el componente padre después de que 'save' es exitoso
};

const amountUsdDisplay = computed(() => {
    if (formData.value.amountBs && applicableRate.value) {
        return (formData.value.amountBs / applicableRate.value).toFixed(2);
    }
    return '0.00';
});

</script>

<style scoped>


/* Asegura que el fondo oscuro del modal tenga scroll si el contenido es muy largo */
.fixed.inset-0 {
    overflow-y: auto;
}
</style>