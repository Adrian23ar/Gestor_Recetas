<script setup>
import { ref, computed, watch } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useAuth } from './composables/useAuth';
import { useTutorialLauncher } from './composables/useTutorial';

const { user, authLoading, signInWithGoogle, signOutUser } = useAuth();

// La vista montada registra su propio tutorial; el botón "?" sólo aparece
// cuando hay uno disponible.
const { activeTour, start: startTutorial } = useTutorialLauncher();

const isDarkMode = ref(false);
const isUserMenuOpen = ref(false);

// --- Lógica del Modo Oscuro (sin cambios respecto a la versión anterior) ---
const themePreference = localStorage.getItem('theme');

if (themePreference) {
  isDarkMode.value = themePreference === 'dark';
} else {
  isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
}

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

function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value;
}

// --- Navegación ---
const navItems = [
  { to: '/', label: 'Recetas' },
  { to: '/ingredients', label: 'Inventario' },
  { to: '/register', label: 'Producción' },
  { to: '/contabilidad', label: 'Contabilidad' },
  { to: '/historial', label: 'Historial' },
];

// --- Chip de usuario ---
const userInitial = computed(() => {
  const source = user.value?.displayName || user.value?.email || '';
  return source.charAt(0).toUpperCase() || '?';
});

function toggleUserMenu() {
  isUserMenuOpen.value = !isUserMenuOpen.value;
}
function closeUserMenu() {
  isUserMenuOpen.value = false;
}
async function handleSignOut() {
  closeUserMenu();
  await signOutUser();
}
</script>

<template>
  <div class="min-h-screen pb-16 max-[980px]:pb-24">
    <header
      class="sticky top-0 z-40 border-b border-stone-200 bg-white/92 backdrop-blur-md max-[980px]:bg-white max-[980px]:backdrop-blur-none dark:border-stone-700 dark:bg-stone-800/92 dark:max-[980px]:bg-stone-800">
      <div class="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-7 py-3.5 max-[980px]:gap-3 max-[980px]:px-4 max-[980px]:py-3">
        <!-- Izquierda: logo + nombre -->
        <RouterLink to="/" class="flex min-w-0 items-center gap-2.5">
          <img src="./assets/icon.png" alt="" class="h-[34px] w-[34px] shrink-0 rounded-xl object-cover" />
          <span class="min-w-0 leading-tight">
            <span class="block truncate text-[15px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">
              Mi Gestor de Recetas
            </span>
            <span class="block truncate text-[11px] text-stone-400 max-[640px]:hidden">
              Pastelería · datos al día
            </span>
          </span>
        </RouterLink>

        <!-- Centro: nav de píldoras (oculta ≤980px, reemplazada por la barra inferior) -->
        <nav class="ui-nav-track max-[980px]:hidden">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" custom v-slot="{ isActive, navigate, href }">
            <a :href="href" @click="navigate" :class="isActive ? 'ui-nav-pill-active' : 'ui-nav-pill'">
              {{ item.label }}
            </a>
          </RouterLink>
        </nav>

        <!-- Derecha: tutorial + tema + usuario -->
        <div class="flex items-center gap-2">
          <button v-if="activeTour" type="button" @click="startTutorial" aria-label="Ver el tutorial de esta sección"
            title="Ver el tutorial de esta sección"
            class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200">
            <svg class="h-5 w-5 fill-current" viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                clip-rule="evenodd" />
            </svg>
          </button>

          <button type="button" @click="toggleDarkMode" aria-label="Cambiar tema"
            class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200">
            <svg v-if="isDarkMode" class="h-5 w-5 fill-current" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
            <svg v-else class="h-5 w-5 fill-current" viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zm-7.917-.917a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM9 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zm-7.917-.917a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM9 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.459 4.293a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zm-7.917-.917a1 1 0 010 1.414l-.917.917a1 1 0 01-1.414 0l-.917-.917a1 1 0 010-1.414l.917-.917a1 1 0 011.414 0l.917.917zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm15 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z"
                clip-rule="evenodd" />
            </svg>
          </button>

          <div v-if="authLoading" class="ui-skeleton h-9 w-24 max-[640px]:w-9"></div>

          <div v-else-if="user" class="relative">
            <button type="button" @click="toggleUserMenu"
              class="flex cursor-pointer items-center gap-2 rounded-control bg-stone-100 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-stone-200 max-[640px]:pr-1.5 dark:bg-stone-900/60 dark:hover:bg-stone-800">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-stone-800 text-xs font-semibold text-stone-50 dark:bg-stone-600">
                {{ userInitial }}
              </span>
              <span class="max-w-[140px] truncate text-sm font-medium text-stone-700 max-[640px]:hidden dark:text-stone-200">
                {{ user.displayName || user.email }}
              </span>
            </button>

            <template v-if="isUserMenuOpen">
              <div class="fixed inset-0 z-40" @click="closeUserMenu"></div>
              <div
                class="absolute right-0 top-full z-50 mt-2 w-44 rounded-control border border-stone-200 bg-white p-1.5 shadow-raised dark:border-stone-700 dark:bg-stone-800">
                <button type="button" @click="handleSignOut" class="ui-btn-danger-ghost w-full !justify-start">
                  Cerrar Sesión
                </button>
              </div>
            </template>
          </div>

          <button v-else type="button" @click="signInWithGoogle" class="ui-btn-primary !px-4 !py-2 !text-sm">
            Iniciar Sesión
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1240px] px-7 pt-9 max-[980px]:px-4 max-[980px]:pt-6">
      <RouterView v-slot="{ Component }">
        <Transition name="fade-transition" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- Nav inferior fija (≤980px) -->
    <nav
      class="fixed inset-x-2.5 bottom-2.5 z-[55] hidden items-center gap-0.5 overflow-x-auto rounded-nav bg-stone-800 p-1.5 shadow-navbar max-[980px]:flex [&::-webkit-scrollbar]:hidden">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" custom v-slot="{ isActive, navigate, href }">
        <a :href="href" @click="navigate" :class="[
          'flex min-w-[62px] flex-1 items-center justify-center whitespace-nowrap rounded-[13px] px-1.5 py-[11px] text-[11px] font-semibold transition-colors',
          isActive ? 'bg-stone-50 text-stone-800' : 'text-stone-400 hover:text-stone-200',
        ]">
          {{ item.label }}
        </a>
      </RouterLink>
    </nav>
  </div>
</template>
