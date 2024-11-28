<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Button as aButton, Modal, message } from 'ant-design-vue';
import axios from 'axios';

// 控制 Modal 的可见性
const modalVisible = ref<boolean>(false);

// 本地数据
const localTags = ref<{ name: string; id: string; commonSortOrder?: number }[]>([]);
const initialTags = ref<{ name: string; id: string; commonSortOrder?: number }[]>([]); // 保存初始数据

// 获取标签数据
const fetchTags = async () => {
    try {
        const response = await axios.get('/get-tags');
        const sortedTags = response.data.tags.sort((a: any, b: any) => {
            const orderA = a?.commonSortOrder ?? Number.MAX_SAFE_INTEGER; // 未定义的放最后
            const orderB = b?.commonSortOrder ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });

        localTags.value = [...sortedTags];
        initialTags.value = [...sortedTags]; // 保存初始数据
    } catch (error) {
        console.error('Failed to fetch tags:', error);
    }
};

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

    const draggedTag = localTags.value[dragIndex.value];
    localTags.value.splice(dragIndex.value, 1); // 移除拖拽的标签
    localTags.value.splice(targetIndex, 0, draggedTag); // 插入到目标位置

    // 更新排序值
    localTags.value.forEach((tag, index) => {
        tag.commonSortOrder = index;
    });
};

// 调用后端接口保存排序
const saveSortOrder = async () => {
    const tags = localTags.value.map((tag) => ({
        id: tag.id,
        commonSortOrder: tag.commonSortOrder,
    }));

    try {
        const response = await axios.post('/config-tag', { tags });
        console.log('Sort order updated successfully:', response.data);
        message.success({
            content: '标签排序已保存',
            duration: 1, // 持续时间，单位为秒
        }).then(() => {
            window.location.reload();
        });

        modalVisible.value = false;
    } catch (error) {
        console.error('Failed to update sort order:', error);
        message.error('保存标签排序失败，请找开发人员');
    }
};

// 恢复初始排序
const resetSortOrder = () => {
    localTags.value = [...initialTags.value];
    modalVisible.value = false;
};

// 阻止默认的拖放行为
const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
};

// 初始化数据
onMounted(() => {
    fetchTags();
});
</script>

<template>
    <div>
        <aButton @click="modalVisible = true" type="link">
            标签排序
        </aButton>

        <Modal v-model:visible="modalVisible" title="标签排序" :width="700" :footer="null">
            <div class="tag-list">
                <div v-for="(tag, index) in localTags" :key="tag.id" class="tag-item" draggable="true"
                    @dragstart="handleDragStart(index)" @dragover="handleDragOver" @drop="handleDrop($event, index)">
                    <span class="tag-name">{{ tag.id === "0" ? "默认" : tag.name }}</span>
                </div>
            </div>
            <div class="modal-footer">
                <aButton type="primary" @click="saveSortOrder" style="margin-right: 10px;">确定</aButton>
                <aButton @click="resetSortOrder">取消</aButton>
            </div>
        </Modal>
    </div>
</template>

<style scoped>
/* 自定义样式 */
.tag-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #f0f0f0;
    padding: 8px;
    background-color: #fff;
    border-radius: 4px;
}

.tag-item {
    padding: 8px 12px;

    border-radius: 4px;
    margin-bottom: 8px;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.tag-item:hover {
    background-color: #f5f5f5;
}

.tag-name {
    font-size: 14px;
    color: #333;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
}
</style>