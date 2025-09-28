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
    <div
        class="text-center py-10 px-4 border-2 border-dashed border-danger-300 dark:border-danger-700/50 rounded-lg bg-danger-50 dark:bg-danger-900/20">
        <div class="w-12 h-12 mx-auto mb-4 text-danger-500 dark:text-danger-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
        </div>
        <h3 class="text-lg font-semibold text-danger-700 dark:text-danger-300">¡Ups! Algo salió mal</h3>
        <p class="mt-2 text-sm text-danger-600 dark:text-danger-400">
            {{ message }}
        </p>
        <div v-if="showRetry" class="mt-6">
            <button @click="handleRetry"
                class="px-4 py-2 bg-accent-500 text-white font-semibold rounded-lg shadow hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-all duration-150 dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400">
                Reintentar
            </button>
        </div>
    </div>
</template>