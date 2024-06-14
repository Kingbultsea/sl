<script setup lang="ts">
import { defineProps, defineEmits, ref } from 'vue';
import { Upload, message, Button } from 'ant-design-vue';
import { UploadOutlined } from '@ant-design/icons-vue';

const props = defineProps<{ isDarkMode: boolean; uploadPath: string }>();
const emit = defineEmits(['update:isDarkMode', 'refresh']);

const fileQueue = ref<any[]>([]);
const isUploading = ref(false);

const toggleDarkMode = (checked: boolean) => {
  emit('update:isDarkMode', checked);
};

const beforeUpload = (file: any) => {
  fileQueue.value.push(file);
  if (!isUploading.value) {
    uploadNextFile();
  }
  return false; // Prevent default upload behavior
};

const uploadNextFile = async () => {
  if (fileQueue.value.length === 0) {
    isUploading.value = false;
    setTimeout(() => {
      emit('refresh'); // 触发刷新事件
    }, 1000);
    return;
  }

  isUploading.value = true;
  const file = fileQueue.value.shift();
  const formData = new FormData();

  formData.append('uploadPath', props.uploadPath);
  formData.append('files', file);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      message.success(`${file.name} uploaded successfully`);
      uploadNextFile(); // 递归上传下一个文件
      if (file.onSuccess) {
        file.onSuccess(response.body, file); // 通知上传成功
      }
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    message.error('Error uploading file');
    if (file.onError) {
      file.onError(error); // 通知上传失败
    }
    uploadNextFile(); // 继续尝试上传下一个文件，即使当前文件上传失败
  }
};
</script>

<template>
  <div class="top-bar">
    <span class="title">东莞Nas</span>
    <div class="actions">
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
