// src/composables/useAsyncHandler.js
import { ref } from 'vue';
import { useToast } from 'vue-toastification';

export function useAsyncHandler() {
  const loading = ref(false);
  const error = ref(null);
  const toast = useToast();

  async function runAsync(asyncFn, errorMessage = 'Ocurrió un error inesperado') {
    loading.value = true;
    error.value = null;

    try {
      const result = await asyncFn();
      return result;
    } catch (err) {
      error.value = err;
      console.error(err);
      toast.error(errorMessage);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    runAsync,
  };
}
