import http from 'http';
import { createServer as createHttpServer } from 'http-server';
import auth from 'http-auth';

// 设置用户认证
const basic = auth.basic({
  realm: "Protected Area",
}, (username, password, callback) => {
  // 在这里设置用户名和密码
  callback(username === "admin" && password === "password");
});

// 创建http服务器
const server = createHttpServer({
  root: process.cwd(),
  robots: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
  }
});

// 包装服务器以添加认证
const protectedServer = http.createServer((req, res) => {
  if (req.url.startsWith('/protected')) {
    // 保护 /protected 目录
    basic.check((req, res) => {
      server.emit('request', req, res);
    })(req, res);
  } else {
    server.emit('request', req, res);
  }
});

// 启动服务器
protectedServer.listen(8089, () => {
  console.log('Server is running on http://localhost:8089');
});
