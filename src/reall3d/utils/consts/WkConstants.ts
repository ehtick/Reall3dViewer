// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
// Worker常量
let n: number = 0;
/** Splat纹理 */
export const WkTexdata = `$${n++}`;
/** Splat索引 */
export const WkSplatIndex = `$${n++}`;
/** 当前模型已下载数据的最大半径 */
export const WkCurrentMaxRadius = `$${n++}`;
/** 模型的最大半径（小场景bin格式用） */
export const WkMaxRadius = `$${n++}`;
/** 模型中心点高度（小场景bin格式用） */
export const WkTopY = `$${n++}`;
/** 纹理索引 */
export const WkIndex = `$${n++}`;
/** 数据版本(时间戳) */
export const WkVersion = `$${n++}`;
/** 渲染的高斯数量 */
export const WkRenderSplatCount = `$${n++}`;
/** 可见的高斯数量 */
export const WkVisibleSplatCount = `$${n++}`;
/** 模型中的高斯数量 */
export const WkModelSplatCount = `$${n++}`;
/** 排序开始时间 */
export const WkSortStartTime = `$${n++}`;
/** 排序消耗时间 */
export const WkSortTime = `$${n++}`;
/** 纹理就绪 */
export const WkTextureReady = `$${n++}`;
/** 模型数据缓冲 */
export const WkSplatDataBuffer = `$${n++}`;
/** 是否大场景 */
export const WkIsBigSceneMode = `$${n++}`;
/** 最大渲染数量 */
export const WkMaxRenderCount = `$${n++}`;
/** bin格式版本 */
export const WkBinVersion = `$${n++}`;
/** 视图投影矩阵 */
export const WkViewProjection = `$${n++}`;
/** 上传纹理的版本 */
export const WkUploadTextureVersion = `$${n++}`;
/** 排序用已就绪的坐标 */
export const WkXyz = `$${n++}`;
/** 排序用已就绪的水印坐标 */
export const WkWxyz = `$${n++}`;
/** 包围盒 */
export const WkMinX = `$${n++}`;
/** 包围盒 */
export const WkMaxX = `$${n++}`;
/** 包围盒 */
export const WkMinY = `$${n++}`;
/** 包围盒 */
export const WkMaxY = `$${n++}`;
/** 包围盒 */
export const WkMinZ = `$${n++}`;
/** 包围盒 */
export const WkMaxZ = `$${n++}`;
/** 初始化 */
export const WkInit = `$${n++}`;
/** 水印数量 */
export const WkWatermarkCount = `$${n++}`;
/** 相机方向 */
export const WkCameraDirection = `$${n++}`;
/** 渲染质量（高中低） */
export const WkRenderQuality = `$${n++}`;
