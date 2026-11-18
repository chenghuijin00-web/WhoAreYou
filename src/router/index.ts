import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/team',
    name: 'Team',
    component: () => import('../views/Team.vue')
  },
  {
    path: '/test',
    name: 'Test',
    component: () => import('../views/Test.vue')
  },
  {
    path: '/result',
    name: 'Result',
    component: () => import('../views/Result.vue')
  },
  ...(import.meta.env.BASE_URL === '/' ? [{
    path: '/admin/usage',
    name: 'UsageAdmin',
    component: () => import('../views/UsageAdmin.vue')
  }] : [])
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
