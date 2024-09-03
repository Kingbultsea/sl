<script setup lang="ts">
import { defineProps, h } from 'vue';
import { Checkbox, Button as aButton } from 'ant-design-vue';
import { FileOutlined, DeleteOutlined } from '@ant-design/icons-vue';

// 定义文件类型
interface FileItem {
    url: string;
    name: string;
    lastModified: number;
    fileSize: string;
    lastModifiedText?: string;
    tag?: { color: string, name: string, id: string };
}

// 定义组件接收的 props
const props = defineProps<{
    otherFiles: FileItem[];
    isSelectMode: boolean;
    isEditMode: boolean;
    selectedFiles: Set<string>;
    handleSelectFile: (url: string, checked: boolean, index: number) => void;
    confirmDeleteFile: (name: string) => void;
}>();
</script>

<template>
    <div>
        <div v-if="otherFiles.length > 0" style="text-align: left;margin-top: 30px;">其他文件</div>
        <div class="other-files">
            <div v-for="(file, index) in otherFiles" :key="file.url" class="file-wrapper"
                @click="isSelectMode ? handleSelectFile(file.url, !selectedFiles.has(file.url), index) : null">
                <div class="file-container" :class="{ 'high-line': file.tag?.id && file.tag?.id !== '0' }"
                    :style="{ borderColor: file.tag?.color }">
                    <Checkbox v-if="isSelectMode"
                        @change="(e: any) => handleSelectFile(file.url, e.target.checked, index)" class="file-checkbox"
                        :checked="selectedFiles.has(file.url)" />
                    <div style="display: flex; align-items: center;margin-bottom: 10px;">
                        <FileOutlined class="file-icon" />
                        <div>{{ file.fileSize }}</div>
                    </div>

                    <a type="link" style="color: #1677ff" :href="file.url" target="_blank">下载</a>
                    <div class="file-name">{{ file.name }}</div>
                    <div class="file-name">{{ file.lastModifiedText }}</div>
                    <div v-if="file.tag?.id && file.tag?.id !== '0'" class="file-name"
                        style="display: flex;justify-content: center;align-items: center;"
                        :style="{ background: file.tag?.color }">
                       
                        {{ file.tag?.name }}
                    </div>

                    <div v-if="isEditMode" class="delete-button" style="top: 0px">
                        <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteFile(file.name)" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>