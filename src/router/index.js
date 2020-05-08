import Vue from 'vue'
import VueRouter from 'vue-router'
import MainPage from "@/views/TheMainPage.vue"

Vue.use(VueRouter);

const routes = [
    {
        path: '/',
        name: 'MainPage',
        component: MainPage
    },
    {
        path: '/map',
        name: 'MainMap',
        component: () => import(/* webpackChunkName: "interactive_map" */ '../views/InteractiveMap.vue')
    },
    {
        path: '/path',
        name: 'PathViz',
        // route level code-splitting
        // this generates a separate chunk (about.[hash].js) for this route
        // which is lazy-loaded when the route is visited.
        component: () => import(/* webpackChunkName: "path_vizualization" */ '../views/PathVizualization.vue')
    }
];

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
});

export default router
