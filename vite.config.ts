import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        base: '/lotto/',
        server: {
            port: 3000,
            host: '0.0.0.0',
            mimeTypes: {
                'js': 'text/javascript',
                'jsx': 'text/javascript',
                'mjs': 'text/javascript',
                'ts': 'text/javascript',
                'tsx': 'text/javascript' // 补充tsx的MIME类型（解决残留问题）
            },
            // 新增：配置WebSocket适配远程访问
            hmr: {
                clientPort: 80 // 对应Nginx监听的80端口，让WebSocket请求走Nginx代理
            }
        },
        plugins: [react()],
        define: {
          'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
          'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            }
        }
    };
});