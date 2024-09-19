<script setup lang="ts">
import { defineProps, ref } from 'vue';
import { Dropdown, Button as aButton, Menu, message } from 'ant-design-vue';
import { DownOutlined } from '@ant-design/icons-vue';
import axios from 'axios';

// 定义接收的 props
const props = defineProps({
    filePaths: {
        type: Array as () => string[],
        required: true
    },
    onSuccess: Function // 添加回调函数作为 props
});

const selectedLevel = ref<number>(0); // 选中的权限等级

// 设置权限函数
const setFilePermissions = async () => {
    const filePaths = props.filePaths.map(filePath => filePath.replace(/https?:\/\/[^\/:]+(:\d+)?\//, ''));

    try {
        await axios.post('/set-permission', {
            filePaths,
            level: selectedLevel.value
        });
        console.log(`Permissions set to level ${selectedLevel.value}`);
        message.success("设置成功");

        // 调用回调函数
        if (typeof props.onSuccess === 'function') {
            props.onSuccess();
        }
    } catch (error) {
        console.error('Error setting permissions:', error);
        message.success("设置失败");
    }
};

// 菜单选项点击事件
const handleMenuClick = (e: any) => {
    selectedLevel.value = Number(e.key);
    setFilePermissions();
};
</script>

<template>
    <Dropdown>
        <template #overlay>
            <Menu @click="handleMenuClick">
                <Menu.Item v-for="level in 6" :key="level - 1">
                    权限等级 {{ level - 1 }}
                </Menu.Item>
            </Menu>
        </template>
        <aButton type="primary">
            设置权限
            <DownOutlined />
        </aButton>
    </Dropdown>
</template>

<style scoped>
/* 自定义样式 */
</style>