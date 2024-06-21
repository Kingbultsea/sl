import http from 'http';
import httpServer from 'http-server';
import auth from 'http-auth';
import cookie from 'cookie';
import ip from 'ip';

// 设置用户认证
const basic = auth.basic({
  realm: "Protected Area",
}, (username, password, callback) => {
  // 在这里设置用户名和密码
  callback(username === "admin" && password === "password");
});

// 创建http-server实例，根目录设置为 ./images
const server = httpServer.createServer({
  root: './images',
  robots: true,
  headers: {
    'Access-Control-Allow-Origin': `http://${ip.address()}:3000`,
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    'Access-Control-Allow-Credentials': 'true'
  },
  cache: -1 // 设置缓存为-1以实现`-c-1`效果
});

// 包装服务器以添加认证
const protectedServer = http.createServer((req, res) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const isAuthenticated = cookies.authenticated === 'true';

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': `http://${ip.address()}:3000`,
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }

  if (req.url.startsWith('/check-auth')) {
    // 检查用户是否已经认证
    if (isAuthenticated) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': `http://${ip.address()}:3000`, 'Access-Control-Allow-Credentials': 'true' });
      res.end(JSON.stringify({ authenticated: true }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': `http://${ip.address()}:3000`, 'Access-Control-Allow-Credentials': 'false' });
      res.end(JSON.stringify({ authenticated: false }));
    }
    return;
  }

  // if (req.url.startsWith('/protected')) {
  //   console.log("protected", req.url);
  //   // 保护 /protected 目录
  //   basic.check((req, res) => {
  //     server.server.emit('request', req, res);
  //   })(req, res);
  // } else {
  //   server.server.emit('request', req, res);
  // }

  if (req.url.startsWith('/protected')) {
    // 保护 /protected 目录
    basic.check((req, res, username, password) => {
        // console.log("验证成功");
        // res.writeHead(200, {
        //   'Set-Cookie': cookie.serialize('authenticated', 'true', {
        //     httpOnly: true,
        //     maxAge: 60 * 60 * 24, // 1 day
        //     path: '/',
        //     sameSite: 'Lax'
        //   }),
        //   'Access-Control-Allow-Origin': `http://${ip.address()}:3000`,
        //   'Access-Control-Allow-Credentials': 'true',
        //   'Content-Type': 'text/plain'
        // });
        // res.end('Authenticated');
        server.server.emit('request', req, res);
    })(req, res);
  } else {
    server.server.emit('request', req, res);
  }
});

// 启动服务器
protectedServer.listen(8089, () => {
  console.log('Server is running on http://localhost:8089');
});
