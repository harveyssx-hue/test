import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Simple directory/file copy helper
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const copyAssetsPlugin = () => ({
  name: 'copy-assets-plugin',
  closeBundle() {
    console.log('Copying dynamic assets to dist...');
    copyDir(resolve(__dirname, 'components'), resolve(__dirname, 'dist/components'));
    copyDir(resolve(__dirname, 'css'), resolve(__dirname, 'dist/css'));
    copyDir(resolve(__dirname, 'images'), resolve(__dirname, 'dist/images'));
    
    // Copy specific JS files
    fs.mkdirSync(resolve(__dirname, 'dist/js'), { recursive: true });
    fs.copyFileSync(resolve(__dirname, 'js/config.js'), resolve(__dirname, 'dist/js/config.js'));
    fs.copyFileSync(resolve(__dirname, 'js/crypto-helper.js'), resolve(__dirname, 'dist/js/crypto-helper.js'));
    
    // Copy admin pages controllers
    copyDir(resolve(__dirname, 'js/admin/pages'), resolve(__dirname, 'dist/js/admin/pages'));
  }
});

export default defineConfig({
  plugins: [copyAssetsPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9090',
        changeOrigin: true
      },
      '/admin-proxy': {
        target: 'http://127.0.0.1:9090',
        changeOrigin: true
      },
      '/upload-gcs': {
        target: 'http://127.0.0.1:9090',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        admin_login: resolve(__dirname, 'admin_login.html')
      }
    }
  }
});
