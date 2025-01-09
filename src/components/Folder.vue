<script setup lang="ts">
import { ref, defineProps, h, watch, defineEmits } from 'vue';
import { Checkbox, Button as aButton, Modal, message } from 'ant-design-vue';
import { FolderOutlined, EditOutlined, DeleteOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue';
import axios from 'axios';

// 定义组件接收的 props
interface Folder {
    url: string;
    name: string;
    tag?: { color: string, name: string, id: string, havePassword?: boolean, commonSortOrder?: number };
}

const props = defineProps<{
    folderLinks: Folder[];
    isSelectMode: boolean;
    isEditMode: boolean;
    selectedFold: Set<string>;
    handleSelectFolds: (url: string, checked: boolean, index: number) => void;
    navigateToFolder: (folderName: string, useRouter?: boolean) => string;
    editFolderName: (folderName: string, index: number) => void;
    confirmDeleteFolder: (folderName: string, havePassword: boolean) => void;
}>();

const emit = defineEmits(['update-folder-links']); // 定义事件

// 本地副本
const localFolderLinks = ref<Folder[]>([...props.folderLinks]);

// 监听 props 更新本地副本
watch(
    () => props.folderLinks,
    (newLinks) => {
        localFolderLinks.value = [...newLinks].sort((a, b) => {
            const orderA = a.tag?.commonSortOrder ?? Number.MAX_SAFE_INTEGER; // 未定义的放最后
            const orderB = b.tag?.commonSortOrder ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });
    },
    { immediate: true }
);

// 拖拽相关
const dragIndex = ref<number | null>(null); // 当前拖拽的索引

// 处理拖拽开始
const handleDragStart = (index: number) => {
    dragIndex.value = index;
};

// 处理拖拽结束
const handleDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault(); // 阻止默认行为
    if (dragIndex.value === null) return;

    // 提示用户是否确认排序更改
    Modal.confirm({
        title: '确认更改',
        content: `是否更改"${localFolderLinks.value[dragIndex.value].name}"文件夹的位置顺序?`,
        onOk() {
            // 用户确认后更新排序
            const draggedItem = localFolderLinks.value[dragIndex.value!];
            localFolderLinks.value.splice(dragIndex.value!, 1); // 移除拖拽的项
            localFolderLinks.value.splice(targetIndex, 0, draggedItem); // 插入到目标位置

            dragIndex.value = null; // 重置拖拽索引

            // 通知父组件更新
            emit('update-folder-links', [...localFolderLinks.value]);
            saveSortOrder();
        },
        onCancel() {
            // 用户取消后重置拖拽索引
            dragIndex.value = null;
            message.info('Sort order change cancelled.');
        },
    });
};

// 调用后端接口
const saveSortOrder = async () => {
    const files = localFolderLinks.value.map((item, index) => {
        return {
            path: item.url.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''),
            sortOrder: "" + index,
        }
    });

    try {
        const response = await axios.post('/set-tag-sort', { files });
        console.log('Sort order updated successfully:', response.data);
    } catch (error) {
        console.error('Failed to update sort order:', error);
    }
};

// 阻止默认的拖放行为
const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
};
</script>

<template>
    <!-- 文件夹 -->
    <div class="folders" v-if="localFolderLinks.length > 0">
        <div v-for="(folder, index) in localFolderLinks" :key="index" class="folder-container" draggable="true"
            @dragstart="handleDragStart(index)" @dragover="handleDragOver" @drop="handleDrop($event, index)"
            :style="{ borderColor: folder.tag?.color === '#ffffff' ? 'rgba(0,0,0,0)' : folder.tag?.color, 'border-width': '3px' }">
            <Checkbox v-if="isSelectMode" @change="(e: any) => handleSelectFolds(folder.url, e.target.checked, index)"
                class="image-checkbox" :checked="selectedFold.has(folder.url)" />

            <div style="display: flex; justify-content: space-between; padding: 1em;">
                <a @click.prevent="isSelectMode ? handleSelectFolds(folder.url, !selectedFold.has(folder.url), index) : navigateToFolder(folder.name)"
                    :href="navigateToFolder(folder.name, false)">
                    <EyeInvisibleOutlined v-if="folder.tag?.havePassword" class="folder-icon folder-icon-lock" />
                    <FolderOutlined v-else class="folder-icon" />
                    <span class="folder-name">{{ folder.name }}</span>
                </a>
                <div>
                    <a-button v-if="isEditMode" type="link" :icon="h(EditOutlined)"
                        @click="editFolderName(folder.name, index)" />
                    <a-button v-if="isEditMode" type="link" danger :icon="h(DeleteOutlined)"
                        @click="confirmDeleteFolder(folder.name, folder.tag?.havePassword || false)" />
                </div>
            </div>
        </div>
    </div>
</template>