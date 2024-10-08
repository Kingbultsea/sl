<script setup lang="ts">
import { ref, defineProps, h } from 'vue';
import { Checkbox, Button as aButton } from 'ant-design-vue';
import { FolderOutlined, EditOutlined, DeleteOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue';

// 定义组件接收的 props
interface Folder {
    url: string;
    name: string;
    tag?: { color: string, name: string, id: string, havePassword?: boolean };
}

const props = defineProps<{
    folderLinks: Folder[];
    isSelectMode: boolean;
    isEditMode: boolean;
    selectedFold: Set<string>;
    handleSelectFolds: (url: string, checked: boolean, index: number) => void;
    navigateToFolder: (folderName: string) => void;
    editFolderName: (folderName: string, index: number) => void;
    confirmDeleteFolder: (folderName: string, havePassword: boolean) => void;
}>();
</script>

<template>
    <!-- 文件夹 -->
    <div class="folders" v-if="folderLinks.length > 0">
        <div v-for="(folder, index) in folderLinks" :key="folder.url" class="folder-container"
            :style="{ borderColor: folder.tag?.color === '#ffffff' ? '' : folder.tag?.color }">
            <Checkbox v-if="isSelectMode" @change="(e: any) => handleSelectFolds(folder.url, e.target.checked, index)"
                class="image-checkbox" :checked="selectedFold.has(folder.url)" />

            <div style="display: flex; justify-content: space-between; padding: 1em;">
                <a @click.prevent="isSelectMode ? handleSelectFolds(folder.url, !selectedFold.has(folder.url), index) : navigateToFolder(folder.name)"
                    href="#">
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