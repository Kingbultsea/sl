import http from 'http';
import httpServer from 'http-server';
import url from 'url';
import ip from 'ip';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import net from 'net';
import auth from 'http-auth'; // 添加 http-auth 依赖
import { getAttributeSync } from 'fs-xattr';

// 读取并解析 tags.json 文件
const tags = JSON.parse(fs.readFileSync('./tags.json', 'utf8'));

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

// 判断路径是否为文件夹
const isDirectory = (dirPath) => {
  try {
    // 将 ./images 和传入的路径合并
    const normalizedPath = path.join('./images', dirPath);

    const stats = fs.statSync(normalizedPath);
    return stats.isDirectory(); // 如果是文件夹则返回 true
  } catch (err) {
    console.error(`Error checking path: ${err.message}`);
    return false; // 如果路径不存在或其他错误，返回 false
  }
};

// 检查文件或文件夹是否受保护
const isProtected = (pathname) => {
  const { lock } = tags;
  for (const entry of lock) {
    // 检查是否是受保护的文件
    if (entry.files.includes(pathname)) {
      return entry.password;
    }

    console.log('查看查询的pathname', pathname, isDirectory(pathname), pathname.startsWith(entry.files), entry.files);

    // 检查是否是受保护的文件夹
    if (isDirectory(pathname) && pathname.startsWith(entry.files)) {
      return entry.password;
    }
  }
  return null;
};

const getIp = (ip) => {
  // 检查是否为 IPv6 映射的 IPv4 地址
  if (net.isIPv4(ip)) {
    console.log('Client IP (IPv4):', ip);
  } else if (net.isIPv6(ip) && ip.includes('::ffff:')) {
    ip = ip.split('::ffff:')[1]; // 提取 IPv4 部分
    console.log('Client IP (mapped IPv4):', ip);
  } else {
    console.log('Client IP (IPv6):', ip);
  }

  return ip;
};

// 创建普通的 HTTP 服务器
const protectedServer = http.createServer((req, res) => {
  let clientIp = getIp(req.headers['x-forwarded-for'] || req.connection.remoteAddress);

  console.log('Client IP:', clientIp); // 输出请求方的 IP 地址

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeader);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const isThumbnail = parsedUrl.query.thumbnail === 'true'; // 通过查询参数判断是否需要缩略图
  const decodedPathname = decodeURIComponent(parsedUrl.pathname); // 解码路径
  const password = isProtected(decodedPathname);

  // todo 根据tags.json的lock，如果是文件夹，即末尾是/，则用startsWith，如果是文件，则直接判断是不是同一个文件路径，
  // 如果判断到是，则需要验证，而且password需要一致
  if (password) {
    const basicAuth = auth.basic({
      realm: "Protected Area"
    }, (_, enteredPassword, callback) => {
      const authHeader = req.headers.authorization;

      // 手动解析 Base64 编码的 Authorization 头部
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [username, password] = credentials.split(':');

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