<script setup>
defineProps({
    message: {
        type: String,
        default: 'Ha ocurrido un error inesperado.'
    },
    showRetry: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['retry']);

const handleRetry = () => {
    emit('retry');
};
</script>

<template>
    <div class="rounded-box border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-500/25 dark:bg-red-500/10">
        <div class="mx-auto mb-3 h-10 w-10 text-red-500 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
        </div>
        <h3 class="text-sm font-semibold text-red-700 dark:text-red-400">¡Ups! Algo salió mal</h3>
        <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {{ message }}
        </p>
        <slot />
        <div v-if="showRetry" class="mt-5">
            <button type="button" @click="handleRetry" class="ui-btn-primary">
                Reintentar
            </button>
        </div>
    </div>
</template>