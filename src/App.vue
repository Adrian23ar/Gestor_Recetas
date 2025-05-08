<script setup>
import { ref, watch } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useAuth } from './composables/useAuth';

const { user, authLoading, signInWithGoogle, signOutUser } = useAuth();
const isMobileMenuOpen = ref(false);
const isDarkMode = ref(false);

// --- Lógica del Modo Oscuro ---
const themePreference = localStorage.getItem('theme');

if (themePreference) {
  isDarkMode.value = themePreference === 'dark';
} else {
  // Si no hay preferencia guardada, usa la preferencia del sistema
  isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Observa cambios en isDarkMode y actualiza la clase 'dark' en <html> y localStorage
watch(isDarkMode, (newValue) => {
  const root = document.documentElement;
  if (newValue) {
    root.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    root.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}, { immediate: true });

// Función para alternar el modo oscuro
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
};

// --- Lógica del Menú Móvil (Existente) ---
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false;
};
</script>

<template>
  <div class="min-h-screen bg-background text-text-base font-sans
              dark:bg-dark-background dark:text-dark-text-base">
    <header class="bg-contrast shadow-sm border-b border-neutral-200 sticky top-0 z-40
                   dark:bg-dark-contrast dark:border-dark-neutral-700 dark:shadow-lg">
      <nav class="container mx-auto px-6 py-3 flex items-center justify-between relative">
        <div class="flex items-center justify-between w-full md:w-auto">
          <RouterLink to="/" @click="closeMobileMenu" class="text-xl font-bold text-primary-800 hover:text-accent-500 transition-colors duration-200
                   dark:text-dark-primary-200 dark:hover:text-dark-accent-300">
            Mi Gestor de Recetas
          </RouterLink>
          <button @click="toggleMobileMenu" class="md:hidden text-primary-700 focus:outline-none cursor-pointer p-1 rounded hover:bg-neutral-100
                   dark:text-dark-primary-300 dark:hover:bg-dark-neutral-800">
            <svg class="h-6 w-6 fill-current" viewBox="0 0 24 24">
              <path v-if="!isMobileMenuOpen" fill-rule="evenodd" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-5h18V6H3v2z" />
              <path v-if="isMobileMenuOpen" fill-rule="evenodd"
                d="M18.293 17.293a1 1 0 01-1.414 0L12 13.414l-4.879 3.879a1 1 0 11-1.414-1.414L10.586 12l-3.879-3.879a1 1 0 111.414-1.414L12 10.586l4.879-3.879a1 1 0 111.414 1.414L13.414 12l3.879 3.879a1 1 0 010 1.414z" />
            </svg>
          </button>
        </div>

        <div class="hidden md:flex items-center space-x-4">
          <RouterLink to="/" class="router-links hover:text-accent-500 px-3 py-2 rounded-md text-sm transition-colors duration-200
                   dark:text-dark-text-muted dark:hover:text-dark-accent-300">
            Dashboard
          </RouterLink>
          <RouterLink to="/ingredients" class="router-links hover:text-accent-500 px-3 py-2 rounded-md text-sm transition-colors duration-200
                   dark:text-dark-text-muted dark:hover:text-dark-accent-300">
            Ingredientes
          </RouterLink>
          <RouterLink to="/register" class="router-links hover:text-accent-500 px-3 py-2 rounded-md text-sm transition-colors duration-200
                   dark:text-dark-text-muted dark:hover:text-dark-accent-300">
            Registro Producción
          </RouterLink>
          <Router-link to="/historial"
            class="router-links hover:text-accent-500 px-3 py-2 rounded-md text-sm transition-colors duration-200 dark:text-dark-text-muted dark:hover:text-dark-accent-300">
            Historial
          </Router-link>
          <RouterLink to="/contabilidad"
            class="router-links hover:text-accent-500 px-3 py-2 rounded-md text-sm transition-colors duration-200 dark:text-dark-text-muted dark:hover:text-dark-accent-300">
            Contabilidad
          </RouterLink>
          <button @click="toggleDarkMode" class="px-3 py-2 cursor-pointer text-sm font-medium rounded-md focus:outline-none transition-colors duration-200
                         text-text-muted hover:text-accent-500 hover:bg-neutral-100
                         dark:text-dark-text-muted dark:hover:text-dark-accent-300 dark:hover:bg-neutral-700">
            <svg v-if="isDarkMode" class="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
              fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
            <svg v-else class="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
              fill="currentColor">
              <path fill-rule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zm-7.917-.917a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM9 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zm-7.917-.917a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM9 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zm-7.917-.917a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z"
                clip-rule="evenodd" />
            </svg>
          </button>

          <div v-if="authLoading" class="text-text-muted text-sm italic
                                      dark:text-dark-text-muted">Cargando...</div>
          <div v-else>
            <div v-if="user" class="flex items-center space-x-3">
              <span class="text-sm text-text-muted dark:text-dark-text-muted">Hola, <span
                  class="font-medium text-primary-700 dark:text-dark-primary-300">{{ user.displayName
                    || user.email }}</span></span>
              <button @click="signOutUser"
                class="px-3 py-1 bg-danger-600 text-white text-xs font-medium rounded-md hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-danger-500 transition-colors duration-200
                       dark:bg-danger-700 dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:text-dark-text-base">
                Cerrar Sesión
              </button>
            </div>
            <div v-else>
              <button @click="signInWithGoogle"
                class="px-4 py-1.5 cursor-pointer bg-accent-500 text-white text-sm font-medium rounded-md hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-accent-500 transition-colors duration-200
                       dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:text-dark-text-base">
                Iniciar Sesión
              </button>
            </div>
          </div>
        </div>

        <Transition name="slide-fade">
          <div v-show="isMobileMenuOpen" class="md:hidden absolute top-full left-0 w-full bg-contrast shadow-lg border-t border-neutral-200 z-30
                      dark:bg-dark-contrast dark:shadow-2xl dark:border-dark-neutral-700">
            <div class="flex flex-col px-4 pt-2 pb-4 space-y-1">
              <RouterLink to="/" @click="closeMobileMenu" class="block hover:text-accent-600 hover:bg-neutral-100 px-3 py-2 rounded-md transition-colors duration-200
                       dark:text-dark-text-base dark:hover:text-dark-accent-300 dark:hover:bg-dark-neutral-800">
                Dashboard
              </RouterLink>
              <RouterLink to="/ingredients" @click="closeMobileMenu" class="block hover:text-accent-600 hover:bg-neutral-100 px-3 py-2 rounded-md transition-colors duration-200
                       dark:text-dark-text-base dark:hover:text-dark-accent-300 dark:hover:bg-dark-neutral-800">
                Ingredientes
              </RouterLink>
              <RouterLink to="/register" @click="closeMobileMenu" class="block hover:text-accent-600 hover:bg-neutral-100 px-3 py-2 rounded-md transition-colors duration-200
                       dark:text-dark-text-base dark:hover:text-dark-accent-300 dark:hover:bg-dark-neutral-800">
                Registro Producción
              </RouterLink>
              <Router-link to="/historial" @click="closeMobileMenu"
                class="block hover:text-accent-600 hover:bg-neutral-100 px-3 py-2 rounded-md transition-colors duration-200 dark:text-dark-text-base dark:hover:text-dark-accent-300 dark:hover:bg-dark-neutral-800">
                Historial
              </Router-link>
              <RouterLink to="/contabilidad" @click="closeMobileMenu"
                class="block hover:text-accent-600 hover:bg-neutral-100 px-3 py-2 rounded-md transition-colors duration-200 dark:text-dark-text-base dark:hover:text-dark-accent-300 dark:hover:bg-dark-neutral-800">
                Contabilidad
              </RouterLink>

              <button @click="toggleDarkMode();" class="block cursor-pointer text-text-base hover:text-accent-600 hover:bg-neutral-100 px-3 py-2 rounded-md font-medium transition-colors duration-200 w-full text-left
                              dark:text-dark-text-base dark:hover:text-dark-accent-300 dark:hover:bg-dark-neutral-800">
                <svg v-if="isDarkMode" class="h-5 w-5 inline-block mr-2 fill-current" xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                <svg v-else class="h-5 w-5 inline-block mr-2 fill-current" xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zm-7.917-.917a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM9 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM9 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z"
                    clip-rule="evenodd" />
                </svg>
                {{ isDarkMode ? 'Modo Claro' : 'Modo Oscuro' }}
              </button>

              <hr class="my-2 border-neutral-200 dark:border-dark-neutral-700">

              <div v-if="authLoading" class="text-text-muted text-sm px-3 py-2 italic
                                          dark:text-dark-text-muted">Cargando...</div>
              <div v-else>
                <div v-if="user" class="flex flex-col items-start space-y-3 px-3 py-2">
                  <span class="text-sm text-text-muted dark:text-dark-text-muted">Hola, <span
                      class="font-medium text-primary-700 dark:text-dark-primary-300">{{
                        user.displayName || user.email }}</span></span>
                  <button @click="signOutUser(); closeMobileMenu();"
                    class="w-full text-center px-3 py-1.5 bg-danger-600 text-white text-sm font-medium rounded-md hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-danger-500 transition-colors duration-200
                           dark:bg-danger-700 dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:text-dark-text-base">
                    Cerrar Sesión
                  </button>
                </div>
                <div v-else class="px-3 py-2">
                  <button @click="signInWithGoogle(); closeMobileMenu();"
                    class="w-full text-center px-4 py-1.5 cursor-pointer bg-accent-500 text-white text-sm font-medium rounded-md hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-accent-500 transition-colors duration-200
                           dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:text-dark-text-base">
                    Iniciar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </nav>
    </header>

    <main class="container mx-auto px-6 py-8 relative">
      <RouterView v-slot="{ Component }">
        <Transition name="fade-transition" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style>
/* Estilo global para el enlace activo - Usando el color de acento */
.router-link-active {
  color: oklch(64.5% 0.246 16.439) !important;
  font-weight: 700 !important;

  &:is(.dark *) {
    color: oklch(81% 0.117 11.638) !important;
  }

}

.router-links {
  text-decoration: none;
  position: relative;
  /* Para posicionar el borde con posición absoluta */
}

.router-links::after {
  content: "";
  position: absolute;
  bottom: 4px;
  left: 7px;
  width: 0;
  height: 2px;
  background-color: oklch(64.5% 0.246 16.439);
  transition: width 0.3s ease-in-out;
}

.router-links:hover::after {
  width: 85%;
  /* El borde se expande */
}

/* Transición para el menú móvil */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* card-list transitions (existing) */
.card-list-enter-active,
.card-list-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.card-list-enter-from,
.card-list-leave-to {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.card-list-leave-active {
  /* position: absolute; */
  width: 100%;
}

.card-list-move {
  transition: transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* Modal transition styles (existing in assets/style.css) */
/* These styles are in assets/style.css as discussed previously */


/* --- New Styles for Router View Fade Transition --- */

/* Classes for the transition */
.fade-transition-enter-active,
.fade-transition-leave-active {
  transition: opacity 0.2s ease;
  /* Adjust duration and timing function as needed */
}

.fade-transition-enter-from,
.fade-transition-leave-to {
  opacity: 0;
}

/* --- End Router View Fade Transition Styles --- */
</style>