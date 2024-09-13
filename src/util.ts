import { message } from 'ant-design-vue';

export const copyText = async (content: string) => {
    // 创建一个隐藏的 input 元素
    const input = document.createElement('input');
    input.setAttribute('value', content);
    document.body.appendChild(input);

    // 选中该文本
    input.select();
    input.setSelectionRange(0, 99999); // 对移动设备的兼容

    try {
        // 执行复制命令
        document.execCommand('copy');
        message.success('已成功复制分享链接');
    } catch (err) {
        console.error('复制失败:', err);
        message.error('复制失败');
    }

    // 移除临时 input 元素
    document.body.removeChild(input);
};