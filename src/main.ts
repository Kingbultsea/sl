import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router';
import DocumentList from './components/DocumentList.vue';

const routes = [
    {
        path: '/:folderPath(.*)*',
        name: 'DocumentList',
        component: DocumentList,
        // @ts-ignore
        props: route => ({ folderPath: route.params.folderPath || '' })
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});



const app = createApp(App);

app.use(router);
app.mount('#app');
