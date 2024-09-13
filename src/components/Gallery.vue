<script setup lang="ts">
import { defineProps, h, watch, ref } from 'vue';
import { Checkbox, Button as aButton, Image as aImage } from 'ant-design-vue';
import { DeleteOutlined } from '@ant-design/icons-vue';
import axios from 'axios';
import { copyText } from '../util';

// 定义文件类型
interface ImageItem {
    url: string;
    name: string;
    lastModified: number;
    fileSize: string;
    lastModifiedText?: string;
    tag?: { color: string, name: string, id: string };
}

const loadingPreview = ref<{ loading: boolean, value: string }>({ loading: false, value: '' });

const LoadPreview = (url: string) => {
    loadingPreview.value.loading = true;
    fetchImageWithAuth(url).then(res => loadingPreview.value.value = res);
}

// 定义组件接收的 props
const props = defineProps<{
    currentPassword?: string,
    imageUrls: ImageItem[];
    isSelectMode: boolean;
    isEditMode: boolean;
    selectedImages: Set<string>;
    handleSelectImage: (url: string, checked: boolean, index: number) => void;
    getThumbnailUrl: (url: string) => string;
    confirmDeleteImage: (name: string) => void;
}>();

const loadedImages = ref<Record<string, string>>({});

const fetchImageWithAuth = async (imageUrl: string) => {
    try {
        const headers: Record<string, string> = {};

        // 判断是否存在密码
        if (props.currentPassword) {
            headers['Authorization'] = `Basic ${btoa('admin:' + props.currentPassword)}`;
        }

        const response = await axios.get(imageUrl, {
            responseType: 'blob', // 获取图片为二进制数据
            headers, // 动态设置请求头
        });

        // 将 Blob 数据转换为本地 Blob URL
        const blobUrl = URL.createObjectURL(response.data);

        return blobUrl;
    } catch (error) {
        console.error('Error fetching image:', error);
    }

    return '';
};

// 在组件挂载时加载所有图片
// 监听 imageUrls 的变化
watch(() => props.imageUrls, async (newUrls) => {
    // 优化
    for (const item of newUrls) {
        if (!loadedImages.value[item.url]) {
            const url = props.getThumbnailUrl(item.url);
            const imageUrl = await fetchImageWithAuth(url);

            console.log('返回的值', imageUrl);
            loadedImages.value[item.url] = imageUrl;
        }
    }
}, { immediate: true });
</script>

<template>
    <div class="gallery">
        <a-image-preview-group>
            <div v-for="(item, index) in imageUrls" :key="item.url" class="image-wrapper"
                @click="(isSelectMode || isEditMode) ? handleSelectImage(item.url, !selectedImages.has(item.url), index) : null">
                <div class="image-container"
                    :style="{ borderColor: item.tag?.color === '#ffffff' ? '' : item.tag?.color }">
                    <Checkbox v-if="isSelectMode"
                    @change="(e: any) => handleSelectImage(item.url, e.target.checked, index)" class="image-checkbox"
                    :checked="selectedImages.has(item.url)" />

                <!-- 如果是选择模式，则显示缩略图，否则显示大图 -->
                <a-image @click="LoadPreview(item.url)" :src="loadedImages[item.url]" width="200px"
                    :preview="(isSelectMode || isEditMode) && loadingPreview.loading ? false : { src: loadingPreview.value }" />

                <a class="file-name" @click="copyText(item.url)" style="color: rgb(184 240 255)">文件分享</a>
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