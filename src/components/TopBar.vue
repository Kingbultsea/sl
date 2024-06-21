<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{ isDarkMode: boolean; uploadPath: string }>();
const emit = defineEmits(['update:isDarkMode', 'refresh']);

const toggleDarkMode = (checked: boolean) => {
  emit('update:isDarkMode', checked);
};
</script>

<template>
  <div class="top-bar">
    <span class="title">东馆Nas</span>
    <div class="actions">
      <a-button type="link" style="margin-right: 20px;" href="http://192.168.1.229:8089/%E4%B8%9C%E9%A6%86%E5%91%98%E5%B7%A5%E5%BF%85%E8%AF%BB%E6%89%8B%E5%86%8C.pdf" >东莞员工必读手册</a-button>
      <a-switch
        checked-children="🌙"
        un-checked-children="☀️"
        :checked="props.isDarkMode"
        @change="toggleDarkMode"
      />
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
