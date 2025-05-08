// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/ingredients',
    name: 'Ingredients',
    component: () => import('../views/IngredientsView.vue'),
  },
  {
    path: '/register',
    name: 'ProductionRegister',
    component: () => import('../views/RegisterView.vue'),
  },
  // --- NUEVA RUTA PARA EL HISTORIAL DE EVENTOS ---
  {
    path: '/historial', // Puedes usar '/event-history' o la URL que prefieras
    name: 'EventHistory',
    component: () => import('../views/EventHistoryView.vue'), // Asegúrate que la ruta al componente sea correcta
  }
  // --- FIN NUEVA RUTA ---
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;