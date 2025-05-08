// src/composables/useLocalStorage.js
import { ref, watch } from 'vue';

export function useLocalStorage(key, defaultValue = null) {
  // Intentamos obtener el valor inicial desde localStorage
  const storedValue = localStorage.getItem(key);
  const initialValue = storedValue ? JSON.parse(storedValue) : defaultValue;

  // Creamos una referencia reactiva con el valor inicial
  const data = ref(initialValue);

  // Observamos cambios en la data y actualizamos localStorage
  watch(data, (newValue) => {
    if (newValue === null || newValue === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(newValue));
    }
  }, { deep: true }); // deep: true es importante para objetos y arrays

  // Devolvemos la referencia reactiva
  return data;
}