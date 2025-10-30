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
- [x] 支持格式: `.ply`、`.splat`、`.spx`、`.spz(v2,v3)`, `.sog(v1,v2)`
- [x] 支持标注测量
- [x] 支持文字水印
- [x] 支持1~3级球谐系数
- [x] 支持地图场景渲染
- [x] 支持通过`*.meta.json`文件设置具体模型的专用参数
- [x] 内置渲染质量级别策略供选用，自适应优化参数不同需求 (v2.0.0+ 🌟)
- [x] 内置多种优化的排序类型供选用，提高个性化场景的性能 (v2.0.0+ 🌟)



#### 在线演示
- https://reall3d.com/reall3dviewer/index.html


#### 文档(By Zread AI)
- https://zread.ai/reall3d-com/Reall3dViewer



## 重要选项参数

| 名称                         | 说明                               |
|------------------------------|------------------------------------|
| `maxRenderCountOfMobile`     | 低端设备的渲染能力有限，默认值不合适时可以调整，建议关注    |
| `maxRenderCountOfPc`         | 再高端设备也有渲染能力上限，默认值不合适时可以调整，建议关注    |
| `qualityLevel`               | 性能和渲染质量的影响因素很多，针对具体模型和目标设备选择合适的级别，可以自适应调整，建议关注    |
| `sortType`                   | 没有一种最优算法可以应对所有场景，但具体场景就会有更合适的，这里内置多种类型供选择优化，建议关注    |


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
