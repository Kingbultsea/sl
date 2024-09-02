import express from 'express';
import multer from 'multer';
import path from 'path';
import { exec } from 'child_process';
import fg from 'fast-glob';
import fs from 'fs';
import "./http-server";
import { setAttribute, getAttributeSync, removeAttribute } from 'fs-xattr'

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

// 文件过滤功能，只接受图片类型的文件
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images are allowed'));
  }
};

const upload = multer({
  storage: storage,
  // fileFilter: fileFilter
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
        req.files.forEach(file => {
          const decodedFileName = decodeURIComponent(file.originalname);
          const filePath = path.join(file.destination, decodedFileName);
          fs.renameSync(file.path, filePath); // 重命名文件以确保文件名正确
        });

        // console.log('Files:', req.files); // 打印上传的文件信息
        // console.log('Body:', req.body); // 打印请求体信息
        res.send('Files uploaded successfully');
      });

      // 创建文件夹处理
      app.post('/create-folder', (req, res) => {
        const folderPath = req.body.folderPath;
        if (!folderPath) {
          return res.status(400).send('Folder path is required');
        }

        const fullPath = path.join(__dirname, './images', folderPath);
        // console.log('创建文件夹', fullPath);

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

        // console.log('修改文件夹名称', oldPath, '到', newPath);

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
        if (!newTag || !newTag.id || !newTag.name || !newTag.color) {
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

      // 设置标签，利用setAttribute，数值需要传递，对应tags.json 如果id为0 则为删除标签
      app.post('/set-tags', async (req, res) => {
        const { files } = req.body; // files 是一个包含多个文件路径和标签的数组

        if (!Array.isArray(files) || files.length === 0) {
          return res.status(400).send('Invalid files data');
        }

        try {
          for (const { path: filePath, tag } of files) {
            if (!filePath || !tag || !tag.id || !tag.name || !tag.color) {
              return res.status(400).send(`Invalid tag data or file path for file: ${filePath}`);
            }

            const formatPath = path.join(directory, filePath);
            console.log(formatPath);

            // 0 为删除标签
            if (tag.id === "0") {
              removeAttribute(formatPath, 'tag.id');
              removeAttribute(formatPath, 'tag.name');
              removeAttribute(formatPath, 'tag.color');
            } else {
              // 使用 fs-xattr 设置每个文件的扩展属性
              await setAttribute(formatPath, 'tag.id', tag.id);
              await setAttribute(formatPath, 'tag.name', tag.name);
              await setAttribute(formatPath, 'tag.color', tag.color);
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


            const tagId = getAttributeSync(formatPath, 'tag.id').toString();
            const tagName = getAttributeSync(formatPath, 'tag.name').toString();
            const tagColor = getAttributeSync(formatPath, 'tag.color').toString();

            if (tagsData.find(tag => tag.id === tagId)) {
              return {
                id: tagId,
                name: tagName,
                color: tagColor,
              };
            } else {
              removeAttribute(formatPath, 'tag.id');
              removeAttribute(formatPath, 'tag.name');
              removeAttribute(formatPath, 'tag.color');

              return {};
            }
          } catch (err) {
            console.error(`Error retrieving tags for ${filePath}:`, err.message);
            return {}; // 如果出现错误（例如没有找到标签），返回空对象
          }
        });

        res.json(results);
      });


      // 删除文件夹处理
      app.post('/delete-folder', (req, res) => {
        const folderPath = req.body.folderPath;
        if (!folderPath) {
          return res.status(400).send('Folder path is required');
        }

        const fullPath = path.join(__dirname, './images', folderPath);
        // console.log('删除文件夹', fullPath);

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

      server.middlewares.use(app);
    }
  };
}
