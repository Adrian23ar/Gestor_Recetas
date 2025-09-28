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
      console.error("useAsyncHandler capturó un error:", err);

      let userFriendlyMessage = errorMessage; // Mensaje por defecto

      // --- Lógica mejorada para mensajes de error ---
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        userFriendlyMessage = 'Error de red. Revisa tu conexión a internet.';
      } else if (err.response) { // Para errores de respuestas HTTP (si usaras librerías como axios)
        if (err.response.status >= 500) {
          userFriendlyMessage = 'Problema en el servidor. Inténtalo de nuevo más tarde.';
        } else if (err.response.status === 404) {
          userFriendlyMessage = 'El recurso solicitado no fue encontrado.';
        } else if (err.response.status === 403) {
          userFriendlyMessage = 'No tienes permisos para realizar esta acción.';
        }
      } else if (err.message) {
        // Usar el mensaje del error si es descriptivo, pero manteniendo el fallback
        userFriendlyMessage = err.message;
      }

      toast.error(userFriendlyMessage);
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