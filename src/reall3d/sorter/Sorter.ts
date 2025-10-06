// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    WkBucketBits,
    WkCameraDirection,
    WkCameraPosition,
    WkDepthNearRate,
    WkDepthNearValue,
    WkInit,
    WkQualityLevel,
    WkSortType,
    WkUpdateParams,
    WkWatermarkCount,
} from '../utils/consts/WkConstants';
import {
    WkIndex,
    WkIsBigSceneMode,
    WkMaxRenderCount,
    WkModelSplatCount,
    WkRenderSplatCount,
    WkSortTime,
    WkSplatIndex,
    WkTextureReady,
    WkVersion,
    WkViewProjection,
    WkVisibleSplatCount,
    WkSortStartTime,
    WkMinX,
    WkMaxX,
    WkMinY,
    WkMaxY,
    WkMinZ,
    WkMaxZ,
    WkXyz,
} from '../utils/consts/WkConstants';
import { DefaultQualityLevel, isMobile, MaxQualityLevel, MinQualityLevel, SortTypes } from '../utils/consts/GlobalConstants';

const worker: Worker = self as any;
let texture0: SplatTexdata = { index: 0, version: 0 };
let texture1: SplatTexdata = { index: 1, version: 0 };
let isSorterReady: boolean = false;
let qualityLevel: number = DefaultQualityLevel; // 1~9,默认5
let sortType: number = SortTypes.Default;
let maxRenderCount: number = 0;

let sortRunning: boolean;
let Epsilon: number = isMobile ? 0.5 : 0.2;
let viewProj: number[];
let lastViewProj: number[] = [];
let distances: Int32Array = new Int32Array(0);
let depths: Float32Array = new Float32Array(0);
let tags: Uint8Array = new Uint8Array(0);
let int32Tmp1: Int32Array = new Int32Array(0);
let counters: Int32Array = new Int32Array(0);
let cameraDir: number[];
let cameraPos: number[];

// let lastCameraDir: number[];
// let lastCameraPos: number[];

let lastSortVersion: number = 0;
let isBigSceneMode: boolean;
let depthNearRate = 0.4; // 按比例计算分段(近端占比0.4是为了调试看到效果，实际应用应根据模型尺寸具体调整)
let depthNearValue = 0; // 按设定值计算分段(设定时优先)

function runSort(sortViewProj: number[], sortCameraDir: number[]) {
    if (!isSorterReady) return; // 尚未就绪
    let texture: SplatTexdata = texture0.version > texture1.version ? texture0 : texture1;
    if (!texture.version) return; // 初期还没有数据

    const { xyz, renderSplatCount, visibleSplatCount, modelSplatCount, watermarkCount, index, version } = texture;

    if (lastSortVersion === version) {
        let diff =
            Math.abs(lastViewProj[2] - sortViewProj[2]) +
            Math.abs(lastViewProj[6] - sortViewProj[6]) +
            Math.abs(lastViewProj[10] - sortViewProj[10]) +
            Math.abs(lastViewProj[14] - sortViewProj[14]);
        if (diff < Epsilon) {
            return;
        }
    }
    lastViewProj = sortViewProj;
    lastSortVersion = version;

    let startTime = Date.now();
    let depthIndex: Uint32Array;
    if (!renderSplatCount) {
        // 没有渲染数据时直接处理
        depthIndex = new Uint32Array(0);
        worker.postMessage(
            {
                [WkSplatIndex]: depthIndex,
                [WkRenderSplatCount]: depthIndex.length, // 可变
                [WkVisibleSplatCount]: visibleSplatCount,
                [WkModelSplatCount]: modelSplatCount,
                [WkIndex]: index,
                [WkVersion]: version,
                [WkSortTime]: 0,
                [WkSortStartTime]: startTime,
            },
            [depthIndex.buffer],
        );
        return;
    }

    // 排序
    let sortTime = 0;
    let bucketBits = 0;
    const dataCount = renderSplatCount - watermarkCount;
    const fnCalcDepth = sortType === 1 ? (qualityLevel > DefaultQualityLevel ? calcDepthByViewProjPlus : calcDepthByViewProj) : calcDepthByCameraDir;
    const sortVpOrDir = sortType === 1 ? sortViewProj : sortCameraDir;
    const dotPos = sortCameraDir[0] * cameraPos[0] + sortCameraDir[1] * cameraPos[1] + sortCameraDir[2] * cameraPos[2];

    let { maxDepth, minDepth } = calcMinMaxDepth(texture, sortVpOrDir, fnCalcDepth, dotPos);
    if (maxDepth - minDepth <= 0.00001) {
        // 都挤一起了没必要排序
        depthIndex = new Uint32Array(renderSplatCount);
        for (let i = 0; i < dataCount; ++i) depthIndex[i] = i;
    } else {
        let maxCnt = getBucketCount(maxRenderCount).bucketCnt;
        counters.length < maxCnt ? (counters = new Int32Array(maxCnt)) : counters.fill(0);
        distances.length < maxRenderCount && (distances = new Int32Array(maxRenderCount));
        if (sortType !== SortTypes.Default) {
            depths.length < maxRenderCount && (depths = new Float32Array(maxRenderCount));
            tags.length < maxRenderCount && (tags = new Uint8Array(maxRenderCount));
        }

        if (sortType === SortTypes.DirWithPruneTwoSort) {
            // 按相机方向（剔除相机背面数据提高渲染性能，按近远分2段排序提高近处渲染质量）
            ({ depthIndex, bucketBits } = sortDirWithPruneTwoSort({ xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir }));
        } else if (sortType === SortTypes.DirWithPruneOnlyNear) {
            // 按相机方向（剔除背后和远端数据，仅留近端数据提高渲染性能）
            int32Tmp1.length < maxRenderCount && (int32Tmp1 = new Int32Array(maxRenderCount));
            // prettier-ignore
            const arg = { depths, distances, tags, counters, int32Tmp1, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir, depthNearRate, depthNearValue };
            ({ depthIndex, bucketBits } = sortDirWithPruneOnlyNear2010(arg));
        } else if (sortType === SortTypes.DirWithPrune) {
            // 按相机方向（剔除相机背面数据提高渲染性能）
            ({ depthIndex, bucketBits } = sortDirWithPrune({ xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir }));
        } else if (sortType === SortTypes.DirWithTwoSort) {
            // 按相机方向（不剔除数据，按近远分2段排序提高近处渲染质量）
            ({ depthIndex, bucketBits } = sortDirWithTwoSort({ xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir }));
        } else {
            // 默认，按视图投影矩阵排序（全量渲染）
            const arg = { distances, counters, xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortViewProj };
            ({ depthIndex, bucketBits } = sortByViewProjDefault(arg));
        }
    }

    // 水印，按视图投影矩阵排序
    watermarkCount && sortWatermark({ xyz, dataCount, watermarkCount, maxDepth, minDepth, sortViewProj, depthIndex });

    sortTime = Date.now() - startTime;
    worker.postMessage(
        {
            [WkSplatIndex]: depthIndex,
            [WkRenderSplatCount]: depthIndex.length, // 可按实际变化
            [WkVisibleSplatCount]: visibleSplatCount,
            [WkModelSplatCount]: modelSplatCount,
            [WkIndex]: index,
            [WkVersion]: version,
            [WkSortStartTime]: startTime,
            [WkSortTime]: sortTime,
            [WkBucketBits]: bucketBits || 16,
            [WkSortType]: sortType || 1,
        },
        [depthIndex.buffer],
    );
}

/** 按相机方向（剔除相机背面数据提高渲染性能，按近远分2段排序提高近处渲染质量） */
function sortDirWithPruneTwoSort(oArg: any) {
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir } = oArg;

    // console.time('深度计算');
    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = depthNearValue ? maxDepth1 - Math.abs(depthNearValue) : maxDepth1 - (maxDepth1 - minDepth) * depthNearRate;
    const maxDepth2 = minDepth1;
    const minDepth2 = minDepth;
    const cnts = [0, 0, 0];
    for (let i = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        tags[i] = depths[i] > 0 ? 0 : depths[i] < minDepth1 ? 2 : 1;
        cnts[tags[i]]++;
    }
    // console.timeEnd('深度计算');
    // 分段
    // console.time('分段');
    const cnt1 = cnts[1];
    const cnt2 = cnts[2];
    const dataIdx1 = new Uint32Array(cnt1);
    const dataIdx2 = new Uint32Array(cnt2);
    const fns = [() => {}, (i: number, v: number) => (dataIdx1[i] = v), (i: number, v: number) => (dataIdx2[i] = v)];
    const idxs: number[] = [0, 0, 0];
    for (let i = 0; i < dataCount; ++i) fns[tags[i]](idxs[tags[i]]++, i);
    // console.timeEnd('分段');
    // 远端排序
    // console.time('远端排序');
    const depthIndex = new Uint32Array(cnt1 + cnt2 + watermarkCount);
    let { bucketBits, bucketCnt } = getBucketCount(cnt2);
    let depthInv: number = (bucketCnt - 1) / (maxDepth2 - minDepth2);
    counters.length < bucketCnt ? (counters = new Int32Array(bucketCnt)) : counters.fill(0);
    for (let i = 0, idx = 0; i < cnt2; ++i) {
        idx = ((depths[dataIdx2[i]] - minDepth2) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt2; ++i) depthIndex[--counters[distances[i]]] = dataIdx2[i];
    // console.timeEnd('远端排序');
    // 近端排序
    // console.time('近端排序');
    ({ bucketCnt } = getBucketCount(cnt1));
    depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    counters.length < bucketCnt ? (counters = new Int32Array(bucketCnt)) : counters.fill(0);
    for (let i = 0, idx = 0; i < cnt1; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt1; ++i) depthIndex[--counters[distances[i]] + cnt2] = dataIdx1[i];
    // console.timeEnd('近端排序');

    return { depthIndex, bucketBits };
}

/** 按相机方向（剔除背后和远端数据，仅留近端数据提高渲染性能） */
function sortDirWithPruneOnlyNear2010(oArg: any) {
    const { depths, distances, tags, counters, int32Tmp1: dataIdx1, xyz, dataCount, watermarkCount, minDepth, dotPos, sortCameraDir } = oArg;
    const maxDepth1 = Math.min(oArg.maxDepth, 0);
    const minDepth1 = oArg.depthNearValue ? maxDepth1 - Math.abs(oArg.depthNearValue) : maxDepth1 - (maxDepth1 - minDepth) * oArg.depthNearRate;
    let nearCnt = 0;
    for (let i = 0, tag = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        tag = ((depths[i] < 0 && depths[i] >= minDepth1) as any) | 0;
        tags[i] = tag;
        dataIdx1[nearCnt] = i;
        nearCnt += tag;
    }
    const depthIndex = new Uint32Array(nearCnt + watermarkCount);
    const { bucketBits, bucketCnt } = getBucketCount(nearCnt);
    const depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    for (let i = 0, idx = 0; i < nearCnt; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0; // TODO
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < nearCnt; ++i) depthIndex[--counters[distances[i]]] = dataIdx1[i];
    return { depthIndex, bucketBits };
}

/** 按相机方向（剔除相机背面数据提高渲染性能） */
function sortDirWithPrune(oArg: any) {
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir } = oArg;

    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = minDepth;
    let frontCnt = 0;
    for (let i = 0, idx = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        tags[i] = ((depths[i] < 0) as any) | 0;
        frontCnt += tags[i];
    }
    // 分段
    const dataIdx1 = new Uint32Array(frontCnt);
    const fns = [() => {}, (i: number, v: number) => (dataIdx1[i] = v)];
    const idxs: number[] = [0, 0];
    for (let i = 0; i < dataCount; ++i) fns[tags[i]](idxs[tags[i]]++, i);
    const depthIndex = new Uint32Array(frontCnt + watermarkCount);
    // 近端排序
    let { bucketCnt, bucketBits } = getBucketCount(frontCnt);
    let depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    counters.length < bucketCnt ? (counters = new Int32Array(bucketCnt)) : counters.fill(0);
    for (let i = 0, idx = 0; i < frontCnt; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < frontCnt; ++i) depthIndex[--counters[distances[i]]] = dataIdx1[i];

    // maxDepth = Math.min(maxDepth, 0);
    // let obucket = getBucketCount(dataCount);
    // bucketBits = obucket.bucketBits;
    // let bucketCnt = obucket.bucketCnt;
    // let depthInv: number = (bucketCnt - 1) / (maxDepth - minDepth);
    // counters.length < bucketCnt ? (counters = new Int32Array(bucketCnt)) : counters.fill(0);
    // let pruneCnt = 0;
    // for (let i = 0, idx = 0, depth = 0; i < dataCount; ++i) {
    //     depth = fnCalcDepth(sortVpOrDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]);
    //     idx = ((depth - minDepth) * depthInv) | 0;
    //     counters[(distances[i] = idx)]++;
    //     tags[i] = ((depth > 0) as any) | 0;
    //     pruneCnt += tags[i];
    // }
    // for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    // depthIndex = new Uint32Array(dataCount - pruneCnt + watermarkCount);
    // const tgts: Uint32Array[] = [depthIndex, new Uint32Array(0)];
    // for (let i = 0; i < dataCount; ++i) tgts[tags[i]][--counters[distances[i]]] = i;

    return { depthIndex, bucketBits };
}

/** 按相机方向（不剔除数据，按近远分2段排序提高近处渲染质量） */
function sortDirWithTwoSort(oArg: any) {
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir } = oArg;

    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = depthNearValue ? maxDepth1 - Math.abs(depthNearValue) : maxDepth1 - (maxDepth1 - minDepth) * depthNearRate;
    let nearCnt = 0;
    for (let i = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        tags[i] = ((depths[i] < 0 && depths[i] >= minDepth1) as any) | 0;
        nearCnt += tags[i];
    }
    // 分段
    const cnt2 = dataCount - nearCnt;
    const dataIdx1 = new Uint32Array(nearCnt);
    const dataIdx2 = new Uint32Array(cnt2);
    const dataIdxs = [dataIdx2, dataIdx1];
    const idxs: number[] = [0, 0];
    for (let i = 0; i < dataCount; ++i) dataIdxs[tags[i]][idxs[tags[i]]++] = i;
    const depthIndex = new Uint32Array(dataCount + watermarkCount);
    // 远端排序
    let { bucketBits, bucketCnt } = getBucketCount(cnt2);
    let depthInv: number = (bucketCnt - 1) / (maxDepth - minDepth);
    counters.length < bucketCnt ? (counters = new Int32Array(bucketCnt)) : counters.fill(0);
    for (let i = 0, idx = 0; i < cnt2; ++i) {
        idx = ((depths[dataIdx2[i]] - minDepth) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt2; ++i) depthIndex[--counters[distances[i]]] = dataIdx2[i];
    // 近端排序
    bucketCnt = getBucketCount(nearCnt).bucketCnt; // 按配置级别
    depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    counters.length < bucketCnt ? (counters = new Int32Array(bucketCnt)) : counters.fill(0);
    for (let i = 0, idx = 0; i < nearCnt; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < nearCnt; ++i) depthIndex[--counters[distances[i]] + cnt2] = dataIdx1[i];

    return { depthIndex, bucketBits };
}

/** 默认，按视图投影矩阵排序（全量渲染） */
function sortByViewProjDefault(oArg: any) {
    const { distances, counters, xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortViewProj } = oArg;
    const depthIndex = new Uint32Array(dataCount + watermarkCount);
    let { bucketBits, bucketCnt } = getBucketCount(dataCount);
    let depthInv: number = (bucketCnt - 1) / (maxDepth - minDepth);
    for (let i = 0, idx = 0; i < dataCount; ++i) {
        idx = ((fnCalcDepth(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]) - minDepth) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < dataCount; ++i) depthIndex[--counters[distances[i]]] = i;
    return { depthIndex, bucketBits };
}

/** 水印，按视图投影矩阵排序 */
function sortWatermark(oArg: any) {
    let { xyz, dataCount, watermarkCount, maxDepth, minDepth, sortViewProj, depthIndex } = oArg;
    const renderSplatCount = dataCount + watermarkCount;
    const offset = depthIndex.length - watermarkCount;

    let { bucketCnt } = getBucketCount(watermarkCount, 1); // 水印数据很少精度要求低，按最低1级计算，范围值重新计算避免太大误差
    // TODO 考虑传入包围盒点进行计算
    maxDepth = minDepth = calcDepthByViewProj(sortViewProj, xyz[3 * dataCount], xyz[3 * dataCount + 1], xyz[3 * dataCount + 2]);
    for (let i = dataCount, dpt = 0; i < renderSplatCount; ++i) {
        dpt = calcDepthByViewProj(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]);
        maxDepth = Math.max(dpt, maxDepth);
        minDepth = Math.min(dpt, minDepth);
    }

    if (maxDepth - minDepth <= 0.00001) {
        for (let i = 0; i < watermarkCount; ++i) depthIndex[dataCount + i] = dataCount + i;
    } else {
        let depthInv = (bucketCnt - 1) / (maxDepth - minDepth);
        counters.length < bucketCnt ? (counters = new Int32Array(bucketCnt)) : counters.fill(0);
        for (let i = dataCount, idx = 0; i < renderSplatCount; ++i) {
            idx = ((calcDepthByViewProj(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]) - minDepth) * depthInv) | 0;
            counters[(distances[i - dataCount] = idx)]++;
        }
        for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
        for (let i = 0; i < watermarkCount; ++i) depthIndex[offset + --counters[distances[i]]] = dataCount + i;
    }
}

function calcDepthByViewProj(svp: number[], x: number, y: number, z: number): number {
    return svp[2] * x + svp[6] * y + svp[10] * z; // 默认质量级别及以下时使用
}
function calcDepthByViewProjPlus(svp: number[], x: number, y: number, z: number): number {
    return svp[2] * x + svp[6] * y + svp[10] * z + svp[14]; // 高于默认级别时使用
}
function calcDepthByCameraDir(dir: number[], x: number, y: number, z: number, dotPos: number): number {
    return dotPos - dir[0] * x - dir[1] * y - dir[2] * z; // 大于0为在相机背后
}

function calcMinMaxDepth(texture: SplatTexdata, viewProjOrCameraDir: number[], fnDepth: Function, dotPos: number): any {
    let maxDepth = -Infinity;
    let minDepth = Infinity;
    let dep = 0;
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.minY, texture.minZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.minY, texture.maxZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.maxY, texture.minZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.maxY, texture.maxZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.minY, texture.minZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.minY, texture.maxZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.maxY, texture.minZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.maxY, texture.maxZ, dotPos);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    return { maxDepth, minDepth };
}

const throttledSort = () => {
    if (!sortRunning) {
        sortRunning = true;
        const sortViewProj = viewProj;
        const sortCameraDir = cameraDir;
        runSort(sortViewProj, sortCameraDir);
        setTimeout(() => !(sortRunning = false) && (sortType === 1 ? sortViewProj !== viewProj : sortCameraDir != cameraDir) && throttledSort());
    }
};

function getBucketCount(splatCnt: number, useLevel: number = 0) {
    // 没有数据无排序，简单返回
    if (!splatCnt) return { bucketBits: 1, bucketCnt: 1 };

    // 水印等情景允许通过参数指定级别
    let level = useLevel ? Math.min(useLevel, qualityLevel) : qualityLevel;
    // 按级别确定精度，达到允许自定义调整的目的，手机降低1级并控制不低于1级
    let bucketBits = 11 + (isMobile ? Math.max(level - 1, 1) : level);
    // 低级别时，根据数据量计算，进一步降低精度，确保至少8位不失控
    if (level < 3) {
        bucketBits = Math.max(Math.min(bucketBits, Math.round(Math.log2(splatCnt / 32))), 8);
    } else if (level < 4) {
        bucketBits = Math.max(Math.min(bucketBits, Math.round(Math.log2(splatCnt / 16))), 8);
    } else if (level < 5) {
        bucketBits = Math.max(Math.min(bucketBits, Math.round(Math.log2(splatCnt / 8))), 8);
    }
    // 高级别时，根据数据量计算控制，避免不必要的浪费
    if (level >= 5) {
        bucketBits = Math.min(bucketBits, Math.round(Math.log2(splatCnt / 4)));
    }

    return { bucketBits, bucketCnt: 2 ** bucketBits };
}

worker.onmessage = (e: any) => {
    const data: any = e.data;
    if (data[WkTextureReady]) {
        let texture = !isBigSceneMode || data[WkIndex] === 0 ? texture0 : texture1;

        texture.minX = data[WkMinX];
        texture.maxX = data[WkMaxX];
        texture.minY = data[WkMinY];
        texture.maxY = data[WkMaxY];
        texture.minZ = data[WkMinZ];
        texture.maxZ = data[WkMaxZ];
        texture.xyz = new Float32Array(data[WkXyz].buffer);
        texture.watermarkCount = data[WkWatermarkCount];
        texture.version = data[WkVersion];
        texture.renderSplatCount = data[WkRenderSplatCount];
        texture.visibleSplatCount = data[WkVisibleSplatCount];
        texture.modelSplatCount = data[WkModelSplatCount];

        texture.textureReady = true;
        texture.textureReadyTime = Date.now();
    } else if (data[WkViewProjection]) {
        const vp: number[] = data[WkViewProjection];
        cameraDir = data[WkCameraDirection];
        cameraPos = data[WkCameraPosition];
        vp[2] *= -1;
        vp[6] *= -1;
        vp[10] *= -1;
        vp[14] *= -1;
        viewProj = vp;
        throttledSort();
    } else if (data[WkUpdateParams]) {
        qualityLevel = Math.max(MinQualityLevel, Math.min(data[WkQualityLevel] || DefaultQualityLevel, MaxQualityLevel)); // 限制1~9,默认5
        sortType = data[WkSortType] || sortType;
        depthNearRate = data[WkDepthNearRate] || depthNearRate;
        depthNearValue = data[WkDepthNearValue] || depthNearValue;
    } else if (data[WkInit]) {
        isBigSceneMode = data[WkIsBigSceneMode];
        maxRenderCount = data[WkMaxRenderCount];
        qualityLevel = Math.max(MinQualityLevel, Math.min(data[WkQualityLevel] || DefaultQualityLevel, MaxQualityLevel)); // 限制1~9,默认5
        sortType = data[WkSortType] || sortType;
        depthNearRate = data[WkDepthNearRate] || depthNearRate;
        depthNearValue = data[WkDepthNearValue] || depthNearValue;
        isSorterReady = true;
    }
};
