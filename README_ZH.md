<p align=center>
<img style="width:128px;height:128px" src="https://gotoeasy.github.io/reall3d/logo.png"/>
</p>

# Reall3dViewer

`Reall3dViewer`是一个基于`Three.js`的`3D Gaussian Splatting`渲染器。打造卓越的`3DGS`渲染器并非易事，我们选择开源，希望能集思广益，群策群力，共同为推动`3DGS`应用发展助一臂之力！

<br>

<p align="center">
    <a href="https://github.com/reall3d-com/Reall3dViewer/blob/master/README_EN.md"><img src="https://img.shields.io/badge/readme-Engilsh-brightgreen.svg"></a>
    <a href="https://github.com/microsoft/TypeScript"><img src="https://img.shields.io/badge/lang-TypeScript-brightgreen.svg"></a>
    <a href="https://github.com/mrdoob/three.js"><img src="https://img.shields.io/badge/base-Threejs-brightgreen.svg"></a>
    <a href="https://github.com/reall3d-com/Reall3dViewer/releases/latest"><img src="https://img.shields.io/github/release/reall3d-com/Reall3dViewer.svg"></a>
    <a href="https://github.com/reall3d-com/Reall3dViewer/blob/master/LICENSE"><img src="https://img.shields.io/github/license/reall3d-com/Reall3dViewer"></a>
<p>

<br>

## 特点
- [x] 支持格式: `.ply`、`.splat`、`.spx`、`.spz`
- [x] 支持标注测量
- [x] 支持文字水印
- [x] 支持1~3级球谐系数
- [x] 支持地图场景渲染


## 在线演示
- https://reall3d.com/reall3dviewer/index.html


## `.spx`

- 格式说明： https://github.com/reall3d-com/Reall3dViewer/blob/main/SPX_ZH.md
- 转换工具： https://github.com/gotoeasy/gsbox


## 用法

使用源码方式
```shell
# develop
npm run dev

# build
npm run build

# open a web browser to render your 3dgs model
# http://hostname:port/index.html?url=your-model-link-address

# .spx file can be obtained through conversion using the gsbox
gsbox p2x -i /path/to/input.ply -o /path/to/output.spx -sh 0
```


使用 npm 包方式 [例子工程在这](https://github.com/reall3d-com/reall3dviewer-samples-use-npm-package)
```shell
# install
npm install @reall3d/reall3dviewer

# use built-in viewer
const viewer = new Reall3dViewer({ root: '#gsviewer' });
viewer.addModel(`https://reall3d.com/demo-models/yz.spx`);

# use splat mesh
const splatMesh = new SplatMesh({ renderer, scene, controls});
splatMesh.addModel({ url: 'https://reall3d.com/demo-models/yz.spx' });
scene.add(splatMesh);
```

## 文档(By Zread)
- https://zread.ai/reall3d-com/Reall3dViewer


## TODO
- 持续优化增强渲染性能
- 大场景


## 履历
https://github.com/reall3d-com/Reall3dViewer/releases


## 鸣谢
感谢以下项目提供的参考实现
- https://github.com/antimatter15/splat
- https://github.com/mkkellogg/GaussianSplats3D
- https://github.com/huggingface/gsplat.js
- https://github.com/playcanvas/supersplat
- https://github.com/sxguojf/three-tile


## 联系
欢迎在项目页面上提交`issue`，商业版提供模型格式优化工具，支持嵌入水印保护模型产权，请随时与我们联系。
- Site: https://reall3d.com
- Email: ai@geohold.com 
