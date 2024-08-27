import http from 'http';
import httpServer from 'http-server';
import url from 'url';
import ip from 'ip';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';

// 创建http-server实例，根目录设置为 ./images
const server = httpServer.createServer({
  root: './images',
  robots: true,
  headers: {
    'Access-Control-Allow-Origin': `http://${ip.address()}:3000`,
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'public, max-age=3600' // 设置缓存为1小时（3600秒）
  },
  // cache: -1 // 设置缓存为-1以实现`-c-1`效果
  cache: 3600 // 这里设置为1小时的缓存时间，和上面的 Cache-Control 对应
});

// 包装服务器以添加认证
const protectedServer = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': `http://${ip.address()}:3000`,
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const isThumbnail = parsedUrl.query.thumbnail === 'true'; // 通过查询参数判断是否需要缩略图

  // 如果提供了 image 参数，并且 thumbnail=true，则生成缩略图
  if (isThumbnail) {
    const width = parseInt(parsedUrl.query.width, 10) || 300; // 获取宽度参数，默认为100像素
    const height = parseInt(parsedUrl.query.height, 10) || 300; // 获取高度参数，默认为100像素

    const imageFile = parsedUrl.pathname; // 获取URL中的路径部分（不包括查询参数）

    // 还原 URL 编码（如 %20 -> 空格）
    const decodedImagePath = decodeURIComponent(imageFile);

    // 生成服务器上的文件路径
    const imagePath = path.join(__dirname, 'images', decodedImagePath);



    // 检查图像文件是否存在
    if (fs.existsSync(imagePath)) {
      // 使用 sharp 生成缩略图
      sharp(imagePath)
        .resize(width, height) // 根据提供的参数调整大小
        .toBuffer() // 转换为Buffer
        .then((data) => {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(data); // 返回缩略图
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error generating thumbnail: ' + err.message);
        });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Image not found');
    }
    return;
  }

  server.server.emit('request', req, res);
});

// 启动服务器
protectedServer.listen(8089, () => {
  console.log('Server is running on http://localhost:8089');
});
