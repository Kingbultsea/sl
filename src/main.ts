import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router';
import DocumentList from './components/DocumentList.vue';
import { useIntersectionObserver } from "@vueuse/core";

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

app.directive("lazy", {
    mounted(el, binding) {
        const { stop } = useIntersectionObserver(el, ([{ isIntersecting }]) => {
            console.log(isIntersecting);
            if (isIntersecting) {
                el.src = binding.value;
                //在监听的图片第一次完成加载后就停止监听
                stop();
            }
        });
    },
});

app.use(router);
app.mount('#app');
