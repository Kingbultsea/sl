import path from 'path';
import fs from 'fs';
import { setAttribute, getAttributeSync, removeAttribute } from 'fs-xattr'
import { removeTrailingSlash } from './util.js';

const __dirname = path.resolve(); // 计算 __dirname
const directory = path.join(__dirname, './images');

// 1. 设置文件夹顺序
export const setSortOrder = (filePath, sortOrder) => {
    const fullPath = path.join(directory, filePath);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File ${filePath} does not exist`);
    }

    console.log("设置", fullPath, sortOrder);

    setAttribute(fullPath, "common.sortOrder", sortOrder);
};
