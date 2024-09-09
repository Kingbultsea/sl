<script setup lang="ts">
import { defineProps, h } from 'vue';
import { Checkbox, Button as aButton, Image as aImage } from 'ant-design-vue';
import { DeleteOutlined } from '@ant-design/icons-vue';

// 定义文件类型
interface ImageItem {
    url: string;
    name: string;
    lastModified: number;
    fileSize: string;
    lastModifiedText?: string;
    tag?: { color: string, name: string, id: string };
}

// 定义组件接收的 props
const props = defineProps<{
    imageUrls: ImageItem[];
    isSelectMode: boolean;
    isEditMode: boolean;
    selectedImages: Set<string>;
    handleSelectImage: (url: string, checked: boolean, index: number) => void;
    getThumbnailUrl: (url: string) => string;
    confirmDeleteImage: (name: string) => void;
}>();
</script>

<template>
    <div class="gallery">
        <a-image-preview-group>
            <div v-for="(item, index) in imageUrls" :key="item.url" class="image-wrapper"
                @click="(isSelectMode || isEditMode) ? handleSelectImage(item.url, !selectedImages.has(item.url), index) : null">
                <div class="image-container"  :class="{ 'high-line': item.tag?.id && item.tag?.id !== '0' }" :style="{ borderColor: item.tag?.color }">
                    <Checkbox v-if="isSelectMode"
                        @change="(e: any) => handleSelectImage(item.url, e.target.checked, index)"
                        class="image-checkbox" :checked="selectedImages.has(item.url)" />

                    <!-- 如果是选择模式，则显示缩略图，否则显示大图 -->
                    <a-image :src="getThumbnailUrl(item.url)" width="200px"
                        :preview="(isSelectMode || isEditMode) ? false : { src: item.url }" />

                    <div class="image-name">{{ item.name }}</div>
                    <div class="image-name">{{ item.lastModifiedText }}</div>
                    <div v-if="isEditMode" class="delete-button">
                        <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteImage(item.name)" />
                    </div>
                </div>
            </div>
        </a-image-preview-group>
    </div>
</template>