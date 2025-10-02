// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { WkInit, WkQualityLevel, WkUpdateParams, WkWatermarkCount } from '../utils/consts/WkConstants';
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
import { DefaultQualityLevel, isMobile, MaxQualityLevel, MinQualityLevel } from '../utils/consts/GlobalConstants';

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

let lastSortVersion: number = 0;
let isBigSceneMode: boolean;

function getBucketCount(splatCnt: number, isWatermark = false) {
    // 水印最高3级
    let level = isWatermark ? Math.min(3, qualityLevel) : qualityLevel;
    // 手机降低1级并控制不低于1级
    isMobile && (level = Math.max(level - 1, 1));
    // 最低1级12位4096，默认5级16位65536，最高9级20位1048576
    const cnt = 2 ** Math.max(12, Math.min(level + 11, Math.round(Math.log2(splatCnt / 2))));
    return cnt - 1;
}

function runSort(sortViewProj: number[]) {
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
                [WkRenderSplatCount]: renderSplatCount,
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
    const dataCount = renderSplatCount - watermarkCount;
    depthIndex = new Uint32Array(renderSplatCount);
    const { maxDepth, minDepth } = getDepth(texture, viewProj);
    if (maxDepth - minDepth <= 0.00001) {
        for (let i = 0; i < renderSplatCount; i++) depthIndex[i] = i;
    } else {
        // 数据
        let bucketCnt = getBucketCount(dataCount);
        console.info('bucketCnt', bucketCnt);
        let depthInv: number = (bucketCnt - 1) / (maxDepth - minDepth);
        let counters: Int32Array = new Int32Array(bucketCnt);
        for (let i = 0, idx = 0; i < dataCount; i++) {
            idx = ((computeDepth(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]) - minDepth) * depthInv) | 0;
            counters[(distances[i] = idx)]++;
        }
        for (let i = 1; i < bucketCnt; i++) counters[i] += counters[i - 1];
        for (let i = 0; i < dataCount; i++) depthIndex[--counters[distances[i]]] = i;

        // 水印
        if (watermarkCount) {
            bucketCnt = getBucketCount(dataCount, true);
            depthInv = (bucketCnt - 1) / (maxDepth - minDepth);
            counters = new Int32Array(bucketCnt);
            for (let i = dataCount, idx = 0; i < renderSplatCount; i++) {
                idx = ((computeDepth(sortViewProj, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]) - minDepth) * depthInv) | 0;
                counters[(distances[i - dataCount] = idx)]++;
            }
            for (let i = 1; i < bucketCnt; i++) counters[i] += counters[i - 1];
            for (let i = 0; i < watermarkCount; i++) depthIndex[dataCount + --counters[distances[i]]] = dataCount + i;
        }
    }

    sortTime = Date.now() - startTime;
    worker.postMessage(
        {
            [WkSplatIndex]: depthIndex,
            [WkRenderSplatCount]: renderSplatCount,
            [WkVisibleSplatCount]: visibleSplatCount,
            [WkModelSplatCount]: modelSplatCount,
            [WkIndex]: index,
            [WkVersion]: version,
            [WkSortStartTime]: startTime,
            [WkSortTime]: sortTime,
        },
        [depthIndex.buffer],
    );
}

function computeDepth(svp: number[], x: number, y: number, z: number): number {
    // return (svp[2] * x + svp[6] * y + svp[10] * z) * -4096;
    return -(svp[2] * x + svp[6] * y + svp[10] * z);
    // return -(svp[2] * x + svp[6] * y + svp[10] * z + svp[14]);
}

function getDepth(texture: SplatTexdata, sortViewProj: number[]): any {
    let maxDepth = -Infinity;
    let minDepth = Infinity;
    let dep = 0;
    dep = computeDepth(sortViewProj, texture.minX, texture.minY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = computeDepth(sortViewProj, texture.minX, texture.minY, texture.maxZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = computeDepth(sortViewProj, texture.minX, texture.maxY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = computeDepth(sortViewProj, texture.minX, texture.maxY, texture.maxZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = computeDepth(sortViewProj, texture.maxX, texture.minY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = computeDepth(sortViewProj, texture.maxX, texture.minY, texture.maxZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = computeDepth(sortViewProj, texture.maxX, texture.maxY, texture.minZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    dep = computeDepth(sortViewProj, texture.maxX, texture.maxY, texture.maxZ);
    maxDepth = Math.max(maxDepth, dep);
    minDepth = Math.min(minDepth, dep);
    return { maxDepth, minDepth };
}

const throttledSort = () => {
    if (!sortRunning) {
        sortRunning = true;
        const sortViewProj = viewProj;
        runSort(sortViewProj);
        setTimeout(() => !(sortRunning = false) && sortViewProj !== viewProj && throttledSort());
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
        viewProj = data[WkViewProjection];
        throttledSort();
    } else if (data[WkUpdateParams]) {
        qualityLevel = Math.max(MinQualityLevel, Math.min(data[WkQualityLevel] || DefaultQualityLevel, MaxQualityLevel)); // 限制1~9,默认5
    } else if (data[WkInit]) {
        isBigSceneMode = data[WkIsBigSceneMode];
        distances = new Int32Array(data[WkMaxRenderCount]);
        qualityLevel = Math.max(MinQualityLevel, Math.min(data[WkQualityLevel] || DefaultQualityLevel, MaxQualityLevel)); // 限制1~9,默认5
        isSorterReady = true;
    }
};
