import { setAttribute, removeAttribute } from 'fs-xattr';
import path from 'path';
import fs from 'fs';
import { tagsFilePath } from './vite-upload-plugin';

const __dirname = path.resolve(); // 计算 __dirname
const directory = path.join(__dirname, './images');

// 1. 设置密码
export const setPassword = (filePath, password) => {
    const fullPath = path.join(directory, filePath);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File ${filePath} does not exist`);
    }

    // 使用扩展属性设置密码
    setAttribute(fullPath, 'user.password', password);
    console.log(`Password set for ${filePath}`);
};

// 2. 去除密码
export const removePassword = (filePath) => {
    const fullPath = path.join(directory, filePath);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File ${filePath} does not exist`);
    }

    // 删除扩展属性中的密码
    try {
        removeAttribute(fullPath, 'user.password');
        console.log(`Password removed for ${filePath}`);
    } catch (err) {
        console.error(`Error removing password: ${err.message}`);
    }
};

// 3. 获取被加密的文件路径
export const getEncryptedFiles = () => {
    const encryptedFiles = [];

    // 读取并解析 tags.json 文件
    if (fs.existsSync(tagsFilePath)) {
        const data = fs.readFileSync(tagsFilePath, 'utf-8');
        try {
            const tagsData = JSON.parse(data);

            // 遍历 lock 配置，提取文件和文件夹路径
            tagsData.lock.forEach((lockEntry) => {
                if (Array.isArray(lockEntry.files)) {
                    lockEntry.files.forEach((file) => {
                        encryptedFiles.push(file); // 添加文件/文件夹路径
                    });
                }
            });
        } catch (err) {
            console.error('Error parsing tags.json:', err.message);
            return [];
        }
    }

    return encryptedFiles;
};