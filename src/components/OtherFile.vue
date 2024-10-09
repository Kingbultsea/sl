<script setup lang="ts">
import { defineProps, h } from 'vue';
import { Checkbox, Button as aButton } from 'ant-design-vue';
import { FileOutlined, DeleteOutlined, ShareAltOutlined } from '@ant-design/icons-vue';
import axios from 'axios'; // 这里要注意axois 如果为单例的话会出现问题
import { copyText } from '../util';

// 定义文件类型
interface FileItem {
    url: string;
    name: string;
    lastModified: number;
    fileSize: string;
    lastModifiedText?: string;
    tag?: { color: string, name: string, id: string, havePassword?: boolean };
}

// 定义组件接收的 props
const props = defineProps<{
    currentPassword?: string,
    otherFiles: FileItem[];
    isSelectMode: boolean;
    isEditMode: boolean;
    selectedFiles: Set<string>;
    handleSelectFile: (url: string, checked: boolean, index: number) => void;
    confirmDeleteFile: (name: string) => void;
}>();

const downloadFile = async (url: string, fileName: string) => {
    try {
        const headers: Record<string, string> = {};

        // 如果有密码，则添加 Authorization 头
        if (props.currentPassword) {
            headers['Authorization'] = `Basic ${btoa('admin:' + props.currentPassword)}`;
        }

        // 发起带有 Authorization 头的请求获取文件
        const response = await axios.get(url, {
            responseType: 'blob', // 获取文件为 Blob 格式
            headers
        });

        // 创建 Blob URL
        const blobUrl = URL.createObjectURL(response.data);

        // 创建一个隐藏的 <a> 元素，并触发下载
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', fileName); // 可以在这里指定下载的文件名
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 释放 Blob URL
        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Error downloading file:', error);
    }
}
</script>

<template>
    <div>
        <div v-if="otherFiles.length > 0" style="text-align: left;margin-top: 30px;"></div>
        <div class="other-files">
            <div v-for="(file, index) in otherFiles" :key="file.url" class="file-wrapper"
                @click="isSelectMode ? handleSelectFile(file.url, !selectedFiles.has(file.url), index) : null">
                <div class="file-container"
                    :style="{ borderColor: file.tag?.color === '#ffffff' ? '' : file.tag?.color }">
                    <Checkbox v-if="isSelectMode"
                        @change="(e: any) => handleSelectFile(file.url, e.target.checked, index)" class="file-checkbox"
                        :checked="selectedFiles.has(file.url)" />
                    <div style="display: flex; align-items: center;margin-bottom: 10px;">
                        <FileOutlined class="file-icon" />
                        <div>{{ file.fileSize }}</div>
                    </div>

                    <a type="link" v-if="file.tag?.havePassword || currentPassword === undefined" style="color: #1677ff"
                        :href="file.url" target="_blank">下载</a>
                    <template v-else>
                        <a type="link" style="color: #1677ff"
                            @click.prevent="downloadFile(file.url, file.name)">下载</a>
                    </template>
                    <a class="file-name" @click="copyText(file.url)" style="color: rgb(184 240 255)">
                        <ShareAltOutlined style="padding-right: 4px;" /> 文件分享
                    </a>

                    <div class="file-name">{{ file.name }}</div>
                    <div class="file-name">{{ file.lastModifiedText }}</div>

                    <div v-if="isEditMode" class="delete-button" style="top: 0px">
                        <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteFile(file.name)" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>