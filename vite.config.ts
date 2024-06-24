import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';
// @ts-ignores
import uploadPlugin from './vite-upload-plugin'; // 引入自定义插件
// @ts-ignore
import ip from 'ip';
// @ts-ignore
import path from 'path';

// @ts-ignore
process.env.VITE_IMAGE_BASE_URL = `http://${ip.address()}:8089`;

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: `http://${ip.address()}:3000`
  },
  resolve: {
    alias: {
      // @ts-ignore
      '@': path.resolve(__dirname, "./src")
    }
  },
  plugins: [vue(),uploadPlugin(), Components({
    resolvers: [
      AntDesignVueResolver({
        importStyle: false, // css in js
      }),
    ],
  })],
  define: {
    // @ts-ignore
    'process.env': process.env
  }
})
