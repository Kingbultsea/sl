<script setup lang="ts">
import { defineProps, h, watch, ref, onMounted, onBeforeUnmount } from 'vue';
import { Checkbox, Button as aButton, Image as aImage, ImagePreviewGroup } from 'ant-design-vue';
import { DeleteOutlined, ShareAltOutlined } from '@ant-design/icons-vue';
import axios from 'axios';
import { copyText } from '../util';

// 定义组件内的唯一 ID
const componentID = ref(""); // 生成唯一 ID
let observer = ref<IntersectionObserver | null>(null);
const InitialObserver = () => {
    if (observer.value !== null) {
        return;
    }
    observer.value = new IntersectionObserver(
        (entries) => {
            entries.forEach(async (entry: any) => {
                const className = entry.target.className;

                // 动态生成正则表达式，匹配 `${componentID}-value_*`
                const valueRegex = new RegExp(`${componentID.value}-value_([^\\s]+)`);
                const valueMatch = className.match(valueRegex);
                const src = valueMatch ? valueMatch[1] : null; // 提取动态 `src`

                if (entry.isIntersecting && src != null) {
                    if (!entry.target.getAttribute("src"))
                        entry.target.setAttribute("src", await fetchImageWithAuth(src));
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
    tag?: { color: string, name: string, id: string };
    close?: boolean;
}

const loadingPreview = ref<{ loading: boolean, value: string }>({ loading: false, value: '' });

const LoadPreview = (url: string) => {
    loadingPreview.value.loading = true;
    fetchImageWithAuth(url).then(res => {
        if (res) {
            // 获取第一个 .ant-image-preview-img 元素
            const previewImg = document.querySelector('.ant-image-preview-img');
            if (previewImg) {
                // 修改 src 属性为 res
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
    loading: 1 | 2 | 3;
}>();

const imageCache = new Map<string, string>(); // 用于存储缓存的图片

const fetchImageWithAuth = async (imageUrl: string): Promise<string> => {
    try {
        // 如果缓存中已经存在该图片的 Blob URL，则直接返回
        if (imageCache.has(imageUrl)) {
            return imageCache.get(imageUrl)!; // 使用非空断言，表示值肯定存在
        }

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

        // 将结果存入缓存
        imageCache.set(imageUrl, blobUrl);

        return blobUrl;
    } catch (error) {
        console.error('Error fetching image:', error);
    }

    return '';
};

// 添加一个方法，用于清除缓存（根据需要调用）
const clearImageCache = () => {
    imageCache.forEach((value) => {
        URL.revokeObjectURL(value); // 释放 Blob URL 占用的内存
    });
    imageCache.clear();
};

// 在组件挂载时加载所有图片
// 监听 imageUrls 的变化
watch(() => props.imageUrls, async (newUrls) => {
    InitialObserver();
    console.log(`新的: ${newUrls.length}`);
    // 优化
    setTimeout(() => {
        for (const [index, item] of newUrls.entries()) {
            // if (!loadedImages.value[item.url]) {
            //     const url = props.getThumbnailUrl(item.url);
            //     const imageUrl = await fetchImageWithAuth(url);
            //     const previewUrl = await fetchImageWithAuth(item.url);
            //     loadedImages.value[item.url] = { src: imageUrl, preview: previewUrl };
            //     activeList.value[index] = true;
            // }
            const element = document.querySelector(`.${componentID.value}-index_${index}`) || undefined;
            if (element)
                observer.value!.observe(element);
        }
    }, 500)
}, { immediate: true });

// watch(() => props.loading, () => {
//     console.log(props.loading, 'loading');
//     if (props.loading === 3) {
//         const wrappers = document.querySelectorAll('.' + componentID.value);
//         wrappers.forEach((wrapper) => observer.observe(wrapper));
//     }
// }, { immediate: true });

watch(currentPreviewIndex, (newIndex, oldIndex) => {
    console.log(`当前预览索引变化: 从 ${oldIndex} 到 ${newIndex}`);
    // 你可以在这里执行其他逻辑，例如根据索引变化加载数据
});

onMounted(() => {
    clearImageCache();
    console.log("初始化 InitialObserver");
    InitialObserver();
    componentID.value = `component-${Math.random().toString(36).substr(2, 9)}`;
});

onMounted(() => {
    if (observer) {
        observer.value!.disconnect();
    }
});

let handleArrowKey: (event: KeyboardEvent) => void; // 声明全局事件处理程序

onMounted(() => {
    // 注册键盘事件前，移除旧的事件处理程序（如果存在）
    if (handleArrowKey) {
        window.removeEventListener('keydown', handleArrowKey);
    }

    // 定义新的事件处理程序
    handleArrowKey = async (event: KeyboardEvent) => {

        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            setTimeout(async () => {
                const previewImg = document.querySelector('.ant-image-preview-img') as HTMLImageElement;

                if (previewImg) {
                    const currentSrc = previewImg.src;

                    // 检查 src 是否不是以 blob: 开头
                    if (currentSrc.startsWith('http')) {
                        console.log(`Fetching new image for src: ${currentSrc}`);

                        const newSrc = await fetchImageWithAuth(currentSrc);

                        if (newSrc) {
                            previewImg.src = newSrc;
                            console.log(`Updated image src: ${newSrc}`);
                        } else {
                            console.error('Failed to fetch new image source.');
                        }
                    }
                }
            }, 200); // 延迟 300ms 执行
        }
    };

    // 注册新的事件处理程序
    window.addEventListener('keydown', handleArrowKey);
});

onBeforeUnmount(() => {
    // 移除事件监听器，防止组件销毁后事件残留
    if (handleArrowKey) {
        window.removeEventListener('keydown', handleArrowKey);
    }
});

</script>

<template>
    <div class="gallery">
        <ImagePreviewGroup :preview="{ current: 1 }">
            <div v-for="(item, index) in imageUrls" :key="index" class="image-wrapper"
                @click="(isSelectMode || isEditMode) ? handleSelectImage(item.url, !selectedImages.has(item.url), index) : null">
                <div class="image-container"
                    :style="{ borderColor: item.tag?.color === '#ffffff' ? '' : item.tag?.color }">
                    <Checkbox v-if="isSelectMode"
                        @change="(e: any) => handleSelectImage(item.url, e.target.checked, index)"
                        class="image-checkbox" :checked="selectedImages.has(item.url)" />

                    <!-- 如果是选择模式，则显示缩略图，否则显示大图 -->
                    <!-- <a-image @click="LoadPreview(item.url)" :src="loadedImages[item.url]" width="200px"
                        :preview="(isSelectMode || isEditMode) && loadingPreview.loading ? false : { src: loadingPreview.value, onVisibleChange: onImageChange }" /> -->
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
                        <a-button type="link" danger :icon="h(DeleteOutlined)" @click="confirmDeleteImage(item.name)" />
                    </div>
                </div>
            </div>
        </ImagePreviewGroup>
    </div>
</template>

<style></style>