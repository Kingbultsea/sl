<script setup lang="ts">
import { defineProps, defineEmits, ref, onMounted } from 'vue';
import PermissionsSetting from './PermissionsSetting.vue';
import { useSpinningStore } from '../stores/spinningStore';

const spinningStore = useSpinningStore();
const props = defineProps<{ isDarkMode: boolean; uploadPath: string }>();
const emit = defineEmits(['update:isDarkMode', 'refresh']);

const toggleDarkMode = (checked: boolean) => {
  emit('update:isDarkMode', checked);
};

const isBadgeVisible = ref(false);

const handleBadgeClick = () => {
  isBadgeVisible.value = false;
  localStorage.setItem('badgeVisible', 'false');
};

onMounted(() => {
  const storedBadgeState = localStorage.getItem('badgeVisible');
  if (storedBadgeState === 'false') {
    isBadgeVisible.value = false;
  } else {
    isBadgeVisible.value = true;
  }
});
</script>

<template>
  <div class="top-bar">
    <span class="title">东馆Nas</span>
    <div class="actions">
      <PermissionsSetting v-if="spinningStore.isInWhiteList" />

      <a-badge :dot="isBadgeVisible" style="margin-right: 20px;">
        <a-button target="_blank" type="link"
          href="http://192.168.1.229:8089/%E4%B8%9C%E9%A6%86%E5%91%98%E5%B7%A5%E5%BF%85%E8%AF%BB%E6%89%8B%E5%86%8C.pdf"
          @click="handleBadgeClick">东馆员工必读手册</a-button>
      </a-badge>
      <a-switch checked-children="🌙" un-checked-children="☀️" :checked="props.isDarkMode" @change="toggleDarkMode" />
    </div>
  </div>
</template>

<style scoped>
.top-bar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1em;
  box-sizing: border-box;
  color: var(--text-color);
}

.actions {
  display: flex;
  align-items: center;
}

.title {
  font-size: 1.5em;
}

:root {
  --background-color: #fff;
  --text-color: #000;
}

[data-theme='dark'] {
  --background-color: #333;
  --text-color: #fff;
}

[data-theme='light'] {
  --background-color: #fff;
  --text-color: #000;
}
</style>
