<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import DocumentList from './components/DocumentList.vue';
import TopBar from './components/TopBar.vue';
import { useRoute } from 'vue-router';
import { useSpinningStore } from '@/stores/spinningStore';

const isDarkMode = ref(false);
const route = useRoute();
const spinning = ref({ show: false, tip: "" });
const spinningStore = useSpinningStore();
const folderPath = computed(() => {
  // 确保 route.params.folderPath 是字符串，如果是数组则转换为字符串
  const path = Array.isArray(route.params.folderPath)
    ? route.params.folderPath.join('/')
    : (route.params.folderPath || '');

  return '/' + path.replace(/,+/g, '/'); // 去除多余的逗号并用斜杠代替
});

watch(isDarkMode, (newValue) => {
  document.documentElement.setAttribute('data-theme', newValue ? 'dark' : 'light');
});

const uploadPath = computed(() => {
  return `${folderPath.value}`;
});

const documentListRef = ref();

const refreshDocumentList = () => {
  if (documentListRef.value) {
    documentListRef.value.fetchHtmlAndExtractImages();
  }
};

</script>

<template>
  <div>
    <a-spin :spinning="spinningStore.spinning.show" tip="上传中，请问刷新页面中断上传">
      <TopBar @refresh="refreshDocumentList" :isDarkMode="isDarkMode" @update:isDarkMode="isDarkMode = $event"
        :uploadPath="uploadPath" />
      <DocumentList :isDarkMode="isDarkMode" ref="documentListRef" />
    </a-spin>
  </div>
</template>

<style>
body {
  background-color: var(--background-color);
  color: var(--text-color);
  transition: background-color 0.3s, color 0.3s;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

:root {
  --background-color: #fff;
  --text-color: #000;
}

[data-theme='dark'] {
  --background-color: #000;
  --text-color: #fff;
}

[data-theme='light'] {
  --background-color: #fff;
  --text-color: #000;
}
</style>
