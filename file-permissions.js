// 权限系统，数值越大等级越高
import path from 'path';
import fs from 'fs';
import { tagsFilePath } from './vite-upload-plugin';
import { setAttribute, getAttributeSync, removeAttribute } from 'fs-xattr'
import { removeTrailingSlash } from './util.js';

const __dirname = path.resolve(); // 计算 __dirname
const directory = path.join(__dirname, './images');

// 设置权限函数，数值越大等级越高
export const setPermissions = (filePaths, level) => {
    console.log("查看传递的path", filePaths);
    filePaths.forEach((filePath) => {
        const fullPath = path.join(directory, filePath);

        console.log("设置权限 ", fullPath, level);

        try {
            setAttribute(fullPath, 'user.permission', Buffer.from(level.toString())).then(() => {
                console.log("设置成功")
            }).catch((error) => {
                console.log("设置权限失败", error);
            });
        } catch (e) {
            console.log(e);
        }
    });
};

// 删除权限函数
export const removePermissions = (filePaths) => {
    filePaths.forEach((filePath) => {
        const fullPath = path.join(directory, filePath);

        removeAttribute(fullPath, 'user.permission', (err) => {
            if (err) {
                console.error(`Error removing permission for ${filePath}:`, err);
            } else {
                console.log(`Permission removed for ${filePath}`);
            }
        });
    });
};

// 查询是否有权限
// 查询 ./tags.json的 Permission字段，
// tags 长这样
// {
//     Permission: {
//         "0": {
//             ipList: []
//         }
//     }
// }

// 查询是否有权限
export const havePermission = (ip, decodedPathname) => {
    try {
        const fileLevel = queryLevel(decodedPathname); // 获取文件的权限等级

        if (fileLevel === 0) {
            return true; // 如果文件权限等级为 0，无需验证权限
        }

        // 读取 tags.json 文件
        const tags = JSON.parse(fs.readFileSync(tagsFilePath, 'utf-8'));

        // 检查是否有 Permission 字段，如果没有则添加
        if (!tags.Permission) {
            tags.Permission = {};
            fs.writeFileSync(tagsFilePath, JSON.stringify(tags, null, 2), 'utf-8');
            console.log('Permission field added to tags.json');
            return 0;
        }

        // 获取用户的权限等级（遍历查找IP所属的最大权限）
        let userLevel = 0;
        for (const level in tags.Permission) {
            const ipList = tags.Permission[level]?.ipList || [];
            if (ipList.includes(ip)) {
                userLevel = Math.max(userLevel, parseInt(level, 10));
            }
        }

        // 如果用户权限等级大于或等于文件的权限等级，返回 true
        if (userLevel >= fileLevel) {
            console.log(`IP ${ip} has sufficient permission: UserLevel=${userLevel}, FileLevel=${fileLevel}`);
            return true;
        } else {
            console.log(`IP ${ip} does not have sufficient permission: UserLevel=${userLevel}, FileLevel=${fileLevel}`);
            return false;
        }
    } catch (err) {
        // console.error('Error checking permission:', err);
        return false;
    }
};

// 检查文件或文件夹是否受到隐私保护
const queryLevel = (pathname) => {
    try {
        let currentPath = path.join(__dirname, 'images', pathname);  // 使用 __dirname 获取当前文件的绝对路径

        // 规范化路径，去除尾部斜杠
        currentPath = removeTrailingSlash(currentPath);

        // 逐步向上检查文件夹是否有 "user.password" 属性
        while (currentPath !== directory) {
            try {
                // 尝试获取扩展属性 "user.password"
                const permission = getAttributeSync(currentPath, 'user.permission');

                // 如果有 password 属性，返回其值
                if (permission) {
                    return +permission.toString();
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

    return 0; // 没有找到 password 属性时返回 null
};