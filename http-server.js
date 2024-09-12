import http from 'http';
import httpServer from 'http-server';
import url from 'url';
import ip from 'ip';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import auth from 'http-auth'; // 添加 http-auth 依赖
import { getIp } from './server-tool';
import { isProtected } from './file-password';


const corsHeader = {
  'Access-Control-Allow-Origin': `http://${ip.address()}:3000`,
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

// 创建http-server实例，根目录设置为 ./images
const server = httpServer.createServer({
  root: './images',
  robots: true,
  headers: corsHeader,
  cache: -1 // 设置缓存为-1以实现`-c-1`效果
  // cache: 3600 // 这里设置为1小时的缓存时间，和上面的 Cache-Control 对应
});

// 创建普通的 HTTP 服务器
const protectedServer = http.createServer((req, res) => {
  let clientIp = getIp(req.headers['x-forwarded-for'] || req.connection.remoteAddress);

  console.log('Client IP:', clientIp); // 输出请求方的 IP 地址

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      ...corsHeader,
      'Access-Control-Max-Age': '31536000' // 设置预检请求的缓存时间为1年
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const isThumbnail = parsedUrl.query.thumbnail === 'true'; // 通过查询参数判断是否需要缩略图
  const decodedPathname = decodeURIComponent(parsedUrl.pathname); // 解码路径
  const password = isProtected(decodedPathname);

  if (password) {
    const basicAuth = auth.basic({
      realm: "Protected Area"
    }, (_, enteredPassword, callback) => {
      const authHeader = req.headers.authorization;

      // 手动解析 Base64 编码的 Authorization 头部
      // const base64Credentials = authHeader.split(' ')[1];
      // const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      // const [username, password] = credentials.split(':');

      console.log("用户输入的密码", enteredPassword, "tags上的密码: ", password, authHeader);

      // 验证输入的密码是否正确
      callback(enteredPassword === password);
    });

    // 需要进行身份验证
    basicAuth.check((reqAuth, resAuth) => {
      if (!reqAuth.headers.authorization) {
        console.log("没有验证头")
        // 如果没有提供验证信息，返回401并要求提供身份验证
        resAuth.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Protected"' });
        resAuth.end('Authorization required');
        return;
      }

      console.log("验证身份通过");

      // 成功通过身份验证后处理请求
      handleRequest(reqAuth, resAuth, isThumbnail, parsedUrl);
    })(req, res);
  } else {
    // 对于其他路径，不需要进行身份验证
    handleRequest(req, res, isThumbnail, parsedUrl);
  }
});

// 处理缩略图和其他请求
const handleRequest = (req, res, isThumbnail, parsedUrl) => {
  if (isThumbnail) {
    const width = parseInt(parsedUrl.query.width, 10) || 300;
    const height = parseInt(parsedUrl.query.height, 10) || 300;
    const imageFile = parsedUrl.pathname;
    const decodedImagePath = decodeURIComponent(imageFile);
    const imagePath = path.join(__dirname, 'images', decodedImagePath);

    if (fs.existsSync(imagePath)) {
      sharp(imagePath)
        .resize(width, height)
        .toBuffer()
        .then((data) => {
          res.writeHead(200, {
            'Content-Type': 'image/png',
            ...corsHeader
          });
          res.end(data);
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error generating thumbnail: ' + err.message);
        });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Image not found');
    }
  } else {
    // 非缩略图请求交由http-server处理
    server.server.emit('request', req, res);
  }
};

// 启动服务器
protectedServer.listen(8089, () => {
  console.log('Server is running on http://localhost:8089');
});