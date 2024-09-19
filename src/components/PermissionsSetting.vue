<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue';
import { Input, Button as aButton, Dropdown, Menu, message, Table, Modal } from 'ant-design-vue';
import axios from 'axios';

// 定义 IP 列表类型
interface Permission {
    ipList: string[];
}

// 定义权限对象类型
interface Permissions {
    [key: string]: Permission;
}

const permissions = ref<Permissions>({
    "0": { ipList: [] },
    "1": { ipList: [] },
    "2": { ipList: [] },
    "3": { ipList: [] },
    "4": { ipList: [] },
    "5": { ipList: [] },
});

const ipInput = ref<string>(''); // 输入的 IP 地址
const selectedLevel = ref<number>(0); // 选择的权限等级
const modalVisible = ref<boolean>(false); // 控制 Modal 的可见性

// 获取现有权限数据
const fetchPermissions = async (): Promise<void> => {
    try {
        const response = await axios.get('/get-permissions');
        permissions.value = response.data;
    } catch (error) {
        message.error('获取权限数据失败');
    }
};

const isValidIP = (ip: string): boolean => {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;
    return ipRegex.test(ip);
};


// 设置权限
const setPermission = async (): Promise<void> => {
    if (!ipInput.value) {
        message.error('请输入 IP 地址');
        return;
    }

    if (!ipInput.value) {
        message.error('请输入 IP 地址');
        return;
    }

    if (!isValidIP(ipInput.value)) {
        message.error('请输入有效的 IP 地址');
        return;
    }

    if (permissions.value[selectedLevel.value] === undefined) {
        permissions.value[selectedLevel.value] = { ipList: [ipInput.value] }
    }

    // 检查并移除 IP 在其他权限中的位置
    for (const level in permissions.value) {
        const index = permissions.value[level].ipList.indexOf(ipInput.value);

        console.log("寻找: ", index, ipInput.value, permissions.value[level].ipList);
        if (index > -1) {
            permissions.value[level].ipList.splice(index, 1);
        }
    }


    // 确保 IP 不重复
    if (!permissions.value[selectedLevel.value].ipList.includes(ipInput.value)) {
        permissions.value[selectedLevel.value].ipList.push(ipInput.value);
    }

    try {
        await axios.post('/set-permissions', permissions.value);
        message.success('权限设置成功');
        ipInput.value = ''; // 清空输入框
    } catch (error) {
        message.error('权限设置失败');
    }
};

const deletePermission = (ip: string, level: number) => {
    permissions.value[level].ipList = permissions.value[level].ipList.filter(item => item !== ip);

    axios.post('/set-permissions', permissions.value).then(() => {
        // 更新后可以在这里添加保存操作或其他逻辑，如发送请求
        message.success(`IP ${ip} 已被移除`);
    });
};

// 组件挂载时获取权限数据
onMounted(() => {
    fetchPermissions();
});

// 生成表格数据
const tableData = computed(() => {
    const data = [];
    for (const level in permissions.value) {
        const ipList = permissions.value[level].ipList;
        if (Array.isArray(ipList)) {
            for (const ip of ipList) {
                data.push({
                    ip,
                    level,
                });
            }
        }
    }
    return data;
});

// 表格列定义
const columns = [
    {
        title: 'IP 地址',
        dataIndex: 'ip',
        key: 'ip',
    },
    {
        title: '权限等级',
        dataIndex: 'level',
        key: 'level',
    },
    {
        title: '操作',
        key: 'action'
    }
];
</script>

<template>
    <div>
        <aButton @click="modalVisible = true" type="link">
            配置权限
        </aButton>

        <Modal v-model:visible="modalVisible" title="设置权限" :width="700" :footer="null">
            <div style="margin-top: 30px;display: flex;justify-content: space-between;">
                <div>
                    <Input v-model:value="ipInput" placeholder="输入 IP 地址" style="width: 200px; margin-right: 10px;" />
                    <a-select v-model:value="selectedLevel" placeholder="选择权限等级" style="width: 120px;">
                        <a-select-option v-for="level in 6" :key="level - 1" :value="level - 1">
                            权限等级 {{ level - 1 }}
                        </a-select-option>
                    </a-select>
                </div>
                <aButton type="primary" @click="setPermission">设置权限</aButton>
            </div>

            <!-- 展示 IP 和权限的表格 -->
            <a-table :columns="columns" :dataSource="tableData" rowKey="ip" style="margin-top: 10px;">
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'action'">
                        <a-button type="link" @click="deletePermission(record.ip, record.level)" danger>删除</a-button>
                    </template>
                </template>
            </a-table>
        </Modal>
    </div>
</template>

<style scoped>
/* 自定义样式 */
</style>