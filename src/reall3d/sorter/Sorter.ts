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
    WkSplatIndexDone,
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
let lastCameraDir: number[];
let lastCameraPos: number[];
let lastViewProj: number[] = [];
let distances: Int32Array = new Int32Array(0);
let depths: Float32Array = new Float32Array(0);
let int32Tmp1: Int32Array = new Int32Array(0);
let int32Tmp2: Int32Array = new Int32Array(0);
let counters: Int32Array = new Int32Array(0);
let splatIndexPool: Uint32Array[] = [];
let cameraDir: number[];
let cameraPos: number[];

let lastSortVersion: number = 0;
let isBigSceneMode: boolean;
let depthNearRate = 0.4; // 按比例计算分段(近端占比0.4是为了调试看到效果，实际应用应根据模型尺寸具体调整)
let depthNearValue = 0; // 按设定值计算分段(设定时优先)

function runSort(sortViewProj: number[], sortCameraDir: number[], sortCameraPos: number[]) {
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
    lastCameraDir = sortCameraDir;
    lastCameraPos = sortCameraPos;
    lastSortVersion = version;

    let startTime = Date.now();
    let renderCount: number;
    if (!renderSplatCount) {
        const depthIndex = new Uint32Array(0);
        // 没有渲染数据时直接处理
        worker.postMessage(
            {
                [WkSplatIndex]: depthIndex,
                [WkRenderSplatCount]: 0,
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
    let depthIndex: Uint32Array = poolSplatIndexPop();
    const dataCount = renderSplatCount - watermarkCount;
    const fnCalcDepth = sortType === 1 ? (qualityLevel > DefaultQualityLevel ? calcDepthByViewProjPlus : calcDepthByViewProj) : calcDepthByCameraDir;
    const sortVpOrDir = sortType === 1 ? sortViewProj : sortCameraDir;
    const dotPos = sortCameraDir[0] * sortCameraPos[0] + sortCameraDir[1] * sortCameraPos[1] + sortCameraDir[2] * sortCameraPos[2];

    let { maxDepth, minDepth } = calcMinMaxDepth(texture, sortVpOrDir, fnCalcDepth, dotPos);
    if (maxDepth - minDepth <= 0.00001) {
        // 都挤一起了没必要排序
        for (let i = 0; i < dataCount; ++i) depthIndex[i] = i;
        renderCount = dataCount + watermarkCount;
    } else {
        let maxBucketCnt = getBucketCount(maxRenderCount).bucketCnt;
        counters.length < maxBucketCnt ? (counters = new Int32Array(maxBucketCnt)) : counters.fill(0);
        distances.length < maxRenderCount && (distances = new Int32Array(maxRenderCount));
        sortType !== SortTypes.Default && depths.length < maxRenderCount && (depths = new Float32Array(maxRenderCount));

        if (sortType === SortTypes.ZdepthFrontNearest2010) {
            // 【2010】按相机方向（剔除背后和远端数据，仅留近端数据提高渲染性能）
            int32Tmp1.length < maxRenderCount && (int32Tmp1 = new Int32Array(maxRenderCount));
            // prettier-ignore
            const arg = { depthIndex, depths, distances, counters, int32Tmp1, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir, depthNearRate, depthNearValue };
            ({ renderCount, bucketBits } = sortDirWithPruneOnlyNear2010(arg));
        } else if (sortType === SortTypes.ZdepthFront2011) {
            // 【2011】按相机方向（剔除相机背面数据提高渲染性能）
            int32Tmp1.length < maxRenderCount && (int32Tmp1 = new Int32Array(maxRenderCount));
            // prettier-ignore
            const arg = { depthIndex, depths, distances, counters, int32Tmp1, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir, depthNearRate, depthNearValue };
            ({ renderCount, bucketBits } = sortDirWithPrune2011(arg));
        } else if (sortType === SortTypes.ZdepthFrontNearFar2012) {
            // 【2012】按相机方向（剔除相机背面数据提高渲染性能，按近远分2段排序提高近处渲染质量）
            int32Tmp1.length < maxRenderCount && (int32Tmp1 = new Int32Array(maxRenderCount));
            int32Tmp2.length < maxRenderCount && (int32Tmp2 = new Int32Array(maxRenderCount));
            // prettier-ignore
            const arg = { depthIndex, depths, distances, counters, int32Tmp1, int32Tmp2, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir, depthNearRate, depthNearValue };
            ({ renderCount, bucketBits } = sortDirWithPruneTwoSort2012(arg));
        } else if (sortType === SortTypes.ZdepthFullNearFar2112) {
            // 【2112】按相机方向（不剔除数据，按近远分2段排序提高近处渲染质量）
            int32Tmp1.length < maxRenderCount && (int32Tmp1 = new Int32Array(maxRenderCount));
            int32Tmp2.length < maxRenderCount && (int32Tmp2 = new Int32Array(maxRenderCount));
            // prettier-ignore
            const arg = { depthIndex, depths, distances, counters, int32Tmp1, int32Tmp2, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir, depthNearRate, depthNearValue };
            ({ renderCount, bucketBits } = sortDirWithTwoSort2112(arg));
        } else {
            // 【1】默认，按视图投影矩阵排序（全量渲染）
            const arg = { depthIndex, distances, counters, xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortViewProj };
            ({ renderCount, bucketBits } = sortByViewProjDefault(arg));
        }
    }

    // 水印，按视图投影矩阵排序
    watermarkCount && sortWatermark({ xyz, dataCount, watermarkCount, maxDepth, minDepth, sortViewProj, depthIndex });

    sortTime = Date.now() - startTime;
    worker.postMessage(
        {
            [WkSplatIndex]: depthIndex,
            [WkRenderSplatCount]: renderCount, // 按实际变化并非一定固定
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

/** 按相机方向（剔除背后和远端数据，仅留近端数据提高渲染性能） */
function sortDirWithPruneOnlyNear2010(oArg: any) {
    const { depthIndex, depths, distances, counters, int32Tmp1: dataIdx1, xyz, dataCount, watermarkCount, minDepth, dotPos, sortCameraDir } = oArg;
    const maxDepth1 = Math.min(oArg.maxDepth, 0);
    const minDepth1 = oArg.depthNearValue ? maxDepth1 - Math.abs(oArg.depthNearValue) : maxDepth1 - (maxDepth1 - minDepth) * oArg.depthNearRate;
    let nearCnt = 0;
    for (let i = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        dataIdx1[nearCnt] = i;
        nearCnt += ((depths[i] <= 0 && depths[i] >= minDepth1) as any) | 0;
    }
    const renderCount = nearCnt + watermarkCount;
    const { bucketBits, bucketCnt } = getBucketCount(nearCnt);
    const depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    for (let i = 0, idx = 0; i < nearCnt; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0; // TODO
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < nearCnt; ++i) depthIndex[--counters[distances[i]]] = dataIdx1[i];
    return { renderCount, bucketBits };
}

/** 按相机方向（剔除相机背面数据提高渲染性能） */
function sortDirWithPrune2011(oArg: any) {
    const { depthIndex, depths, distances, counters, int32Tmp1: dataIdx1, xyz, dataCount, watermarkCount, minDepth, dotPos, sortCameraDir } = oArg;
    const maxDepth1 = Math.min(oArg.maxDepth, 0);
    let frontCnt = 0;
    for (let i = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        dataIdx1[frontCnt] = i;
        frontCnt += ((depths[i] <= 0) as any) | 0;
    }
    const renderCount = frontCnt + watermarkCount;
    const { bucketBits, bucketCnt } = getBucketCount(frontCnt);
    const depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth);
    for (let i = 0, idx = 0; i < frontCnt; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < frontCnt; ++i) depthIndex[--counters[distances[i]]] = dataIdx1[i];
    return { renderCount, bucketBits };
}

/** 按相机方向（剔除相机背面数据提高渲染性能，按近远分2段排序提高近处渲染质量） */
function sortDirWithPruneTwoSort2012(oArg: any) {
    // prettier-ignore
    const { depthIndex, depths, distances, counters, int32Tmp1: dataIdx1, int32Tmp2: dataIdx2, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir } = oArg;
    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = oArg.depthNearValue ? maxDepth1 - Math.abs(oArg.depthNearValue) : maxDepth1 - (maxDepth1 - minDepth) * oArg.depthNearRate;
    let cnt1 = 0;
    let cnt2 = 0;
    for (let i = 0, tag1 = 0, tag2 = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        dataIdx1[cnt1] = i;
        dataIdx2[cnt2] = i;
        tag1 = ((depths[i] <= 0 && depths[i] >= minDepth1) as any) | 0;
        tag2 = ((depths[i] < minDepth1) as any) | 0;
        cnt1 += tag1;
        cnt2 += tag2;
    }
    const renderCount = cnt1 + cnt2 + watermarkCount;
    let { bucketBits, bucketCnt } = getBucketCount(cnt2);
    let depthInv: number = (bucketCnt - 1) / (minDepth1 - minDepth);
    for (let i = 0, idx = 0; i < cnt2; ++i) {
        idx = ((depths[dataIdx2[i]] - minDepth) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt2; ++i) depthIndex[--counters[distances[i]]] = dataIdx2[i];
    counters.fill(0);
    bucketCnt = getBucketCount(cnt1).bucketCnt;
    depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    for (let i = 0, idx = 0; i < cnt1; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt1; ++i) depthIndex[--counters[distances[i]] + cnt2] = dataIdx1[i];
    return { renderCount, bucketBits };
}

/** 按相机方向（不剔除数据，按近远分2段排序提高近处渲染质量） */
function sortDirWithTwoSort2112(oArg: any) {
    // prettier-ignore
    const { depthIndex, depths, distances, counters, int32Tmp1: dataIdx1, int32Tmp2: dataIdx2, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir } = oArg;
    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = oArg.depthNearValue ? maxDepth1 - Math.abs(oArg.depthNearValue) : maxDepth1 - (maxDepth1 - minDepth) * oArg.depthNearRate;
    let cnt1 = 0;
    let cnt2 = 0;
    for (let i = 0, tag1 = 0; i < dataCount; ++i) {
        depths[i] = calcDepthByCameraDir(sortCameraDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], dotPos);
        dataIdx1[cnt1] = i;
        dataIdx2[cnt2] = i;
        tag1 = ((depths[i] <= 0 && depths[i] >= minDepth1) as any) | 0;
        cnt1 += tag1;
        cnt2 += tag1 ^ 1;
    }
    const renderCount = cnt1 + cnt2 + watermarkCount;
    let { bucketBits, bucketCnt } = getBucketCount(cnt2);
    let depthInv: number = (bucketCnt - 1) / (minDepth1 - minDepth);
    for (let i = 0, idx = 0; i < cnt2; ++i) {
        idx = ((depths[dataIdx2[i]] - minDepth) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt2; ++i) depthIndex[--counters[distances[i]]] = dataIdx2[i];
    counters.fill(0);
    bucketCnt = getBucketCount(cnt1).bucketCnt;
    depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    for (let i = 0, idx = 0; i < cnt1; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt1; ++i) depthIndex[--counters[distances[i]] + cnt2] = dataIdx1[i];
    return { renderCount, bucketBits };
}

/** 默认，按视图投影矩阵排序（全量渲染） */
function sortByViewProjDefault(oArg: any) {
    const { depthIndex, distances, counters, xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortViewProj } = oArg;
    const renderCount = dataCount + watermarkCount;
    let { bucketBits, bucketCnt } = getBucketCount(dataCount);
    let depthInv: number = (bucketCnt - 1) / (maxDepth - minDepth);
    for (let i = 0, idx = 0; i < dataCount; ++i) {
        idx = ((fnCalcDepth(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]) - minDepth) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < dataCount; ++i) depthIndex[--counters[distances[i]]] = i;
    return { renderCount, bucketBits };
}

/** 水印，按视图投影矩阵排序 */
function sortWatermark(oArg: any) {
    let { xyz, dataCount, watermarkCount, maxDepth, minDepth, sortViewProj, depthIndex } = oArg;
    const renderSplatCount = dataCount + watermarkCount;

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
        for (let i = 0; i < watermarkCount; ++i) depthIndex[dataCount + --counters[distances[i]]] = dataCount + i;
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
    const vertices = [
        [texture.minX, texture.minY, texture.minZ],
        [texture.minX, texture.minY, texture.maxZ],
        [texture.minX, texture.maxY, texture.minZ],
        [texture.minX, texture.maxY, texture.maxZ],
        [texture.maxX, texture.minY, texture.minZ],
        [texture.maxX, texture.minY, texture.maxZ],
        [texture.maxX, texture.maxY, texture.minZ],
        [texture.maxX, texture.maxY, texture.maxZ],
    ];
    for (const vertex of vertices) {
        const dep = fnDepth(viewProjOrCameraDir, vertex[0], vertex[1], vertex[2], dotPos);
        maxDepth = Math.max(maxDepth, dep);
        minDepth = Math.min(minDepth, dep);
    }
    return { maxDepth, minDepth };
}

const throttledSort = () => {
    if (!sortRunning) {
        sortRunning = true;
        const sortViewProj = viewProj;
        const sortCameraDir = cameraDir;
        const sortCameraPos = cameraPos;
        runSort(sortViewProj, sortCameraDir, sortCameraPos);
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

function poolSplatIndexPop(): Uint32Array {
    return splatIndexPool.pop() || new Uint32Array(maxRenderCount);
}

function poolSplatIndexPush(ui32s: Uint32Array) {
    ui32s.fill(0) && splatIndexPool.push(ui32s);
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
    } else if (data[WkSplatIndexDone]) {
        poolSplatIndexPush(data[WkSplatIndexDone] as Uint32Array);
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
