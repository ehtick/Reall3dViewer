// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Plane, Vector3, Vector4 } from 'three';
import {
    OnFetchStart,
    SplatTexdataManagerDispose,
    SplatTexdataManagerAddModel,
    GetMaxRenderCount,
    SplatMeshCycleZoom,
    SplatTexdataManagerDataChanged,
    OnFetching,
    OnFetchStop,
    Information,
    IsBigSceneMode,
    SetGaussianText,
    GetGaussianText,
    RunLoopByFrame,
    UploadSplatTexture,
    SplatUpdateTopY,
    GetSplatActivePoints,
    GetOptions,
    StopAutoRotate,
    GetShTexheight,
    SplatUpdateSh12Texture,
    SplatUpdateSh3Texture,
    GetModelShDegree,
    SplatUpdateShDegree,
    GetAabbCenter,
    UploadSplatTextureDone,
    GetViewProjectionMatrix,
    GetCameraPosition,
    GetCameraLookAt,
    IsCameraChangedNeedUpdate,
    SplatUpdateBoundBox,
    SplatUpdateMaxRadius,
    SplatUpdatePerformanceAct,
    SplatUpdatePointMode,
    OnSmallSceneShowDone,
    SplatUpdateParticleMode,
    SplatUpdateShPalettesTexture,
    ComputeTextureWidthHeight,
    Flying,
    SplatUpdateUseLod,
    SplatTexdataManagerAddSplatLod,
    UpdateFetchStatus,
} from '../events/EventConstants';
import { Events } from '../events/Events';
import { CutData, ModelStatus, SplatModel } from './ModelData';
import { ModelOptions } from './ModelOptions';
import { loadPly } from './loaders/PlyLoader';
import { loadSplat } from './loaders/SplatLoader';
import { loadSpx } from './loaders/SpxLoader';
import { loadSpz } from './loaders/SpzLoader';
import { computeSplatNodeCameraDistance, extractFrustumPlanes, isInverted, isNeedReload } from '../utils/CommonUtils';
import { SplatMeshOptions } from '../meshs/splatmesh/SplatMeshOptions';
import {
    BlankingTimeOfLargeScene,
    BlankingTimeOfSmallScene,
    isMobile,
    MobileDownloadLimitSplatCount,
    PcDownloadLimitSplatCount,
} from '../utils/consts/GlobalConstants';
import { loadSog } from './loaders/SogLoader';
import { setupLodDownloadManager, todoDownload } from './LodDownloadManager';
import { SplatFile, SplatTiles, SplatTileNode, DataStatus, traveSplatTree } from './SplatTiles';
import { hashString } from 'three/src/nodes/core/NodeUtils.js';
import { loadLodSplatFile } from './loaders/LodSplatFileLoader';
import { MetaData } from './MetaData';

/**
 * 纹理数据管理
 */
export function setupSplatTextureManager(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let disposed: boolean;
    let lastPostDataTime: number = Date.now() + 60 * 60 * 1000;

    let runCounter = 0;
    let flyOnceDone = false;
    let lastLodHash: number = 0;

    let textWatermarkData: Uint8Array = null; // 水印数据
    let splatModel: SplatModel;
    let texture0: SplatTexdata = { index: 0, version: 0, activeTime: 0 };
    let texture1: SplatTexdata = { index: 1, version: 0, activeTime: 0 };
    let mergeRunning: boolean = false;
    const isBigSceneMode: boolean = fire(IsBigSceneMode);
    let initBoundBox: boolean = false;
    let performanceStart = 0; // 小场景粒子加载效果使用
    let palettesUpdated = false;
    let largeSceneStartFly = false;
    const frustumPlanes = new Array(6).fill(null).map(() => new Plane());

    on(GetAabbCenter, () => splatModel?.aabbCenter || new Vector3());

    let fnResolveModelSplatCount: (value: unknown) => void;
    const promiseModelSplatCount: Promise<number> = new Promise(resolve => (fnResolveModelSplatCount = resolve));
    on(GetMaxRenderCount, async (): Promise<number> => {
        const opts: SplatMeshOptions = fire(GetOptions);
        let rs = isMobile ? opts.maxRenderCountOfMobile : opts.maxRenderCountOfPc;
        if (!opts.bigSceneMode) {
            let modelCnt = await promiseModelSplatCount;
            rs = Math.min(modelCnt, rs) + 10240; // 小场景如果模型数据点数小于最大渲染数，用模型数据点数计算以节省内存，10240为预留的动态文字水印数
        }
        return rs;
    });

    on(GetShTexheight, async (shDegree: number, texwidth: number): Promise<number> => {
        const opts: SplatMeshOptions = fire(GetOptions);
        if (opts.bigSceneMode) return 1; // 大场景不支持

        let cnt = isMobile ? opts.maxRenderCountOfMobile : opts.maxRenderCountOfPc;
        let modelCnt = await promiseModelSplatCount;
        cnt = Math.min(modelCnt, cnt);

        if (!splatModel.dataShDegree) return 1; // splat
        if (shDegree >= 3) {
            if (splatModel.dataShDegree < 3) return 1; // 无SH3数据
        } else if (shDegree >= 1) {
            if (splatModel.dataShDegree < 1) return 1; // 无SH12数据
        } else {
            return 1;
        }

        const texheight = Math.ceil(cnt / texwidth);
        return texheight;
    });

    on(GetModelShDegree, async (): Promise<number> => {
        await promiseModelSplatCount;
        return splatModel.dataShDegree;
    });

    on(SetGaussianText, async (text: string, isY: boolean = true) => {
        try {
            await promiseModelSplatCount;
            const isNgativeY = isInverted(splatModel.header); // 是否倒立（superedit打开呈现倒立）
            textWatermarkData = await fire(GetGaussianText, text, isY, isNgativeY, splatModel.opts.format);
            splatModel && (splatModel.textWatermarkVersion = Date.now());
        } catch (e) {
            console.info('failed to generate watermark');
        }
    });

    on(UploadSplatTextureDone, (index: number) => {
        if (isBigSceneMode) {
            if (index) {
                !texture1.active && (texture1.activeTime = Date.now());
                texture1.active = true;
            } else {
                !texture0.active && (texture0.activeTime = Date.now());
                texture0.active = true;
            }
        }
    });

    on(GetSplatActivePoints, () => {
        // 大场景按动态计算
        if (isBigSceneMode) return texture0.version <= texture1.version ? texture0.xyz : texture1.xyz;

        // 小场景下载完成后按分块
        if (splatModel?.status === ModelStatus.FetchDone || splatModel?.status === ModelStatus.FetchAborted) {
            if (splatModel.activePoints && splatModel.activePoints.length === undefined) return splatModel.activePoints;
            const obj = {};
            const xyzs: Float32Array = texture0.xyz;
            for (let i = 0, count = xyzs.length / 3, x = 0, y = 0, z = 0, key = ''; i < count; i++) {
                x = xyzs[i * 3];
                y = xyzs[i * 3 + 1];
                z = xyzs[i * 3 + 2];
                key = `${Math.floor(x / 2) * 2 + 1},${Math.floor(y / 2) * 2 + 1},${Math.floor(z / 2) * 2 + 1}`;
                (obj[key] = obj[key] || []).push(x, y, z);
            }
            return (splatModel.activePoints = obj);
        }

        // 小场景没下载完，不分块
        return texture0.xyz;
    });

    async function mergeAndUploadData(isBigSceneMode: boolean) {
        if (disposed) return;

        if (splatModel?.splatTiles) {
            // 调色板
            if (!palettesUpdated && splatModel.palettes) {
                fire(SplatUpdateShPalettesTexture, splatModel.palettes);
                fire(SplatUpdateShDegree, splatModel.dataShDegree);
                palettesUpdated = true;
            }

            if (mergeRunning) return;
            mergeRunning = true;
            setTimeout(async () => {
                await mergeAndUploadLodLargeSceneData();
                checkLodCache();
                mergeRunning = false;
            });
            return;
        }

        if (splatModel && (splatModel.status === ModelStatus.Invalid || splatModel.status === ModelStatus.FetchFailed)) {
            (fire(GetOptions) as SplatMeshOptions).viewerEvents?.fire(StopAutoRotate);
            return fire(OnFetchStop, 0) || fire(Information, { renderSplatCount: 0, visibleSplatCount: 0, modelSplatCount: 0 }); // 无效
        }
        if (!splatModel || !splatModel.downloadSize) return; // 尚未下载

        const downloadDone = splatModel.status !== ModelStatus.FetchReady && splatModel.status !== ModelStatus.Fetching;
        updateBoundBox(downloadDone);
        if (downloadDone) {
            // 已下载完，通知一次进度条
            const downloadCount = Math.min(splatModel.fetchLimit, splatModel.downloadSplatCount);
            downloadCount && !splatModel.notifyFetchStopDone && (splatModel.notifyFetchStopDone = true) && fire(OnFetchStop, downloadCount);
        } else {
            // 没下载完，更新下载进度条
            fire(OnFetching, (100 * splatModel.downloadSize) / splatModel.fileSize);
        }

        if (!splatModel.dataSplatCount) return; // 尚无高斯数据

        // 调色板
        if (!palettesUpdated && splatModel.palettes) {
            fire(SplatUpdateShPalettesTexture, splatModel.palettes);
            palettesUpdated = true;
        }

        if (mergeRunning) return;
        mergeRunning = true;
        setTimeout(async () => {
            isBigSceneMode ? await mergeAndUploadLargeSceneData(downloadDone) : await mergeAndUploadSmallSceneData(downloadDone);
            mergeRunning = false;
        });
    }

    async function mergeAndUploadSmallSceneData(downloadDone: boolean) {
        if (disposed) return;
        const texture = texture0;
        const maxRenderCount = await fire(GetMaxRenderCount);

        const txtWatermarkData = textWatermarkData;
        let dataSplatCount = splatModel.dataSplatCount;
        let watermarkCount = downloadDone ? splatModel.watermarkCount : 0;
        let textWatermarkCount = splatModel.meta.showWatermark && downloadDone ? (txtWatermarkData?.byteLength || 0) / 32 : 0; // 动态输入的文字水印数
        splatModel.renderSplatCount = dataSplatCount + watermarkCount + textWatermarkCount; // 渲染数

        if (splatModel.renderSplatCount >= maxRenderCount) {
            // 中断下载等特殊情况
            splatModel.renderSplatCount = maxRenderCount;
            watermarkCount = 0;
            textWatermarkCount = 0;
            dataSplatCount > maxRenderCount && (dataSplatCount = maxRenderCount);
        }

        fire(Information, { visibleSplatCount: splatModel.renderSplatCount, modelSplatCount: splatModel.modelSplatCount + textWatermarkCount }); // 可见数=模型数据总点数

        if (Date.now() - texture.textureReadyTime < BlankingTimeOfSmallScene) return;
        if (splatModel.smallSceneUploadDone && splatModel.lastTextWatermarkVersion == splatModel.textWatermarkVersion) return; // 已传完(模型数据 + 动态文字水印)

        if (!texture.version) {
            fire(SplatUpdateTopY, (isInverted(splatModel.header) ? splatModel.header.MaxTopY : splatModel.header?.MinTopY) || 0); // 初次传入高点

            let ver: string = splatModel.opts.format;
            let ratio = '　';
            if (splatModel.opts.format == 'spx') {
                ver = 'spx v' + splatModel.header.Version + (splatModel.header.ExclusiveId ? (', ' + splatModel.header.ExclusiveId).substring(0, 5) : '');
                ratio += splatModel.CompressionRatio;
            } else if (splatModel.opts.format == 'spz') {
                ver = 'spz v' + splatModel.spzVersion;
                ratio += splatModel.CompressionRatio;
            } else if (splatModel.opts.format == 'sog') {
                ver = 'sog v' + splatModel.sogVersion;
                ratio += splatModel.CompressionRatio;
            } else if (splatModel.opts.format == 'splat') {
                ratio += splatModel.CompressionRatio;
            }
            const size = '　' + (splatModel.fileSize / 1024 / 1024).toFixed(1) + 'M';
            fire(Information, { scene: `small (${ver}) ${ratio}${size}` }); // 初次提示场景模型版本
        }

        splatModel.lastTextWatermarkVersion = splatModel.textWatermarkVersion;
        texture.textureReady = false;

        // 合并（模型数据 + 动态文字水印）
        const { texwidth, texheight } = fire(ComputeTextureWidthHeight, maxRenderCount);
        const ui32s = new Uint32Array(texwidth * texheight * 4);
        const f32s = new Float32Array(ui32s.buffer);
        const mergeSplatData = new Uint8Array(ui32s.buffer);
        mergeSplatData.set(splatModel.splatData.subarray(0, dataSplatCount * 32), 0);
        watermarkCount && mergeSplatData.set(splatModel.watermarkData.subarray(0, watermarkCount * 32), dataSplatCount * 32);
        textWatermarkCount && mergeSplatData.set(txtWatermarkData.subarray(0, textWatermarkCount * 32), (dataSplatCount + watermarkCount) * 32);

        const xyz = new Float32Array(splatModel.renderSplatCount * 3);
        for (let i = 0, n = 0; i < splatModel.renderSplatCount; i++) {
            xyz[i * 3] = f32s[i * 8];
            xyz[i * 3 + 1] = f32s[i * 8 + 1];
            xyz[i * 3 + 2] = f32s[i * 8 + 2];
        }

        const sysTime = Date.now();
        texture.version = sysTime;
        texture.txdata = ui32s;
        texture.xyz = xyz;
        texture.renderSplatCount = splatModel.renderSplatCount;
        texture.visibleSplatCount = splatModel.downloadSplatCount + textWatermarkCount;
        texture.modelSplatCount = splatModel.downloadSplatCount + textWatermarkCount;
        texture.watermarkCount = watermarkCount + textWatermarkCount;
        texture.minX = splatModel.minX;
        texture.maxX = splatModel.maxX;
        texture.minY = splatModel.minY;
        texture.maxY = splatModel.maxY;
        texture.minZ = splatModel.minZ;
        texture.maxZ = splatModel.maxZ;

        if (splatModel.meta.particleMode && !performanceStart) {
            performanceStart = performance.now();
            fire(SplatUpdatePerformanceAct, performanceStart);
            fire(SplatUpdatePointMode, false); // 小场景粒子效果时，固定不用点云
            fire(SplatUpdateParticleMode, 1); // 粒子加载效果
        }
        splatModel.maxRadius && fire(SplatUpdateMaxRadius, splatModel.maxRadius);
        fire(UploadSplatTexture, texture, splatModel.currentRadius, splatModel.currentRadius);
        lastPostDataTime = sysTime;

        if (downloadDone && !splatModel.smallSceneUploadDone) {
            splatModel.smallSceneUploadDone = true;
            fire(SplatUpdateSh12Texture, splatModel.sh12Data);
            fire(SplatUpdateSh3Texture, splatModel.sh3Data);
            splatModel.sh12Data = null;
            splatModel.sh3Data = null;
            const opts: SplatMeshOptions = fire(GetOptions);
            fire(SplatUpdateShDegree, opts.shDegree === undefined ? 3 : opts.shDegree);
            fire(GetSplatActivePoints); // 小场景下载完时主动触发一次坐标分块

            if (splatModel.meta.particleMode) {
                // 粒子效果，先5秒加载过程，后5秒正常化过程
                setTimeout(() => {
                    fire(SplatUpdatePerformanceAct, performance.now() + 5000); // 后5秒正常化过程
                    fire(SplatUpdateParticleMode, 2); // 逐渐变化到正常
                    setTimeout(() => fire(OnSmallSceneShowDone, true), 5000); // 显示完成后期处理
                }, Math.max(5000 + performanceStart - performance.now(), 0)); // 先5秒加载过程
            }
        }
        fire(Information, { renderSplatCount: splatModel.renderSplatCount });
    }

    async function mergeAndUploadLargeSceneData(downloadDone: boolean) {
        if (disposed) return;

        if (downloadDone && !largeSceneStartFly) {
            largeSceneStartFly = true;
            (fire(GetOptions) as SplatMeshOptions).viewerEvents?.fire(Flying, true);
            fire(SplatUpdateUseLod, splatModel.header.Lod > 0);
        }

        const maxRenderCount = await fire(GetMaxRenderCount);
        const { texwidth, texheight } = fire(ComputeTextureWidthHeight, maxRenderCount);
        const txtWatermarkData = textWatermarkData;
        const watermarkCount = 0; // model.watermarkCount; // 待合并的水印数（模型数据部分）
        const textWatermarkCount = (txtWatermarkData?.byteLength || 0) / 32; // 待合并的水印数（可动态变化的文字水印部分）
        const maxDataMergeCount = maxRenderCount - watermarkCount - textWatermarkCount; // 最大数据合并点数

        fire(Information, { modelSplatCount: splatModel.downloadSplatCount + textWatermarkCount });

        let texture: SplatTexdata = texture0.version <= texture1.version ? texture0 : texture1;
        if (texture0.version && ((!texture.index && !texture1.active) || (texture.index && !texture0.active))) return; // 待渲染
        if (Date.now() - texture.activeTime < BlankingTimeOfLargeScene) return;

        if (downloadDone) {
            // 文件下载完，相机没有变化，不必重复刷数据
            const ve = (fire(GetOptions) as SplatMeshOptions).viewerEvents;
            if (ve && !ve.fire(IsCameraChangedNeedUpdate)) return;
        }

        if (!texture.version) {
            let ver: string = splatModel.opts.format;
            let ratio = '　';
            if (splatModel.opts.format == 'spx') {
                ver = 'spx' + (splatModel.header.ExclusiveId ? (' ' + splatModel.header.ExclusiveId).substring(0, 6) : '');
                ratio += splatModel.CompressionRatio;
            }
            const size = '　' + (splatModel.fileSize / 1024 / 1024).toFixed(1) + 'M';
            fire(Information, { scene: `large (${ver}) ${ratio}${size}` }); // 初次提示场景模型版本
        }

        const sysTime = Date.now();
        texture.version = sysTime;
        texture.active = false;

        // 计算合并
        let currentTotalVisibleCnt = 0; // 当前可见块的总数据点数
        const cuts: CutData[] = [];
        const viewProjMatrix: Matrix4 = fire(GetViewProjectionMatrix);
        const cameraPosition: Vector3 = fire(GetCameraPosition);
        const cameraTarget: Vector3 = fire(GetCameraLookAt);
        for (const cut of splatModel.map.values()) {
            if (checkCutDataVisible(viewProjMatrix, cameraPosition, cameraTarget, cut)) {
                cuts.push(cut);
                cut.currentRenderCnt = cut.splatCount;
                currentTotalVisibleCnt += cut.splatCount;
            }
        }

        fire(Information, { cuts: `${cuts.length} / ${splatModel.map.size}` });

        const perLimit = Math.min(maxDataMergeCount / currentTotalVisibleCnt, 1); // 最大不超100%
        if (perLimit > 0.95) {
            // 最大合并数占比大于95%时按比例简化概算
            for (const cut of cuts) cut.currentRenderCnt = (cut.splatCount * perLimit) | 0;
        } else {
            // 占比较小时按距离计算
            cuts.sort((a, b) => a.distance - b.distance);
            // 微调
            for (const cut of cuts) {
                if (cut.distance < 5) {
                    cut.distance *= 0.5;
                } else if (cut.distance < 4) {
                    cut.distance *= 0.4;
                } else if (cut.distance < 3) {
                    cut.distance *= 0.3;
                } else if (cut.distance < 2) {
                    cut.distance *= 0.1;
                }
            }
            // 分配
            allocatePoints(cuts, maxDataMergeCount);

            // 检查、调整
            let totalCurrentRenderCnt = 0;
            for (let cut of cuts) totalCurrentRenderCnt += cut.currentRenderCnt;

            if (totalCurrentRenderCnt > maxDataMergeCount) {
                // 检查
                let delCnt = totalCurrentRenderCnt - maxDataMergeCount;
                for (let i = cuts.length - 1; i >= 0; i--) {
                    if (delCnt <= 0) break;
                    const cut = cuts[i];
                    if (cut.currentRenderCnt >= delCnt) {
                        cut.currentRenderCnt -= delCnt;
                        delCnt = 0;
                    } else {
                        delCnt -= cut.currentRenderCnt;
                        cut.currentRenderCnt = 0;
                    }
                }
            } else if (totalCurrentRenderCnt < maxDataMergeCount) {
                // 调整
                let addCnt = maxDataMergeCount - totalCurrentRenderCnt;
                for (let i = 0; i < cuts.length; i++) {
                    if (addCnt <= 0) break;
                    let cut = cuts[i];
                    if (cut.splatCount > cut.currentRenderCnt) {
                        if (cut.splatCount - cut.currentRenderCnt >= addCnt) {
                            cut.currentRenderCnt += addCnt;
                            addCnt = 0;
                        } else {
                            const add = cut.splatCount - cut.currentRenderCnt;
                            cut.currentRenderCnt += add;
                            addCnt -= add;
                        }
                    }
                }
            }
        }

        // 合并
        const ui32s = new Uint32Array(texwidth * texheight * 4);
        const f32s = new Float32Array(ui32s.buffer);
        const mergeSplatData = new Uint8Array(ui32s.buffer);
        let mergeDataCount = 0;
        for (let cut of cuts) {
            mergeSplatData.set(cut.splatData.subarray(0, cut.currentRenderCnt * 32), mergeDataCount * 32);
            mergeDataCount += cut.currentRenderCnt;
        }
        if (watermarkCount) {
            mergeSplatData.set(splatModel.watermarkData.subarray(0, watermarkCount * 32), mergeDataCount * 32);
        }
        if (textWatermarkCount) {
            mergeSplatData.set(txtWatermarkData.subarray(0, textWatermarkCount * 32), (mergeDataCount + watermarkCount) * 32);
        }

        // 保险起见以最终数据数量为准
        const totalRenderSplatCount = mergeDataCount + watermarkCount + textWatermarkCount;
        const xyz = new Float32Array(totalRenderSplatCount * 3);
        for (let i = 0, n = 0; i < totalRenderSplatCount; i++) {
            xyz[i * 3] = f32s[i * 8];
            xyz[i * 3 + 1] = f32s[i * 8 + 1];
            xyz[i * 3 + 2] = f32s[i * 8 + 2];
        }

        texture.txdata = ui32s;
        texture.xyz = xyz;
        texture.renderSplatCount = totalRenderSplatCount;
        texture.visibleSplatCount = currentTotalVisibleCnt + splatModel.watermarkCount + textWatermarkCount;
        texture.modelSplatCount = splatModel.downloadSplatCount + textWatermarkCount;
        texture.watermarkCount = watermarkCount + textWatermarkCount;
        texture.minX = splatModel.header.MinX;
        texture.maxX = splatModel.header.MaxX;
        texture.minY = splatModel.header.MinY;
        texture.maxY = splatModel.header.MaxY;
        texture.minZ = splatModel.header.MinZ;
        texture.maxZ = splatModel.header.MaxZ;

        fire(UploadSplatTexture, texture);
        lastPostDataTime = sysTime;

        fire(Information, { visibleSplatCount: texture.visibleSplatCount, modelSplatCount: texture.modelSplatCount });
    }

    async function mergeAndUploadLodLargeSceneData() {
        if (disposed) return;

        const enableEnvironment: boolean = (fire(GetOptions) as SplatMeshOptions).enableEnvironment;
        const maxRenderCount = await fire(GetMaxRenderCount);
        const { texwidth, texheight } = fire(ComputeTextureWidthHeight, maxRenderCount);
        const txtWatermarkData = textWatermarkData;
        const watermarkCount = splatModel.watermarkCount; // 待合并的水印数（模型数据部分）
        const textWatermarkCount = (txtWatermarkData?.byteLength || 0) / 32; // 待合并的水印数（可动态变化的文字水印部分）
        const environmentCount = enableEnvironment ? (splatModel.splatTiles.environment as SplatFile)?.downloadCount || 0 : 0;
        const maxDataMergeCount = maxRenderCount - watermarkCount - textWatermarkCount - environmentCount; // 最大数据合并点数

        fire(UpdateFetchStatus, splatModel.splatTiles.fetchSet.size);
        fire(Information, { modelSplatCount: splatModel.downloadSplatCount + textWatermarkCount });

        let texture: SplatTexdata = texture0.version <= texture1.version ? texture0 : texture1;
        if (texture0.version && ((!texture.index && !texture1.active) || (texture.index && !texture0.active))) return; // 待渲染
        if (Date.now() - Math.max(texture0.activeTime, texture1.activeTime) < BlankingTimeOfLargeScene) return;

        const v3Tmp = new Vector3();
        const splatTiles = splatModel.splatTiles;
        const topLod = splatTiles.lodLevels - 1;

        if (!splatTiles.topLodReady) return;

        // 视锥剔除
        const viewProjMatrix: Matrix4 = fire(GetViewProjectionMatrix);
        const cameraPosition: Vector3 = fire(GetCameraPosition);
        extractFrustumPlanes(viewProjMatrix, frustumPlanes); // 更新视锥体平面

        const fnAddTargetLod = (splatTile: SplatTileNode, requireLevel: number, isFallback = false): number => {
            if (!splatTiles.lodTargets.includes(requireLevel)) {
                if (requireLevel < splatTiles.lodLevels) {
                    fnAddTargetLod(splatTile, requireLevel + 1, true);
                } else {
                    splatTile.currentRenderLod = splatTiles.lodLevels;
                }
                return splatTile.currentRenderLod;
            }

            !isFallback && todoDownload(splatTiles.files[splatTile.lods[requireLevel]?.fileKey]);

            const tileMapping = splatTile.lods[requireLevel];
            if (!tileMapping) {
                if (requireLevel < splatTiles.lodLevels) {
                    fnAddTargetLod(splatTile, requireLevel + 1, true);
                } else {
                    splatTile.currentRenderLod = topLod;
                }
            } else {
                const file = splatTiles.files[tileMapping.fileKey];
                if (file?.downloadCount) {
                    splatTile.currentRenderLod = requireLevel;
                } else {
                    if (requireLevel < splatTiles.lodLevels) {
                        fnAddTargetLod(splatTile, requireLevel + 1, true);
                    } else {
                        splatTile.currentRenderLod = topLod;
                    }
                }
            }

            return splatTile.currentRenderLod;
        };

        const checkSplatNodeVisible = (node: SplatTileNode): number => {
            // 视锥剔除，第1个为近截面，第6个为远截面忽略计算
            const v3Center = v3Tmp.fromArray(node.center);
            const distances: number[] = [];
            for (let i = 0; i < 5; i++) {
                const distance = frustumPlanes[i].distanceToPoint(v3Center); // 计算球心到平面的有符号距离
                if (distance < -node.radius) {
                    node.currentVisible = false; // 若球体完全在平面外侧（负方向），则不可见
                    return 0; // 不可见
                }
                distances[i] = distance;
            }
            node.currentVisible = true;
            if (node.lods) {
                // 叶节点按完全可见处理
                node.currentDistance = computeSplatNodeCameraDistance(cameraPosition, node);
                return 1;
            } else {
                node.currentDistance = distances[0] >= 0 ? Math.max(0, distances[0] - node.radius) : Math.min(0, distances[0] + node.radius);
            }

            for (let distance of distances) {
                if (distance < 0 || distance < node.radius) return -1; // 部分可见
            }
            return 1; // 完全可见
        };

        const calcRequireLodLevel = (leafNode: SplatTileNode) => {
            let requireLevel = splatTiles.lodLevels;
            const distance = computeSplatNodeCameraDistance(cameraPosition, leafNode);
            // lodDistances/lodTargets都已升序
            for (let i = splatTiles.lodDistances.length - 1; i >= 0; i--) {
                if (!leafNode.lods[splatTiles.lodTargets[i]]) continue; // 该块无此lod数据

                if (distance >= splatTiles.lodDistances[i]) {
                    requireLevel = splatTiles.lodTargets[i];
                    break;
                }
            }
            return requireLevel;
        };

        traveSplatTree(splatTiles.tree, node => {
            const state = checkSplatNodeVisible(node);
            if (state == 0) {
                // 完全不可见，旗下全部叶节点直接设定
                traveSplatTree(node, nd => {
                    if (nd.lods) {
                        nd.currentVisible = false;
                        nd.currentRenderLod = topLod;
                    }
                });
                return false;
            } else if (state > 0) {
                // 完全可见（部分可见的叶节点都是完全可见），旗下全部叶节点直接计算设定
                traveSplatTree(node, nd => {
                    if (!nd.lods) return;

                    nd.currentVisible = true;
                    fnAddTargetLod(nd, calcRequireLodLevel(nd));
                });
            }
        });

        // 数量检查
        let sumCurrentSplatCount = 0;
        let leafs: SplatTileNode[] = []; // 所有叶节点
        let targetLeafs: SplatTileNode[] = leafs;
        let reduceLeafs: SplatTileNode[] = []; // 降级处理时的目标范围
        let visibleCuts = 0;
        traveSplatTree(splatTiles.tree, leaf => {
            if (!leaf.lods) return;

            leaf.currentVisible && visibleCuts++;
            leafs.push(leaf);
            leaf.currentRenderLod < topLod && reduceLeafs.push(leaf);
            sumCurrentSplatCount += leaf.lods[leaf.currentRenderLod]?.count || 0; // 块中不一定各lod都有数据
        });
        let currentTotalVisibleCnt = visibleCuts > 0 ? sumCurrentSplatCount : 0;

        let topTooLarge = false;
        if (sumCurrentSplatCount > maxDataMergeCount) {
            const reduceLod = (tgtLod: number) => {
                for (let i = 0; i < reduceLeafs.length; i++) {
                    const reduceNode = reduceLeafs[i];
                    if (reduceNode.currentRenderLod != tgtLod) continue;

                    const newLod = fnAddTargetLod(reduceNode, tgtLod + 1);
                    if (newLod < splatTiles.lodLevels) {
                        sumCurrentSplatCount += reduceNode.lods[newLod].count - reduceNode.lods[tgtLod].count;
                        if (sumCurrentSplatCount <= maxDataMergeCount) break;
                    } else {
                        sumCurrentSplatCount -= reduceNode.lods[tgtLod].count;
                    }
                }
            };

            // 排序
            reduceLeafs.sort((a, b) => b.currentDistance - a.currentDistance); // 按距离降序

            while (sumCurrentSplatCount > maxDataMergeCount) {
                let minLod = splatTiles.lodLevels;
                for (const reduceNode of reduceLeafs) {
                    minLod = Math.min(minLod, reduceNode.currentRenderLod);
                }
                if (minLod >= topLod) {
                    console.warn('Top LOD data is too large');
                    topTooLarge = true;
                    break;
                }
                reduceLod(minLod);
            }
        }

        // 检查是否忽略
        if (topTooLarge) {
            leafs.sort((a, b) => {
                if (a.currentVisible !== b.currentVisible) {
                    return a.currentVisible ? -1 : 1;
                } else {
                    return a.currentDistance - b.currentDistance;
                }
            });
            let cnt = 0;
            let total = environmentCount + watermarkCount + textWatermarkCount;
            for (let node of leafs) {
                total += node.lods[topLod]?.count || 0;
                if (total > maxDataMergeCount) {
                    break;
                }
                cnt++;
            }
            targetLeafs = leafs.slice(0, cnt);
            lastLodHash = hashString(Date.now() + '');
        } else {
            const chks = reduceLeafs.filter(v => v.currentRenderLod < topLod);
            chks.sort((a, b) => {
                if (a.lods[a.currentRenderLod].fileKey === b.lods[b.currentRenderLod].fileKey) {
                    return a.lods[a.currentRenderLod].offset - b.lods[b.currentRenderLod].offset;
                }
                return a.lods[a.currentRenderLod].fileKey < b.lods[b.currentRenderLod].fileKey ? -1 : 1;
            });
            let chkKey = '';
            for (let node of chks) {
                let oMapping = node.lods[node.currentRenderLod];
                chkKey += `${oMapping.fileKey},${oMapping.offset};`;
            }
            const lodHash = hashString(chkKey);
            if (!!fire(GetSplatActivePoints) && lastLodHash === lodHash) return;
            lastLodHash = lodHash;
        }

        // 合并
        const sysTime = Date.now();
        texture.version = sysTime;
        texture.active = false;

        const ui32s = new Uint32Array(texwidth * texheight * 4);
        const f32s = new Float32Array(ui32s.buffer);
        const mergeSplatData = new Uint8Array(ui32s.buffer);
        let mergeDataCount = 0;

        if (visibleCuts > 0) {
            for (let node of targetLeafs) {
                const tileMapping = node.lods[node.currentRenderLod];
                if (!tileMapping) continue;

                const file = splatTiles.files[tileMapping.fileKey];
                if (!file.downloadData) continue;

                file.lastTime = Date.now();
                mergeSplatData.set(file.downloadData.subarray(tileMapping.offset * 32, (tileMapping.offset + tileMapping.count) * 32), mergeDataCount * 32);
                mergeDataCount += tileMapping.count;
            }
        }

        if (environmentCount) {
            mergeSplatData.set((splatTiles.environment as SplatFile).downloadData.subarray(0, environmentCount * 32), mergeDataCount * 32);
            mergeDataCount += environmentCount;
        }
        if (watermarkCount) {
            mergeSplatData.set(splatModel.watermarkData.subarray(0, watermarkCount * 32), mergeDataCount * 32);
            mergeDataCount += watermarkCount;
        }
        if (textWatermarkCount) {
            mergeSplatData.set(txtWatermarkData.subarray(0, textWatermarkCount * 32), (mergeDataCount + watermarkCount) * 32);
            mergeDataCount += textWatermarkCount;
        }

        // 保险起见以最终数据数量为准
        const totalRenderSplatCount = mergeDataCount; // + watermarkCount + textWatermarkCount;
        const xyz = new Float32Array(totalRenderSplatCount * 3);
        const mins: number[] = [f32s[0], f32s[1], f32s[2]];
        const maxs: number[] = [f32s[0], f32s[1], f32s[2]];
        for (let i = 0, x = 0, y = 0, z = 0; i < totalRenderSplatCount; i++) {
            x = f32s[i * 8];
            y = f32s[i * 8 + 1];
            z = f32s[i * 8 + 2];
            xyz[i * 3] = x;
            xyz[i * 3 + 1] = y;
            xyz[i * 3 + 2] = z;

            mins[0] = Math.min(mins[0], x);
            mins[1] = Math.min(mins[1], y);
            mins[2] = Math.min(mins[2], z);
            maxs[0] = Math.max(maxs[0], x);
            maxs[1] = Math.max(maxs[1], y);
            maxs[2] = Math.max(maxs[2], z);
        }

        texture.txdata = ui32s;
        texture.xyz = xyz;
        texture.renderSplatCount = totalRenderSplatCount;
        texture.visibleSplatCount = currentTotalVisibleCnt + splatModel.watermarkCount + textWatermarkCount + environmentCount;
        texture.modelSplatCount = splatModel.downloadSplatCount + textWatermarkCount;
        texture.watermarkCount = watermarkCount + textWatermarkCount;
        texture.minX = mins[0];
        texture.maxX = maxs[0];
        texture.minY = mins[1];
        texture.maxY = maxs[1];
        texture.minZ = mins[2];
        texture.maxZ = maxs[2];

        fire(UploadSplatTexture, texture);
        lastPostDataTime = sysTime;

        const cuts = `${visibleCuts}/${leafs.length}`;
        const lodTotalCount = splatTiles.totalCount;
        fire(Information, { scene: 'large', lodTotalCount, cuts, visibleSplatCount: texture.visibleSplatCount, modelSplatCount: texture.modelSplatCount });

        if (!flyOnceDone) {
            flyOnceDone = true;
            const opts: SplatMeshOptions = fire(GetOptions);
            opts.viewMode !== 3 && opts.viewerEvents?.fire(Flying, true);
        }
    }

    function checkLodCache() {
        // 缓存整理
        if (!splatModel?.splatTiles) return;

        const maxCacheCount = isMobile ? splatModel.splatTiles.mobileLodCacheCount || 600_0000 : splatModel.splatTiles.pcLodCacheCount || 3000_0000;
        if (splatModel.downloadSplatCount < maxCacheCount) return;

        if (runCounter++ % 3 == 0 && splatModel.downloadSplatCount > maxCacheCount) {
            const downloadFiles: SplatFile[] = [];
            for (let key of Object.keys(splatModel.splatTiles.files)) {
                let file = splatModel.splatTiles.files[key];
                if (file.downloadCount) downloadFiles.push(file);
            }
            downloadFiles.sort((a, b) => b.lastTime - a.lastTime); // 降序
            let cacheCnt = splatModel.downloadSplatCount;
            let removeCnt = 0;
            while (downloadFiles.length && cacheCnt > maxCacheCount) {
                const file = downloadFiles.pop();
                removeCnt += file.downloadCount;
                cacheCnt -= removeCnt;
                file.downloadCount = 0;
                file.downloadData = null;
                file.abortController = null;
                file.lastTime = 0;
                file.spxHeader = null;
                file.status = DataStatus.None;
            }
            splatModel.downloadSplatCount -= removeCnt;
        }
    }

    function allocatePoints(cuts: CutData[], maxPoints: number): void {
        const weights = cuts.map(cut => 1 / (cut.distance + 1e-6));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let totalRenderSplatCount = 0;
        cuts.forEach((cut, index) => {
            cut.currentRenderCnt = Math.min(Math.floor((weights[index] / totalWeight) * maxPoints), cut.splatCount);
            totalRenderSplatCount += cut.currentRenderCnt;
        });
        if (totalRenderSplatCount < maxPoints) {
            const remainingPoints = maxPoints - totalRenderSplatCount;
            const remainingWeights = cuts.map((cut, index) => (cut.currentRenderCnt < cut.splatCount ? weights[index] : 0));
            const remainingTotalWeight = remainingWeights.reduce((sum, weight) => sum + weight, 0);

            cuts.forEach((cut, index) => {
                if (remainingTotalWeight > 0 && cut.currentRenderCnt < cut.splatCount) {
                    const additionalPoints = Math.min(
                        Math.floor((remainingWeights[index] / remainingTotalWeight) * remainingPoints),
                        cut.splatCount - cut.currentRenderCnt,
                    );
                    cut.currentRenderCnt += additionalPoints;
                }
            });
        }
    }

    function checkCutDataVisible(viewProjMatrix: Matrix4, cameraPosition: Vector3, cameraTarget: Vector3, cut: CutData): boolean {
        cut.distance = Math.max(cut.center.distanceTo(cameraPosition) - cut.radius, 0);
        if (!cut.distance || cut.center.distanceTo(cameraTarget) <= 2 * cut.radius) return true;

        const pos2d = new Vector4(cut.center.x, cut.center.y, cut.center.z, 1).applyMatrix4(viewProjMatrix);
        const clip = 3 * pos2d.w;
        return !(pos2d.z < -clip || pos2d.x < -clip || pos2d.x > clip || pos2d.y < -clip || pos2d.y > clip);
    }

    function updateBoundBox(downloadDone: boolean) {
        // 包围盒
        if (!initBoundBox) {
            if (splatModel.header) {
                initBoundBox = true;
                const min = new Vector3(splatModel.header.MinX, splatModel.header.MinY, splatModel.header.MinZ);
                const max = new Vector3(splatModel.header.MaxX, splatModel.header.MaxY, splatModel.header.MaxZ);
                fire(SplatUpdateBoundBox, min.x, min.y, min.z, max.x, max.y, max.z, splatModel.meta.showBoundBox);
            } else if (downloadDone) {
                initBoundBox = true;
                const min = new Vector3(splatModel.minX, splatModel.minY, splatModel.minZ);
                const max = new Vector3(splatModel.maxX, splatModel.maxY, splatModel.maxZ);
                fire(SplatUpdateBoundBox, min.x, min.y, min.z, max.x, max.y, max.z, splatModel.meta.showBoundBox);
            }
        }
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        splatModel?.abortController?.abort();
        splatModel?.map?.clear();
        if (splatModel?.splatTiles) {
            for (let file of Object.values(splatModel.splatTiles.files)) {
                file.abortController?.abort();
            }
            (splatModel.splatTiles.environment as SplatFile)?.abortController?.abort();
        }
        splatModel = null;
        textWatermarkData = null;
        texture0 = null;
        texture1 = null;
    }

    function loadSplatModel(model: SplatModel) {
        if (model.opts.format === 'spx') {
            loadSpx(model);
        } else if (model.opts.format === 'splat') {
            loadSplat(model);
        } else if (model.opts.format === 'ply') {
            loadPly(model);
        } else if (model.opts.format === 'spz') {
            loadSpz(model);
        } else if (model.opts.format === 'sog') {
            loadSog(model);
        } else {
            return false;
        }
        return true;
    }

    function add(opts: ModelOptions, meta: MetaData) {
        if (disposed) return;
        const splatMeshOptions: SplatMeshOptions = fire(GetOptions);
        const maxRenderCount: number = isMobile ? splatMeshOptions.maxRenderCountOfMobile : splatMeshOptions.maxRenderCountOfPc;
        const isBigSceneMode: boolean = fire(IsBigSceneMode);

        opts.fetchReload = isNeedReload(meta.updateDate || 0); // 7天内更新的重新下载

        splatModel = new SplatModel(opts, meta);

        // 计算设定下载限制
        if (isBigSceneMode) {
            const pcDownloadLimitCount = meta.pcDownloadLimitSplatCount || PcDownloadLimitSplatCount;
            const mobileDownloadLimitCount = meta.mobileDownloadLimitSplatCount || MobileDownloadLimitSplatCount;
            splatModel.fetchLimit = isMobile ? mobileDownloadLimitCount : pcDownloadLimitCount;
        } else {
            splatModel.fetchLimit = maxRenderCount;
        }

        const fnCheckModelSplatCount = () => {
            // 除非下载失败，否则总是等待继续下载，直到得知模型文件的点数为止
            if (!splatModel || splatModel.status == ModelStatus.Invalid || splatModel.status == ModelStatus.FetchFailed) {
                return fnResolveModelSplatCount(0);
            }
            if (splatModel.modelSplatCount > 0) {
                fnResolveModelSplatCount(splatModel.modelSplatCount);
                if (!splatModel.meta.particleMode && splatModel.dataSplatCount) {
                    setTimeout(() => fire(SplatMeshCycleZoom), 5);
                } else {
                    setTimeout(fnCheckModelSplatCount, 10); // 没数据可以渲染，继续做以便触发过渡效果
                }
            } else {
                setTimeout(fnCheckModelSplatCount, 10);
            }
        };
        fnCheckModelSplatCount();

        if (!loadSplatModel(splatModel)) {
            console.error('Unsupported format:', opts.format);
            fire(OnFetchStop, 0);
            return;
        }
        fire(OnFetchStart);
        fire(Information, { cuts: `` });
    }

    function addLod(splatTiles: SplatTiles, splatFile: SplatFile) {
        if (disposed) return;
        if (!splatTiles || !splatFile) return;

        !splatModel && (splatModel = new SplatModel({ url: 'fake.spx' }));
        !splatModel.splatTiles && (splatModel.splatTiles = splatTiles);
        fnResolveModelSplatCount(splatTiles.totalCount);

        loadLodSplatFile(splatModel, splatTiles, splatFile);
    }

    on(SplatTexdataManagerAddModel, (opts: ModelOptions, meta: MetaData) => add(opts, meta));
    on(SplatTexdataManagerAddSplatLod, (splatTiles: SplatTiles, splatFile: SplatFile) => addLod(splatTiles, splatFile));
    on(SplatTexdataManagerDataChanged, (msDuring: number = 10000) => Date.now() - lastPostDataTime < msDuring);
    on(SplatTexdataManagerDispose, () => dispose());

    fire(
        RunLoopByFrame,
        async () => await mergeAndUploadData(isBigSceneMode),
        () => !disposed,
        isMobile ? 10 : 6,
    );

    setupLodDownloadManager(events);
}
