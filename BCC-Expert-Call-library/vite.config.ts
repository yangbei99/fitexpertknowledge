import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // GitHub Pages 部署路径（生产环境使用仓库名作为 base）
      base: mode === 'production' ? '/fitexpertknowledge/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Supabase 配置通过 import.meta.env 自动加载 VITE_ 前缀的变量
        // 不再需要手动定义 Gemini API Key（已移至服务端）
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        // 优化打包
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            admin: path.resolve(__dirname, 'admin.html'),
          },
          output: {
            manualChunks: {
              'vendor': ['react', 'react-dom'],
              'supabase': ['@supabase/supabase-js'],
            }
          }
        }
      }
    };
});
