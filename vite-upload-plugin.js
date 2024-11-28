import express from 'express';
import multer from 'multer';
import path from 'path';
import { exec } from 'child_process';
import fg from 'fast-glob';
import fs from 'fs';
import "./http-server";
import { setAttribute, getAttributeSync, removeAttribute } from 'fs-xattr'
import { setPassword, removePassword } from './file-password.js';
import { getIp } from './server-tool.js';
import { setPermissions } from './file-permissions.js'
import { setSortOrder } from './file-common.js'
import { Worker } from 'worker_threads';

const __dirname = path.resolve(); // 计算 __dirname
const directory = path.join(__dirname, './images');
const maxBuffer = 1024 * 1024 * 300; // 设置缓冲区大小为 300MB
const tagsFilePath = path.join(__dirname, './tags.json');

// 定义图片类型的扩展名
const imageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

const parseTimeStampFormat2 = (timestamp) => {
  // 定义选项以进行日期和时间格式化
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false // 使用24小时制
  };

  // 使用 Intl.DateTimeFormat 进行格式化
  const formatter = new Intl.DateTimeFormat('zh-CN', options);

  // 将时间戳转换为 Date 对象
  const formattedDate = formatter.format(new Date(timestamp));

  // 输出结果
  return formattedDate;
}

// 确保目录存在
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 确保 ./images 目录存在
ensureDir(path.join(__dirname, './images'));

// 配置 multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = req.body.uploadPath || '';
    const fullPath = path.join(__dirname, './images', uploadPath);
    // console.log('接受文件', fullPath);
    ensureDir(fullPath); // 确保目录存在
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname;
    const filename = originalName || file.fieldname + '-' + Date.now() + path.extname(originalName);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage
});

export default function uploadPlugin() {
  return {
    name: 'vite:upload-plugin',
    configureServer(server) {
      const app = express();

      // 确保 ./images 目录存在
      ensureDir(path.join(__dirname, './images'));

      // 解析 multipart/form-data
      app.use(express.json()); // 解析 application/json
      app.use(express.urlencoded({ extended: true })); // 解析 application/x-www-form-urlencoded

      // 文件上传处理
      app.post('/upload', upload.array('files', 10), (req, res) => {
        // req.files.forEach(file => {
        //   const decodedFileName = decodeURIComponent(file.originalname);
        //   const filePath = path.join(file.destination, decodedFileName);
        //   fs.renameSync(file.path, filePath); // 重命名文件以确保文件名正确
        // });

        // // todo 如果重新上传，上了锁的文件，（文件级别，文件夹不用处理，有锁的就默认覆盖）


        // res.send('Files uploaded successfully');
        const uploadPath = path.join(__dirname, './images', req.body.uploadPath || '');

        const worker = new Worker(path.resolve(__dirname, './upload-worker.js'), {
          workerData: {
            files: req.files,
            uploadPath,
          },
        });

        worker.on('message', (message) => {
          if (message.success) {
            res.send(message.message);
          } else {
            res.status(500).send(message.message);
          }
        });

        worker.on('error', (error) => {
          console.error('Worker error:', error);
          res.status(500).send('Worker encountered an error');
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
            res.status(500).send('Worker stopped unexpectedly');
          }
        });
      });

      // 创建文件夹处理
      app.post('/create-folder', (req, res) => {
        const folderPath = req.body.folderPath;
        if (!folderPath) {
          return res.status(400).send('Folder path is required');
        }

        const fullPath = path.join(__dirname, './images', folderPath);

        try {
          ensureDir(fullPath);
          res.send('Folder created successfully');
        } catch (error) {
          console.error('Error creating folder:', error);
          res.status(500).send('Error creating folder');
        }
      });

      // 修改文件夹名称处理
      app.post('/edit-folder', (req, res) => {
        const { folderPath, name } = req.body;
        if (!folderPath || !name) {
          return res.status(400).send('Folder path and new name are required');
        }

        const oldPath = path.join(__dirname, './images', folderPath);
        const newPath = path.join(__dirname, './images', name);

        // todo 上了锁的文件夹，如果修改名字，需要把锁的名字也同时更改

        try {
          fs.renameSync(oldPath, newPath);
          res.send('Folder name edited successfully');
        } catch (error) {
          console.error('Error editing folder name:', error);
          res.status(500).send('Error editing folder name');
        }
      });

      // 创建标签
      app.post('/create-tag', (req, res) => {
        const newTag = req.body.tag;
        if (!newTag || !newTag.id || !newTag.name) {
          return res.status(400).send('Invalid tag data');
        }

        let tagsData = [];

        if (fs.existsSync(tagsFilePath)) {
          const data = fs.readFileSync(tagsFilePath);
          tagsData = JSON.parse(data);
        }

        tagsData.tags.push(newTag);

        fs.writeFileSync(tagsFilePath, JSON.stringify(tagsData, null, 2));
        res.send('Tag created successfully');
      });

      app.post('/config-tag', (req, res) => {
        const tagsList = req.body.tags;
        if (!tagsList) {
          return res.status(400).send('Invalid tag data');
        }

        let tagsData = [];

        if (fs.existsSync(tagsFilePath)) {
          const data = fs.readFileSync(tagsFilePath);
          tagsData = JSON.parse(data);
        }

        // tagsData.tags.push(newTag);
        // 更新现有标签数据
        tagsList.forEach((updatedTag) => {
          const existingTagIndex = tagsData.tags.findIndex(tag => tag.id === updatedTag.id);
          if (existingTagIndex !== -1) {
            // 如果标签已存在，更新其属性
            tagsData.tags[existingTagIndex].commonSortOrder = updatedTag.commonSortOrder;
          }
        });

        fs.writeFileSync(tagsFilePath, JSON.stringify(tagsData, null, 2));
        res.send('Tag created successfully');
      });

      // 删除标签
      app.post('/delete-tag', (req, res) => {
        const tagId = req.body.id;
        if (!tagId) {
          return res.status(400).send('Tag ID is required');
        }

        let tagsData = [];

        if (fs.existsSync(tagsFilePath)) {
          const data = fs.readFileSync(tagsFilePath);
          tagsData = JSON.parse(data);
        }

        const updatedTags = tagsData.filter(tag => tag.id !== tagId);

        fs.writeFileSync(tagsFilePath, JSON.stringify(updatedTags, null, 2));
        res.send('Tag deleted successfully');
      });

      // 读取标签
      app.get('/get-tags', (req, res) => {
        let tagsData = [];

        if (fs.existsSync(tagsFilePath)) {
          const data = fs.readFileSync(tagsFilePath);
          tagsData = JSON.parse(data);
        }

        res.json(tagsData);
      });

      // 设置文件显示的颜色
      app.post('/set-file-color', async (req, res) => {
        const { files } = req.body; // files 是一个包含多个文件路径和标签的数组

        if (!Array.isArray(files) || files.length === 0) {
          return res.status(400).send('Invalid files data');
        }

        console.log("设置标签颜色");

        try {
          for (const { path: filePath, tag } of files) {
            if (!filePath || !tag.color) {
              return res.status(400).send(`Invalid tag data or file path for file: ${filePath}`);
            }

            const formatPath = path.join(directory, filePath);

            await setAttribute(formatPath, 'tag.color', tag.color);
          }

          res.send('Tags Color set successfully for all files');
        } catch (err) {
          console.error('Error setting tags:', err);
          res.status(500).send('Failed to set tags');
        }
      })

      // 设置标签，利用setAttribute，数值需要传递，对应tags.json 如果id为0 则为删除标签
      app.post('/set-tags', async (req, res) => {
        const { files } = req.body; // files 是一个包含多个文件路径和标签的数组

        if (!Array.isArray(files) || files.length === 0) {
          return res.status(400).send('Invalid files data');
        }

        try {
          for (const { path: filePath, tag } of files) {
            if (!filePath || !tag || !tag.id) {
              return res.status(400).send(`Invalid tag data or file path for file: ${filePath}`);
            }

            const formatPath = path.join(directory, filePath);

            // 0 为删除标签
            if (tag.id === "0") {
              removeAttribute(formatPath, 'tag.id').catch(e => {
                console.log(e);
              });;
              // removeAttribute(formatPath, 'tag.name');
              // removeAttribute(formatPath, 'tag.color');
            } else {
              // 使用 fs-xattr 设置每个文件的扩展属性
              await setAttribute(formatPath, 'tag.id', tag.id);
              console.log("设置标签:", formatPath, tag.id);
            }
          }

          res.send('Tags set successfully for all files');
        } catch (err) {
          console.error('Error setting tags:', err);
          res.status(500).send('Failed to set tags');
        }
      });

      // 查询标签
      app.post('/get-tags-from-file', (req, res) => {
        const { paths } = req.body; // 从请求体中获取路径数组
        if (!Array.isArray(paths) || paths.length === 0) {
          return res.status(400).send('Invalid paths data');
        }

        // 读取并解析 tags.json 文件
        let tagsData = [];
        if (fs.existsSync(tagsFilePath)) {
          const data = fs.readFileSync(tagsFilePath, 'utf-8');
          try {
            tagsData = JSON.parse(data).tags;
          } catch (err) {
            console.error('Error parsing tags.json:', err.message);
            return res.status(500).send('Error reading tags data');
          }
        }

        // 查找每个路径的标签信息
        const results = paths.map(filePath => {
          try {
            const formatPath = path.join(directory, filePath);
            // console.log(formatPath);


            let tagId = "0"
            let tagColor = "#ffffff"
            let havePassword = false;
            let commonSortOrder = 0;
            let permission = 0;

            try {
              tagColor = getAttributeSync(formatPath, 'tag.color').toString();
            } catch {

            }

            try {
              tagId = getAttributeSync(formatPath, 'tag.id').toString();
            } catch {

            }

            try {
              commonSortOrder = +getAttributeSync(formatPath, 'common.sortOrder');
            } catch {

            }

            try {
              havePassword = getAttributeSync(formatPath, 'user.password').toString() ? true : false;
            } catch {

            }

            try {
              permission = getAttributeSync(formatPath, 'user.permission').toString();
            } catch { }

            // console.log("文件标签获取：", filePath, tagId, tagColor, havePassword);

            const orginTagData = tagsData.find(tag => tag.id === tagId);

            if (orginTagData) {
              return {
                id: orginTagData.id,
                name: orginTagData.name,
                color: tagColor, // orginTagData.color,
                havePassword, // 是否拥有密码
                commonSortOrder
              };
            } else {
              removeAttribute(formatPath, 'tag.id').catch(e => {
                console.log(e);
              });;
              // removeAttribute(formatPath, 'tag.name');
              // removeAttribute(formatPath, 'tag.color');

              return {};
            }
          } catch (err) {
            console.error(`Error retrieving tags for ${filePath}:`, err.message);
            return {}; // 如果出现错误（例如没有找到标签），返回空对象
          }
        });

        res.json(results);
      });

      // 设置文件的密码
      app.post('/set-password', (req, res) => {
        const { filePaths, password } = req.body;

        if (!Array.isArray(filePaths) || filePaths.length === 0 || !password) {
          return res.status(400).send('File paths and password are required');
        }

        try {
          setPassword(filePaths, password); // 为每个文件设置密码
          res.send('Passwords set successfully for all files');
        } catch (err) {
          console.error('Error setting password:', err.message);
          res.status(500).send('Failed to set password');
        }
      });

      // 去除文件密码
      app.post('/remove-password', (req, res) => {
        const { filePaths } = req.body;

        if (!Array.isArray(filePaths) || filePaths.length === 0) {
          return res.status(400).send('File paths are required');
        }

        try {
          removePassword(filePaths); // 为每个文件移除密码
          res.send('Passwords removed successfully for all files');
        } catch (err) {
          console.error('Error removing password:', err.message);
          res.status(500).send('Failed to remove password');
        }
      });


      // 删除文件夹处理
      app.post('/delete-folder', (req, res) => {
        const folderPath = req.body.folderPath;
        const password = req.body.password;


        console.log("删除文件", folderPath, password);

        if (!folderPath) {
          return res.status(400).send('Folder path is required');
        }

        const fullPath = path.join(__dirname, './images', folderPath);

        console.log("fullPath", fullPath);

        try {
          // 检查是否存在 user.password 扩展属性
          const tagPassword = getAttributeSync(fullPath, 'user.password').toString();

          console.log("目标密码", tagPassword);

          if (password !== tagPassword) {
            // 如果存在 user.password 属性，拒绝删除
            return res.status(403).send('Cannot delete protected folder');
          }
        } catch (err) {
          // 如果没有 user.password 属性，继续删除操作
          if (err.code !== 'ENOATTR') {
            // 如果发生其他错误，返回错误信息
            console.error('Error checking folder attributes:', err);
            return res.status(500).send('Error checking folder attributes');
          }
        }

        try {
          fs.rmdirSync(fullPath, { recursive: true });
          res.send('Folder deleted successfully');
        } catch (error) {
          console.error('Error deleting folder:', error);
          res.status(500).send('Error deleting folder');
        }
      });

      // 图片删除处理
      app.post('/delete-files', (req, res) => {
        const files = req.body.files;
        if (!files || !Array.isArray(files)) {
          return res.status(400).send('Files array is required');
        }

        const deletePromises = files.map(filePath => {
          const fullPath = path.join(__dirname, './images', filePath);
          // console.log('删除文件', fullPath);

          return new Promise((resolve, reject) => {
            fs.unlink(fullPath, (err) => {
              if (err) {
                console.error('Error deleting file:', err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        });

        Promise.all(deletePromises)
          .then(() => {
            res.send('Files deleted successfully');
          })
          .catch(error => {
            res.status(500).send('Error deleting files');
          });
      });

      // 文件搜索处理
      app.post('/search-files', async (req, res) => {
        const searchQuery = req.body.query;
        if (!searchQuery) {
          return res.status(400).send('Search query is required');
        }

        console.log('Search Query:', searchQuery);
        console.log('Search Directory:', directory);

        try {
          // 使用 fast-glob 搜索匹配的文件和文件夹
          const pattern = `**/*${searchQuery}*`; // 匹配模式
          const options = {
            cwd: directory, // 设置搜索的工作目录
            onlyFiles: false, // 搜索文件和文件夹
            absolute: true, // 返回绝对路径
          };

          // 使用 async/await 异步搜索
          const files = await fg(pattern, options);

          if (files.length === 0) {
            return res.status(404).send('No files or folders found');
          }

          console.log('Files found:', files);

          // 定义结果对象
          const results = {
            image: [],
            fold: [],
            other: []
          };

          // 获取文件详细信息，并按类型分类
          files.forEach(file => {
            const relativePath = path.relative(directory, file);
            const stats = fs.statSync(file); // 获取文件或文件夹的统计信息
            const ext = path.extname(file).toLowerCase(); // 获取文件扩展名

            const fileInfo = {
              url: process.env.VITE_IMAGE_BASE_URL + "/" + relativePath, // 相对路径
              name: path.basename(file), // 文件或文件夹的名称
              fileSize: stats.isDirectory() ? '' : `${stats.size} bytes`, // 文件大小（如果是文件夹则为空）
              lastModified: stats.mtime.getTime(), // 上次修改文件的时间
              lastModifiedText: parseTimeStampFormat2(stats.mtime.getTime()), //
            };

            if (stats.isDirectory()) {
              results.fold.push(fileInfo); // 添加到文件夹数组
            } else if (imageExtensions.includes(ext)) {
              results.image.push(fileInfo); // 添加到图片数组
            } else {
              results.other.push(fileInfo); // 添加到其他文件数组
            }
          });

          // 24-Jun-2024 09:32
          // 2024-06-24T01:32:55.930Z

          res.json(results);
        } catch (error) {
          console.error('Error searching files:', error);
          res.status(500).send('Error searching files');
        }
      });

      // 获取ip
      // 获取客户端IP的接口
      app.get('/get-ip', (req, res) => {
        const clientIp = getIp(req.headers['x-forwarded-for'] || req.connection.remoteAddress);

        let tagsData = [];

        if (fs.existsSync(tagsFilePath)) {
          const data = fs.readFileSync(tagsFilePath);
          tagsData = JSON.parse(data);
        }

        console.log("当前ip在白名单内,", tagsData.whiteIpList.includes(clientIp));

        res.json({ ip: clientIp, whiteIpList: tagsData.whiteIpList, isInWhiteList: tagsData.whiteIpList.includes(clientIp) });
      });

      // 设置文件或文件夹的权限
      app.post('/set-permission', (req, res) => {
        const { filePaths, level } = req.body;
        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0 || typeof level !== 'number') {
          return res.status(400).send('Invalid file paths or permission level');
        }

        try {
          setPermissions(filePaths, level); // 调用 setPermissions 函数为文件增加权限
          res.send('Permissions set successfully for all files');
        } catch (err) {
          console.error('Error setting permissions:', err.message);
          res.status(500).send('Failed to set permissions');
        }
      });

      app.post('/set-tag-sort', (req, res) => {
        const { files } = req.body;
        if (!files || !Array.isArray(files) || files.length === 0) {
          return res.status(400).send('Invalid file paths');
        }

        try {
          for (let i of files) {
            setSortOrder(i.path, i.sortOrder); // 调用 setPermissions 函数为文件增加权限
          }
          res.send('SortOrder set successfully for all files');
        } catch (err) {
          console.error('Error setting sortorder:', err.message);
          res.status(500).send('Failed to set sortorder');
        }
      });

      // todo 实现/get-permissions，即获取./tags.json的Permission字段
      // 获取权限数据
      app.get('/get-permissions', (req, res) => {
        try {
          if (fs.existsSync(tagsFilePath)) {
            const tagsData = JSON.parse(fs.readFileSync(tagsFilePath, 'utf-8'));
            res.json(tagsData.Permission || {});
          } else {
            res.json({});
          }
        } catch (err) {
          console.error('Error reading permissions:', err);
          res.status(500).send('Failed to get permissions');
        }
      });

      // todo 实现/set-permissions，即修改./tags.json的Permission字段
      // 设置权限数据
      app.post('/set-permissions', (req, res) => {
        const permissions = req.body;
        if (typeof permissions !== 'object') {
          return res.status(400).send('Invalid permissions data');
        }

        const clientIp = getIp(req.headers['x-forwarded-for'] || req.connection.remoteAddress);

        let tagsData = [];
        if (fs.existsSync(tagsFilePath)) {
          const data = fs.readFileSync(tagsFilePath);
          tagsData = JSON.parse(data);
        }
        console.log("当前ip在白名单内,", tagsData.whiteIpList.includes(clientIp));

        try {
          if (!tagsData.whiteIpList.includes(clientIp)) {
            throw new Error("没有权限")
          }

          tagsData.Permission = permissions; // 更新权限字段
          fs.writeFileSync(tagsFilePath, JSON.stringify(tagsData, null, 2), 'utf-8');
          res.send('Permissions updated successfully');
        } catch (err) {
          console.error('Error setting permissions:', err);
          res.status(500).send('Failed to set permissions');
        }
      });

      server.middlewares.use(app);
    }
  };
}
