import path from 'path';
import fs from 'fs';
import { tagsFilePath } from './vite-upload-plugin';

const __dirname = path.resolve(); // 计算 __dirname
const directory = path.join(__dirname, './images');

// 读取并解析 tags.json 文件
const readTagsFile = () => {
    if (fs.existsSync(tagsFilePath)) {
        const data = fs.readFileSync(tagsFilePath, 'utf-8');
        return JSON.parse(data);
    } else {
        return { lock: [] }; // 如果文件不存在，返回空的 lock 数组
    }
};

// 将更新后的数据写入 tags.json 文件
const writeTagsFile = (tagsData) => {
    fs.writeFileSync(tagsFilePath, JSON.stringify(tagsData, null, 2));
};

// 1. 设置密码
export const setPassword = (filePaths, password) => {
    let tagsData = readTagsFile();

    filePaths.forEach(filePath => {
        const fullPath = path.join(directory, filePath);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File ${filePath} does not exist`);
        }

        // 查找是否已有该文件路径的记录
        let lockEntry = tagsData.lock.find(entry => entry.files.includes(filePath));

        if (!filePath.startsWith('/')) {
            filePath = '/' + filePath;
        }

        if (lockEntry) {
            // 更新密码
            lockEntry.password = password;
            lockEntry.files.push(filePath);
        } else {
            // 如果没有记录，添加新条目
            tagsData.lock.push({
                files: [filePath],
                password: password
            });
        }

        console.log(`Password set for ${filePath}`);
    });

    // 更新 tags.json 文件
    writeTagsFile(tagsData);
};

// 2. 去除密码
export const removePassword = (filePaths) => {
    let tagsData = readTagsFile();

    filePaths.forEach(filePath => {
        const fullPath = path.join(directory, filePath);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File ${filePath} does not exist`);
        }

        // 从 tagsData.lock 中删除该文件路径
        tagsData.lock = tagsData.lock.filter(entry => !entry.files.includes(filePath));

        console.log(`Password removed for ${filePath}`);
    });

    // 更新 tags.json 文件
    writeTagsFile(tagsData);
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