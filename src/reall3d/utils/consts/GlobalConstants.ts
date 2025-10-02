// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
export const ViewerVersion = 'v1.8.0-dev'; // Reall3dViewer 版本

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
