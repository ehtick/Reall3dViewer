// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
export const ViewerVersion = 'v2.0.0-dev'; // Reall3dViewer 版本

export const isMobile = navigator.userAgent.includes('Mobi');
export const HalfChars = 'QWERTYUIOPLKJHGFDSAZXCVBNM1234567890qwertyuioplkjhgfdsazxcvbnm`~!@#$%^&*()-_=+\\|]}[{\'";::,<.>//? \t';
export const BlankingTimeOfSmallScene = isMobile ? 600 : 300;
export const BlankingTimeOfLargeScene = isMobile ? 2000 : 300;
export const BinHeaderSize = 140;
export const SpxHeaderSize = 128;
export const DataSize36 = 36;
export const DataSize32 = 32;
export const SplatDataSize32 = 32;
export const SplatDataSize20 = 20;
export const SplatDataSize16 = 16;
export const WasmBlockSize: number = 64 * 1024;
export const MobileDownloadLimitSplatCount = 1024 * 10000; // 移动端高斯点数下载限制
export const PcDownloadLimitSplatCount = 10240 * 10000; // PC端高斯点数下载限制
export const SH_C0 = 0.28209479177387814;
export const MinQualityLevel = 1;
export const DefaultQualityLevel = 5;
export const MaxQualityLevel = 9;

/** 【官方创建者Reall3d】Creater: Reall3d */
export const SpxCreaterReall3d = 0;
/** 【spx中定义的公开格式】spx open format */
export const SpxOpenFormat0 = 0;

/** 【spx中定义的公开数据块格式】Open Block Content Format 20, basic data */
export const SpxBlockFormatData20 = 20;
/** 【spx中定义的公开数据块格式】Open Block Content Format 19, basic data */
export const SpxBlockFormatData19 = 19;
/** 【spx中定义的公开数据块格式】Open Block Content Format 190, basic data */
export const SpxBlockFormatData190 = 190;
/** 【spx中定义的公开数据块格式】Open Block Content Format 1, data of SH degree 1 （SH1 only） */
export const SpxBlockFormatSH1 = 1;
/** 【spx中定义的公开数据块格式】Open Block Content Format 2, data of SH degree 2 （SH1 + SH2） */
export const SpxBlockFormatSH2 = 2;
/** 【spx中定义的公开数据块格式】Open Block Content Format 3, data of SH degree 3 （SH3 only） */
export const SpxBlockFormatSH3 = 3;
/** 【spx中定义的公开数据块格式】Open Block Content Format 4, data of SH degree 1~3 （SH1 + SH2 + SH3） */
export const SpxBlockFormatSH4 = 4;

/** 【Reall3D扩展的专属格式】the exclusive format extended by reall3d */
export const SpxExclusiveFormatReall3d = 3141592653;

/**
 * 【排序类型】
 * 并不存在一种即性能高效又普遍适用的排序方法，这里提供默认方式作为普适性使用，以及其他多种方式供个性化场景选择使用。
 *
 * 允许按不同场景选择参数，配合调优的近端分段参数depthNearRate或depthNearValue一并写入meta达到个性化优化效果。
 * 注意应避免动态切换排序类型，否则可能因为不相吻合而适得其反
 * 例:室内迷宫场景，即使场景尺寸远大于2000，但实际拐弯抹角每个角度可能都最多看10个深度尺寸，
 *    这时选择【2010】并设定depthNearValue=10就是合适的。
 *
 * 默认以外的排序类型都是为了具体个性化场景而准备的，应当具体实验后再确定选用。
 */
export enum SortTypes {
    /** 默认，按视图投影矩阵计算z-depth进行全量排序 */
    Default = 1,
    /** 按相机方向计算z-depth进行排序，剔除背后和远端数据，仅渲染近端，有遮挡只能看到近端场景时适用 */
    ZdepthNearest2010 = 2010,
    /** 按相机方向计算z-depth进行排序，剔除背后数据 */
    ZdepthFront2011 = 2011,
    /** 按相机方向计算z-depth进行排序，剔除背后数据，分近端远端两段排序，用以提高近端渲染精度 */
    ZdepthFrontNearFar2012 = 2012,
    /** 按相机方向计算z-depth进行排序，不剔除数据，分近端远端两段排序，用以提高近端渲染精度 */
    ZdepthNearFar2112 = 2112,
    /** 【环顾四周模式友好】按相机距离计算深度进行排序，剔除远端数据，仅渲染近端，有遮挡只能看到近端场景时适用 */
    RdepthNearest3110 = 3110,
    /** 【环顾四周模式友好】按相机距离计算深度进行全量排序 */
    RdepthFull3111 = 3111,
    /** 【环顾四周模式友好】按相机距离计算深度进行排序，不剔除数据，分近端远端两段排序，用以提高近端渲染精度 */
    RdepthNearFar3112 = 3112,
}
