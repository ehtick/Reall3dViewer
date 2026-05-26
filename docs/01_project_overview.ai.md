# Project Overview
## 1. 项目定位
Reall3dViewer 是一款基于 Three.js 的开源 3D Gaussian Splatting（3DGS）Web 渲染器。专注于大规模场景流式渲染 + 自适应 LOD + 跨平台高性能优化，采用 MIT 协议发布，可免费商用。
GitHub: https://github.com/reall3d-com/Reall3dViewer
在线 Demo1: https://reall3d.com/reall3dviewer/examples/index.html?url=kcczt.scene.json&debug=true
在线 Demo2: https://reall3d.com/reall3dviewer/examples/index.html?url=hgd-lod-meta.scene.json&debug=true
npm: @reall3d/reall3dviewer

## 2. 核心目标
- 在浏览器中直接实现数亿级高斯点的流畅交互
- 在桌面端与移动端提供一致的渲染体验
- 提供开箱即用、轻量可嵌入的解决方案，无需额外插件
- 提供生产级工具链：测量、标注、水印、GIS 集成等

## 3. 技术栈
- 核心引擎: Three.js
- 自研技术: 自适应 LOD、视锥剔除、高效排序算法
- 自研格式: SPX（高压缩流式 3DGS 格式，相比 PLY 可减少 95%+ 体积）
- 语言: TypeScript / JavaScript

## 4. 目标用户
- 需要快速集成 3D 能力的前端开发者
- 需要在浏览器中预览大规模场景的 3DGS 研究者
- 测绘、实景三维领域的企业用户
- 数字孪生、智慧城市、智慧展馆项目
- 工业设计、文旅展示、元宇宙应用

## 5. 维护状态与社区支持
- 持续迭代开发，Issue 响应迅速
- License: MIT — 免费商用