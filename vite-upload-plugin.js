import express from 'express';
import multer from 'multer';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs';
import "./http-server";

const __dirname = path.resolve(); // 计算 __dirname
const maxBuffer = 1024 * 1024 * 300; // 设置缓冲区大小为 300MB

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
    console.log('接受文件', fullPath);
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

        console.log('Files:', req.files); // 打印上传的文件信息
        console.log('Body:', req.body); // 打印请求体信息
        res.send('Files uploaded successfully');
      });

      // 创建文件夹处理
      app.post('/create-folder', (req, res) => {
        const folderPath = req.body.folderPath;
        if (!folderPath) {
          return res.status(400).send('Folder path is required');
        }

        const fullPath = path.join(__dirname, './images', folderPath);
        console.log('创建文件夹', fullPath);

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

        console.log('修改文件夹名称', oldPath, '到', newPath);

        try {
          fs.renameSync(oldPath, newPath);
          res.send('Folder name edited successfully');
        } catch (error) {
          console.error('Error editing folder name:', error);
          res.status(500).send('Error editing folder name');
        }
      });

      // 删除文件夹处理
      app.post('/delete-folder', (req, res) => {
        const folderPath = req.body.folderPath;
        if (!folderPath) {
          return res.status(400).send('Folder path is required');
        }

        const fullPath = path.join(__dirname, './images', folderPath);
        console.log('删除文件夹', fullPath);

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
          console.log('删除文件', fullPath);

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
