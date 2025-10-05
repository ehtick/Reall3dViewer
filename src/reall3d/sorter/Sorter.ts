// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    WkBucketBits,
    WkCameraDirection,
    WkCameraPosition,
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

let sortRunning: boolean;
let Epsilon: number = isMobile ? 0.5 : 0.2;
let viewProj: number[];
let lastViewProj: number[] = [];
let distances: Int32Array;
let depths: number[] = [];
let cameraDir: number[];
let cameraPos: number[];
let sortType: number = SortTypes.Default;
// let lastCameraDir: number[];
// let lastCameraPos: number[];

let lastSortVersion: number = 0;
let isBigSceneMode: boolean;

function getBucketCount(splatCnt: number, useLevel: number = 0) {
    // 水印等情景允许通过参数指定级别
    let level = useLevel ? Math.min(useLevel, qualityLevel) : qualityLevel;
    // 手机降低1级并控制不低于1级
    isMobile && (level = Math.max(level - 1, 1));
    // 按级别，最低1级12位4096，默认5级16位65536，最高9级20位1048576。数据很少时也确保8位256个桶
    const bucketBits = Math.max(8, Math.min(level + 11, Math.round(Math.log2(splatCnt / 4))));
    const bucketCnt = 2 ** bucketBits;
    return { bucketBits, bucketCnt };
}

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
    // lastCameraDir = sortCameraDir;
    // lastCameraPos = cameraPos;

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

    let { maxDepth, minDepth } = calcMinMaxDepth(texture, sortVpOrDir, fnCalcDepth);
    if (maxDepth - minDepth <= 0.00001) {
        // 都挤一起了没必要排序
        depthIndex = new Uint32Array(renderSplatCount);
        for (let i = 0; i < dataCount; i++) depthIndex[i] = i;
    } else if (sortType === SortTypes.DirWithPruneTwoSort) {
        // 按相机方向（剔除相机背面数据提高渲染性能，按近远分2段排序提高近处渲染质量）
        ({ depthIndex, bucketBits } = sortDirWithPruneTwoSort({ xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir }));
    } else if (sortType === SortTypes.DirWithPruneOnlyNear) {
        // 按相机方向（剔除背后和远端数据，仅留近端数据提高渲染性能）
        ({ depthIndex, bucketBits } = sortDirWithPruneOnlyNear({ xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir }));
    } else if (sortType === SortTypes.DirWithPrune) {
        // 按相机方向（剔除相机背面数据提高渲染性能）
        ({ depthIndex, bucketBits } = sortDirWithPrune({ xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir }));
    } else if (sortType === SortTypes.DirWithTwoSort) {
        // 按相机方向（按近远分2段排序提高近处渲染质量）
        ({ depthIndex, bucketBits } = sortDirWithTwoSort({ xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir }));
    } else {
        // 默认，按视图投影矩阵排序（全量渲染）
        ({ depthIndex, bucketBits } = sortByViewProjDefault({ xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir }));
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
            [WkBucketBits]: bucketBits,
            [WkSortType]: sortType,
        },
        [depthIndex.buffer],
    );
}

/** 按相机方向（剔除相机背面数据提高渲染性能，按近远分2段排序提高近处渲染质量） */
function sortDirWithPruneTwoSort(oArg: any) {
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir } = oArg;

    // console.time('深度计算');
    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = minDepth * 0.01; // TODO 此处比例系数有待商酌，或者考虑可配置化
    const maxDepth2 = minDepth1;
    const minDepth2 = minDepth;
    const tags = new Uint8Array(dataCount);
    const cnts = [0, 0, 0];
    for (let i = 0; i < dataCount; ++i) {
        depths[i] = fnCalcDepth(sortVpOrDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]);
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
    const cnt = cnt1 + cnt2 + watermarkCount;
    const depthIndex = new Uint32Array(cnt);
    let { bucketBits, bucketCnt } = getBucketCount(cnt2);
    let depthInv: number = (bucketCnt - 1) / (maxDepth2 - minDepth2);
    let counters: Int32Array = new Int32Array(bucketCnt);
    distances = new Int32Array(cnt2);
    for (let i = 0, idx = 0; i < cnt2; ++i) {
        idx = ((depths[dataIdx2[i]] - minDepth2) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt2; ++i) depthIndex[--counters[distances[i]]] = dataIdx2[i];
    // console.timeEnd('远端排序');
    // 近端排序
    // console.time('近端排序');
    bucketCnt = getBucketCount(cnt1).bucketCnt;
    depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    counters = new Int32Array(bucketCnt);
    distances = new Int32Array(cnt1);
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
function sortDirWithPruneOnlyNear(oArg: any) {
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir } = oArg;

    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = minDepth * 0.01; // TODO 此处比例系数有待商酌，或者考虑可配置化
    const tags = new Uint8Array(dataCount);
    let nearCnt = 0;
    for (let i = 0, idx = 0; i < dataCount; ++i) {
        depths[i] = fnCalcDepth(sortVpOrDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]);
        tags[i] = ((depths[i] < 0 && depths[i] >= minDepth1) as any) | 0;
        nearCnt += tags[i];
    }
    // 分段
    const dataIdx1 = new Uint32Array(nearCnt);
    const fns = [() => {}, (i: number, v: number) => (dataIdx1[i] = v)];
    const idxs: number[] = [0, 0];
    for (let i = 0; i < dataCount; ++i) fns[tags[i]](idxs[tags[i]]++, i);
    const depthIndex = new Uint32Array(nearCnt + watermarkCount);
    // 近端排序
    let { bucketBits, bucketCnt } = getBucketCount(nearCnt);
    let depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    let counters = new Int32Array(bucketCnt);
    distances = new Int32Array(nearCnt);
    for (let i = 0, idx = 0; i < nearCnt; ++i) {
        idx = ((depths[dataIdx1[i]] - minDepth1) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < nearCnt; ++i) depthIndex[--counters[distances[i]]] = dataIdx1[i];

    return { depthIndex, bucketBits };
}

/** 按相机方向（剔除相机背面数据提高渲染性能） */
function sortDirWithPrune(oArg: any) {
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir } = oArg;

    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = minDepth;
    const tags = new Uint8Array(dataCount);
    let frontCnt = 0;
    for (let i = 0, idx = 0; i < dataCount; ++i) {
        depths[i] = fnCalcDepth(sortVpOrDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]);
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
    let counters = new Int32Array(bucketCnt);
    distances = new Int32Array(frontCnt);
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
    // let counters: Int32Array = new Int32Array(bucketCnt);
    // const tags = new Uint8Array(dataCount);
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

/** 按相机方向（剔除相机背面数据提高渲染性能） */
function sortDirWithTwoSort(oArg: any) {
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir } = oArg;

    const maxDepth1 = Math.min(maxDepth, 0);
    const minDepth1 = minDepth * 0.01; // TODO 此处比例系数有待商酌，或者考虑可配置化
    const tags = new Uint8Array(dataCount);
    let nearCnt = 0;
    for (let i = 0, idx = 0; i < dataCount; ++i) {
        depths[i] = fnCalcDepth(sortVpOrDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]);
        tags[i] = ((depths[i] < 0 && depths[i] >= minDepth1) as any) | 0;
        nearCnt += tags[i];
    }
    // 分段
    const cnt2 = dataCount - nearCnt;
    const dataIdx1 = new Uint32Array(nearCnt);
    const dataIdx2 = new Uint32Array(cnt2);
    const fns = [(i: number, v: number) => (dataIdx2[i] = v), (i: number, v: number) => (dataIdx1[i] = v)];
    const idxs: number[] = [0, 0];
    for (let i = 0; i < dataCount; ++i) fns[tags[i]](idxs[tags[i]]++, i);
    const depthIndex = new Uint32Array(dataCount + watermarkCount);
    // 远端排序
    let { bucketBits, bucketCnt } = getBucketCount(cnt2);
    let depthInv: number = (bucketCnt - 1) / (maxDepth - minDepth);
    let counters: Int32Array = new Int32Array(bucketCnt);
    distances = new Int32Array(cnt2);
    for (let i = 0, idx = 0; i < cnt2; ++i) {
        idx = ((depths[dataIdx2[i]] - minDepth) * depthInv) | 0;
        counters[(distances[i] = idx)]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < cnt2; ++i) depthIndex[--counters[distances[i]]] = dataIdx2[i];
    // 近端排序
    bucketCnt = getBucketCount(nearCnt).bucketCnt; // 按配置级别
    depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    counters = new Int32Array(bucketCnt);
    distances = new Int32Array(nearCnt);
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
    const { xyz, dataCount, watermarkCount, maxDepth, minDepth, fnCalcDepth, sortVpOrDir } = oArg;

    const depthIndex = new Uint32Array(dataCount + watermarkCount);
    let { bucketBits, bucketCnt } = getBucketCount(dataCount);
    let depthInv: number = (bucketCnt - 1) / (maxDepth - minDepth);
    let counters: Int32Array = new Int32Array(bucketCnt);
    for (let i = 0, idx = 0; i < dataCount; ++i) {
        idx = ((fnCalcDepth(sortVpOrDir, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]) - minDepth) * depthInv) | 0;
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

    let bucketCnt = getBucketCount(watermarkCount, 1).bucketCnt; // 水印数据很少精度要求低，按最低1级计算，范围值重新计算避免太大误差
    // TODO 考虑传入包围盒点进行计算
    maxDepth = minDepth = calcDepthByViewProj(sortViewProj, xyz[3 * dataCount], xyz[3 * dataCount + 1], xyz[3 * dataCount + 2]);
    for (let i = dataCount, dpt = 0; i < renderSplatCount; i++) {
        dpt = calcDepthByViewProj(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]);
        maxDepth = Math.max(dpt, maxDepth);
        minDepth = Math.min(dpt, minDepth);
    }

    if (maxDepth - minDepth <= 0.00001) {
        for (let i = 0; i < watermarkCount; i++) depthIndex[dataCount + i] = dataCount + i;
    } else {
        let depthInv = (bucketCnt - 1) / (maxDepth - minDepth);
        let counters = new Int32Array(bucketCnt);
        for (let i = dataCount, idx = 0; i < renderSplatCount; i++) {
            idx = ((calcDepthByViewProj(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]) - minDepth) * depthInv) | 0;
            counters[(distances[i - dataCount] = idx)]++;
        }
        for (let i = 1; i < bucketCnt; i++) counters[i] += counters[i - 1];
        for (let i = 0; i < watermarkCount; i++) depthIndex[dataCount + --counters[distances[i]]] = dataCount + i;
    }
}

function calcDepthByViewProj(svp: number[], x: number, y: number, z: number): number {
    return svp[2] * x + svp[6] * y + svp[10] * z; // 默认质量级别及以下时使用
}
function calcDepthByViewProjPlus(svp: number[], x: number, y: number, z: number): number {
    return svp[2] * x + svp[6] * y + svp[10] * z + svp[14]; // 高于默认级别时使用
}
function calcDepthByCameraDir(dir: number[], x: number, y: number, z: number): number {
    return dir[0] * (cameraPos[0] - x) + dir[1] * (cameraPos[1] - y) + dir[2] * (cameraPos[2] - z); // 大于0为在相机背后
}

function calcMinMaxDepth(texture: SplatTexdata, viewProjOrCameraDir: number[], fnDepth: Function): any {
    let maxDepth = -Infinity;
    let minDepth = Infinity;
    let dep = 0;
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.minY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.minY, texture.maxZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.maxY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.minX, texture.maxY, texture.maxZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.minY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.minY, texture.maxZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.maxY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = fnDepth(viewProjOrCameraDir, texture.maxX, texture.maxY, texture.maxZ);
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
    } else if (data[WkInit]) {
        isBigSceneMode = data[WkIsBigSceneMode];
        distances = new Int32Array(data[WkMaxRenderCount]);
        qualityLevel = Math.max(MinQualityLevel, Math.min(data[WkQualityLevel] || DefaultQualityLevel, MaxQualityLevel)); // 限制1~9,默认5
        sortType = data[WkSortType] || sortType;
        isSorterReady = true;
    }
};
