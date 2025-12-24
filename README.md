# 3DGS 预览工具

这是一个简单的 Web 前端应用，用于预览 3D Gaussian Splats (.ply) 文件。

## Demo

https://ml-sharp-viewer.stmtc.workers.dev/

## 功能
- 支持加载本地 .ply / .splat 文件
- 自动转换坐标系 (OpenCV -> Three.js)
- 支持旋转、平移、缩放交互
- 简单的 UI 界面

## 安装与运行

确保已安装 Node.js。

1. 安装依赖:
   ```bash
   npm install
   ```

2. 启动开发服务器:
   ```bash
   npm run dev
   ```

3. 打开浏览器访问显示的地址 (通常是 http://localhost:5173)。

## 构建部署

如果需要部署静态文件:
```bash
npm run build
```
构建产物将位于 `dist` 目录。

## 注意事项
- 工具假设输入的 PLY 文件遵循 OpenCV 坐标系 (x右, y下, z前)。
- 程序会自动绕 X 轴旋转 180 度以适配 Web 渲染器。
