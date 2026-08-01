<script setup>
// Envoltorio compartido de @vuepic/vue-datepicker — reemplaza los <input type="date">
// nativos. model-type="yyyy-MM-dd" conserva el formato string plano que ya
// esperan useProductionRecords/accountingData/userData (comparaciones por
// igualdad de string, persistencia directa en Firestore/localStorage).
import { VueDatePicker } from '@vuepic/vue-datepicker';
import { es } from 'date-fns/locale';
import '@vuepic/vue-datepicker/dist/main.css';

defineProps({
    modelValue: { type: String, default: null },
    id: { type: String, default: undefined },
    placeholder: { type: String, default: 'dd/mm/aaaa' },
    error: { type: Boolean, default: false },
    size: { type: String, default: 'default' }, // 'default' | 'sm'
    disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
</script>

<template>
    <VueDatePicker :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)"
        model-type="yyyy-MM-dd" :formats="{ input: 'dd/MM/yyyy' }" :time-config="{ enableTimePicker: false }"
        :config="{ closeOnAutoApply: true }" :input-attrs="{ id, clearable: false }" :auto-apply="true"
        :locale="es" :week-start="1" :placeholder="placeholder" :disabled="disabled" :teleport="true"
        :class="[size === 'default' && 'w-full', size === 'sm' && 'ui-date-sm w-[152px]', error && 'ui-date-error']" />
</template>
