import express from 'express';
import multer from 'multer';
import path from 'path';
import { exec } from 'child_process';
import fg from 'fast-glob';
import fs from 'fs';
import "./http-server";

const __dirname = path.resolve(); // 计算 __dirname
const directory = path.join(__dirname, './images');
const maxBuffer = 1024 * 1024 * 300; // 设置缓冲区大小为 300MB

// 定义图片类型的扩展名
const imageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

// 日期格式化函数
function formatDate(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}-${month}-${year} ${hours}:${minutes}`;
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

      // 高亮处理
      app.post('/highlight-folder', (req, res) => {
        const folderPath = req.body.folderPath;

        if (!folderPath) {

        }
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
              lastModifiedText: formatDate(stats.mtime), // 上次修改时间
              fileSize: stats.isDirectory() ? '' : `${stats.size} bytes`, // 文件大小（如果是文件夹则为空）
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

          console.log(results);

          res.json(results);
        } catch (error) {
          console.error('Error searching files:', error);
          res.status(500).send('Error searching files');
        }
      });

      server.middlewares.use(app);

      // 启动 http-server 服务
      // const httpServerCommand = 'http-server ./images -p 8089 --cors -c-1';
      // exec(httpServerCommand, { maxBuffer: maxBuffer }, (error, stdout, stderr) => {
      //   if (error) {
      //     console.error(`Error starting http-server: ${error}`);
      //     return;
      //   }
      //   console.log(`http-server output: ${stdout}`);
      //   if (stderr) {
      //     console.error(`http-server error output: ${stderr}`);
      //   }
      // });
    }
  };
}
