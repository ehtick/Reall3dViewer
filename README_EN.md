<p align=center>
<img style="width:128px;height:128px" src="https://gotoeasy.github.io/reall3d/logo.png"/>
</p>

# Reall3dViewer

`Reall3dViewer` is a 3D Gaussian Splatting viewer built on Three.js. Crafting an exceptional 3DGS viewer is no small feat, which is why we've chosen to open-source our project. We hope to harness the collective wisdom and efforts of the community to drive the advancement of 3DGS applications together!

<br>

<p align="center">
    <a href="https://github.com/reall3d-com/Reall3dViewer/blob/master/README_ZH.md"><img src="https://img.shields.io/badge/readme-Chinese-brightgreen.svg"></a>
    <a href="https://github.com/microsoft/TypeScript"><img src="https://img.shields.io/badge/lang-TypeScript-brightgreen.svg"></a>
    <a href="https://github.com/mrdoob/three.js"><img src="https://img.shields.io/badge/base-Threejs-brightgreen.svg"></a>
    <a href="https://github.com/reall3d-com/Reall3dViewer/releases/latest"><img src="https://img.shields.io/github/release/reall3d-com/Reall3dViewer.svg"></a>
    <a href="https://github.com/reall3d-com/Reall3dViewer/blob/master/LICENSE"><img src="https://img.shields.io/github/license/reall3d-com/Reall3dViewer"></a>
<p>

<br>

## Features
- [x] Support formats: `.ply`, `.splat`, `.spx`, `.spz(v2,v3)`, `.sog(v1,v2)`
- [x] Support mark and measurement tools
- [x] Support text watermarking
- [x] Support 1st to 3rd degree spherical harmonics
- [x] Support map-integrated model rendering
- [x] Support per-model settings via `*.meta.json` file
- [x] Built-in rendering quality levels with adaptive optimization (v2.0.0+ 🌟)
- [x] Built-in optimized sorting types to fine-tune performance for diverse scenarios (v2.0.0+ 🌟)


#### Live demo
- https://reall3d.com/reall3dviewer/index.html


#### Docs(By Zread AI)
- https://zread.ai/reall3d-com/Reall3dViewer


## Key Configuration Parameters

| Name                         | Note                               |
|------------------------------|------------------------------------|
| `maxRenderCountOfMobile`     | Low-end devices have rendering limits. Adjust from default if needed. Recommended.    |
| `maxRenderCountOfPc`         | High-end devices also have rendering limits. Adjust from default if needed. Recommended.   |
| `qualityLevel`               | Choose based on target device and model for optimal performance/quality. Adaptive adjustment supported. Recommended.    |
| `sortType`                   | No single algorithm is optimal for all scenarios. Choose the most suitable one from built-in types for your case. Recommended.  |


## `.spx`

- Format Specification: https://github.com/reall3d-com/Reall3dViewer/blob/main/SPX_EN.md
- Conversion Tool: https://github.com/gotoeasy/gsbox

## Basic Usage

use source code
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

use npm package [sample project here](https://github.com/reall3d-com/reall3dviewer-samples-use-npm-package)
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


## TODO
- Continuously optimize and enhance rendering performance
- Large scene

## Release History
https://github.com/reall3d-com/Reall3dViewer/releases


## Acknowledgments
We would like to express our gratitude to the following projects for their valuable reference implementations
- https://github.com/antimatter15/splat
- https://github.com/mkkellogg/GaussianSplats3D
- https://github.com/huggingface/gsplat.js
- https://github.com/playcanvas/supersplat
- https://github.com/sxguojf/three-tile


## Contact
Feel free to submit an issue on the project page. Our commercial version offers a 3DGS model format optimization tool and supports embedding watermarks to protect model ownership. Please don't hesitate to contact us.
- Site: https://reall3d.com
- Email: ai@geohold.com 
