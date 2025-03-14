<script setup lang="ts">
import { defineProps, h, ref, watch } from 'vue';
import { Checkbox, Button as aButton, Modal, message } from 'ant-design-vue';
import { FileOutlined, DeleteOutlined, ShareAltOutlined } from '@ant-design/icons-vue';
import axios from 'axios';
import { copyText } from '../util';

// 定义文件类型
interface FileItem {
    url: string;
    name: string;
    lastModified: number;
    fileSize: string;
    lastModifiedText?: string;
    tag?: { color: string, name: string, id: string, havePassword?: boolean, commonSortOrder?: number };
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
    sortOption: string;
}>();

// 本地副本
const localOtherFiles = ref<FileItem[]>([...props.otherFiles]);

// 监听 props 更新本地副本并按排序更新
watch(
    () => props.otherFiles,
    (newFiles) => {
        if (props.sortOption === "date-desc-false" || props.sortOption === "date-asc-false") {
            localOtherFiles.value = [...newFiles];
        } else {
            localOtherFiles.value = [...newFiles].sort((a, b) => {
                const orderA = a.tag?.commonSortOrder ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.tag?.commonSortOrder ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
            });
        }
    },
    { immediate: true, deep: true }
);

const dragIndex = ref<number | null>(null); // 当前拖拽的索引

// 处理拖拽开始
const handleDragStart = (index: number) => {
    dragIndex.value = index;
    console.log(`Dragging file at index: ${index}`);
};

// 处理拖拽结束
const handleDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault(); // 阻止默认行为
    if (dragIndex.value === null) return;

    Modal.confirm({
        title: '确认更改',
        content: `是否更改文件位置顺序?`,
        onOk() {
            const draggedFile = localOtherFiles.value[dragIndex.value!];
            localOtherFiles.value.splice(dragIndex.value!, 1); // 移除拖拽的文件
            localOtherFiles.value.splice(targetIndex, 0, draggedFile); // 插入到目标位置

            // 更新 commonSortOrder
            localOtherFiles.value.forEach((file, index) => {
                if (file.tag) {
                    file.tag.commonSortOrder = index;
                }
            });

            dragIndex.value = null; // 重置拖拽索引

            console.log(`Updated file order:`, localOtherFiles.value);
            saveFileOrder(); // 调用保存排序的接口
        },
        onCancel() {
            dragIndex.value = null; // 重置拖拽索引
            message.info('Sort order change cancelled.');
        },
    });
};

// 阻止默认的拖放行为
const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
};

// 保存排序的函数
const saveFileOrder = async () => {
    const updatedOrder = localOtherFiles.value.map((item, index) => ({
        path: item.url.replace(/https?:\/\/[^\/:]+(:\d+)?\//, '').replace(/^\/+/, ''), // 去掉开头的 "/"
        sortOrder: "" + index,
    }));

    try {
        const response = await axios.post('/set-tag-sort', { files: updatedOrder });
        console.log('Sort order updated successfully:', response.data);
        message.success('文件排序已保存');
    } catch (error) {
        console.error('Failed to update sort order:', error);
        message.error('保存文件排序失败，请重试');
    }
};

// 下载文件
const downloadFile = async (url: string, fileName: string) => {
    try {
        const headers: Record<string, string> = {};

        // 如果有密码，则添加 Authorization 头
        if (props.currentPassword) {
            headers['Authorization'] = `Basic ${btoa('admin:' + props.currentPassword)}`;
        }

        const response = await axios.get(url, {
            responseType: 'blob', // 获取文件为 Blob 格式
            headers,
        });

        const blobUrl = URL.createObjectURL(response.data);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Error downloading file:', error);
    }
};
</script>

<template>
    <div>
        <div v-if="localOtherFiles.length > 0" style="text-align: left; margin-top: 30px;">文件列表</div>
        <div class="other-files">
            <div v-for="(file, index) in localOtherFiles" :key="file.url" class="file-wrapper" draggable="true"
                @dragstart="handleDragStart(index)" @dragover="handleDragOver" @drop="handleDrop($event, index)"
                @click="isSelectMode ? handleSelectFile(file.url, !selectedFiles.has(file.url), index) : null">
                <div class="file-container"
                    :style="{ borderColor: file.tag?.color === '#ffffff' ? 'rgba(0, 0, 0, 0)' : file.tag?.color, 'border-width': '3px' }">
                    <Checkbox v-if="isSelectMode"
                        @change="(e: any) => handleSelectFile(file.url, e.target.checked, index)" class="file-checkbox"
                        :checked="selectedFiles.has(file.url)" />
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <FileOutlined class="file-icon" />
                        <div>{{ file.fileSize }}</div>
                    </div>

                    <template v-if="file.name.endsWith('.pdf')">
                        <a v-if="file.tag?.havePassword || currentPassword === undefined" style="color: #1677ff"
                            :href="file.url" target="_blank">
                            预览文件
                        </a>
                        <template v-else>
                            <a style="color: #1677ff" @click.prevent="downloadFile(file.url, file.name)">
                                <div>
                                    预览文件
                                </div>
                            </a>
                        </template>
                    </template>

                    <a v-if="file.tag?.havePassword || currentPassword === undefined" style="color: #1677ff"
                        :href="file.url" target="_blank">
                        下载
                    </a>
                    <template v-else>
                        <a style="color: #1677ff" @click.prevent="downloadFile(file.url, file.name)">
                            <div>
                                下载
                            </div>
                        </a>
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

<style scoped></style>