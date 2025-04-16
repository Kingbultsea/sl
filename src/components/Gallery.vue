<script setup lang="ts">
import { defineProps, h, watch, ref, onMounted, onBeforeUnmount } from 'vue';
import { Checkbox, Button as aButton, Image as aImage, ImagePreviewGroup, Modal, message } from 'ant-design-vue';
import { DeleteOutlined, ShareAltOutlined, EditOutlined } from '@ant-design/icons-vue';
import axios from 'axios';
import { copyText, getFileExtension, getFileBaseName } from '../util';
import { useSpinningStore } from '../stores/spinningStore';

const spinningStore = useSpinningStore();

// 定义组件内的唯一 ID
const componentID = ref(""); // 生成唯一 ID
let observer = ref<IntersectionObserver | null>(null);

// 本地副本，用于存储排序后的图片列表
const localImageUrls = ref<ImageItem[]>([]);

const InitialObserver = () => {
    if (observer.value !== null) {
        return;
    }
    observer.value = new IntersectionObserver(
        (entries) => {
            entries.forEach(async (entry: any) => {
                if (entry.isIntersecting) {
                    const className = entry.target.className;

                    // 动态生成正则表达式，匹配 `${componentID}-value_*`
                    const valueRegex = new RegExp(`${componentID.value}-value_([^\\s]+)`);
                    const valueMatch = className.match(valueRegex);
                    const src = valueMatch ? valueMatch[1] : null; // 提取动态 `src`

                    if (src)
                        fetchImageWithAuth(src).then(res => entry.target.setAttribute("src", res));
                }
            });
        },
        { root: null, threshold: 0.3 } // root 为视口，threshold 为可见区域比例
    );
};

// 定义文件类型
interface ImageItem {
    url: string;
    name: string;
    lastModified: number;
    fileSize: string;
    lastModifiedText?: string;
    tag?: { color: string, name: string, id: string, commonSortOrder?: number };
    close?: boolean;
}

const loadingPreview = ref<{ loading: boolean, value: string }>({ loading: false, value: '' });

const LoadPreview = (url: string) => {
    loadingPreview.value.loading = true;
    fetchImageWithAuth(url).then(res => {
        if (res) {
            const previewImg = document.querySelector('.ant-image-preview-img');
            if (previewImg) {
                (previewImg as HTMLImageElement).src = res;
            } else {
                console.warn('No .ant-image-preview-img element found in the DOM.');
            }
        } else {
            console.error('Failed to fetch image resource.');
        }
    });
};

const currentPreviewIndex = ref(0);

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
    editFolderName: (folderName: string, index: number, extend?: string) => void;
    loading: 1 | 2 | 3;
    sortOption: string;
}>();

// 本地排序逻辑
const sortImageUrls = () => {
    if (props.sortOption === "date-desc-false" || props.sortOption === "date-asc-false") {
        localImageUrls.value = [...props.imageUrls];
    } else {
        localImageUrls.value = [...props.imageUrls].sort((a, b) => {
            const orderA = a.tag?.commonSortOrder ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.tag?.commonSortOrder ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });
    }

    setTimeout(() => {
        for (const [index, item] of localImageUrls.value.entries()) {
            const element = document.querySelector(`.${componentID.value}-index_${index}`) || undefined;
            if (element) {
                // 先取消监听，避免重复监听
                observer.value!.unobserve(element);
                observer.value!.observe(element);
            }
        }
    }, 100)
};

// 监听 props.imageUrls 变化，重新排序
watch(() => props.imageUrls, sortImageUrls, { immediate: true, deep: true });

const imageCache = new Map<string, string>();

const fetchImageWithAuth = async (imageUrl: string): Promise<string> => {
    try {
        if (imageCache.has(imageUrl)) {
            return imageCache.get(imageUrl)!;
        }

        const headers: Record<string, string> = {};
        if (props.currentPassword) {
            headers['Authorization'] = `Basic ${btoa('admin:' + props.currentPassword)}`;
        }

        const response = await axios.get(imageUrl, {
            responseType: 'blob',
            headers,
        });

        const blobUrl = URL.createObjectURL(response.data);
        imageCache.set(imageUrl, blobUrl);

        return blobUrl;
    } catch (error) {
        console.error('Error fetching image:', error);
    }

    return '';
};

const clearImageCache = () => {
    imageCache.forEach((value) => {
        URL.revokeObjectURL(value);
    });
    imageCache.clear();
};

// 拖拽相关
const dragIndex = ref<number | null>(null);

const handleDragStart = (index: number) => {
    dragIndex.value = index;
};

const handleDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (dragIndex.value === null) return;

    Modal.confirm({
        title: '确认更改',
        content: `是否更改图片位置顺序?`,
        onOk() {
            const draggedImage = localImageUrls.value[dragIndex.value!];
            localImageUrls.value.splice(dragIndex.value!, 1);
            localImageUrls.value.splice(targetIndex, 0, draggedImage);

            localImageUrls.value.forEach((item, index) => {
                if (item.tag) {
                    item.tag.commonSortOrder = index;
                }
            });

            dragIndex.value = null;

            saveImageOrder();
        },
        onCancel() {
            dragIndex.value = null;
            message.info('排序更改已取消');
        },
    });
};

const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
};

// 保存排序的函数
const saveImageOrder = async () => {
    const updatedOrder = localImageUrls.value.map((item, index) => ({
        path: item.url.replace(/https?:\/\/[^\/:]+(:\d+)?\//, '').replace(/^\/+/, ''),
        sortOrder: `${index}`, // 转换为字符串
    }));

    try {
        const response = await axios.post('/set-tag-sort', { files: updatedOrder });
        message.success('图片排序已保存');
    } catch (error) {
        console.error('Failed to update sort order:', error);
        message.error('保存图片排序失败，请重试');
    }
};

// 初始化
onMounted(() => {
    clearImageCache();
    InitialObserver();
    componentID.value = `component-${Math.random().toString(36).substr(2, 9)}`;
});

onBeforeUnmount(() => {
    if (observer.value) {
        observer.value.disconnect();
    }
});
</script>

<template>
    <div class="gallery">
        <ImagePreviewGroup :preview="{ current: 1 }">
            <div v-for="(item, index) in localImageUrls" :key="item.name" class="image-wrapper" draggable="true"
                @dragstart="handleDragStart(index)" @dragover="handleDragOver" @drop="handleDrop($event, index)"
                @click="(isSelectMode || isEditMode) ? handleSelectImage(item.url, !selectedImages.has(item.url), index) : null">
                <div class="image-container"
                    :style="{ borderColor: item.tag?.color === '#ffffff' ? 'rgba(0,0,0,0)' : item.tag?.color, 'border-width': '3px' }">
                    <Checkbox v-if="isSelectMode"
                        @change="(e: any) => handleSelectImage(item.url, e.target.checked, index)"
                        class="image-checkbox" :checked="selectedImages.has(item.url)" />

                    <div style="height: 200px">
                        <a-image @click="LoadPreview(item.url)"
                            :class="`${componentID}-value_${props.getThumbnailUrl(item.url)} ${componentID}-index_${index} ${componentID}`"
                            :preview="{ src: item.url }" width="200px" />
                    </div>

                    <a class="file-name" @click="copyText(item.url)" style="color: rgb(184 240 255)">
                        <ShareAltOutlined style="padding-right: 4px;" />文件分享
                    </a>
                    <div class="image-name">{{ item.name }}</div>
                    <div class="image-name">{{ item.lastModifiedText }}</div>
                    <div v-if="isEditMode" class="delete-button">
                        <a-button v-if="isEditMode && spinningStore.isInWhiteList" type="link" :icon="h(EditOutlined)"
                            @click="editFolderName(getFileBaseName(item.name), index, getFileExtension(item.name))" />
                        <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteImage(item.name)" />
                    </div>
                </div>
            </div>
        </ImagePreviewGroup>
    </div>
</template>

<style>
/* Add any styles if necessary */
</style>