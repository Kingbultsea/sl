import path from 'path';
import fs from 'fs';
import { tagsFilePath } from './vite-upload-plugin';
import { setAttribute, getAttributeSync, removeAttribute } from 'fs-xattr'

const __dirname = path.resolve(); // 计算 __dirname
const directory = path.join(__dirname, './images');

// 1. 设置密码
export const setPassword = (filePaths, password) => {
    filePaths.forEach(filePath => {
        const fullPath = path.join(directory, filePath);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File ${filePath} does not exist`);
        }

        setAttribute(fullPath, "user.password", password);
    });
};

// 2. 去除密码
export const removePassword = (filePaths) => {
    filePaths.forEach(filePath => {
        const fullPath = path.join(directory, filePath);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File ${filePath} does not exist`);
        }

        removeAttribute(fullPath, "user.password");
    });
};

// 去除路径末尾的斜杠（如果有）
const removeTrailingSlash = (p) => p.endsWith(path.sep) ? p.slice(0, -1) : p;

// 检查文件或文件夹是否受保护
export
    const isProtected = (pathname) => {
        try {
            let currentPath = path.join(__dirname, 'images', pathname);  // 使用 __dirname 获取当前文件的绝对路径
            // 规范化路径，去除尾部斜杠
            currentPath = removeTrailingSlash(currentPath);

            // 逐步向上检查文件夹是否有 "user.password" 属性
            while (currentPath !== directory) {
                try {
                    // 尝试获取扩展属性 "user.password"
                    const password = getAttributeSync(currentPath, 'user.password');

                    // 如果有 password 属性，返回其值
                    if (password) {
                        return password.toString(); // 将 Buffer 转换为字符串
                    }
                } catch (err) {
                    // 当前路径没有设置 user.password，继续向上检查父目录
                }

                // 继续检查上一级目录
                currentPath = path.dirname(currentPath);
            }

        } catch (err) {
            console.error(`Error reading extended attributes for ${pathname}: ${err.message}`);
        }

        return null; // 没有找到 password 属性时返回 null
    };