// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    BufferAttribute,
    DataTexture,
    DoubleSide,
    DynamicDrawUsage,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    NormalBlending,
    PerspectiveCamera,
    RGBAIntegerFormat,
    ShaderMaterial,
    UnsignedByteType,
    UnsignedIntType,
    Vector2,
    Vector4,
} from 'three';
import { Events } from '../../events/Events';
import {
    GetCamera,
    GetCurrentDisplayShDegree,
    GetModelShDegree,
    GetShTexheight,
    SplatUpdateSh12Texture,
    SplatUpdateSh3Texture,
    SplatUpdateShDegree,
    UploadSplatTexture,
    UploadSplatTextureDone,
    NotifyViewerNeedUpdate,
    SplatUpdateViewport,
    GetSplatMaterial,
    CreateSplatGeometry,
    CreateSplatMaterial,
    CreateSplatUniforms,
    SplatUpdateFocal,
    SplatUpdateSplatIndex,
    GetWorker,
    GetCanvasSize,
    Information,
    GetSplatGeometry,
    CreateSplatMesh,
    GetOptions,
    SplatMeshDispose,
    SplatGeometryDispose,
    SplatMaterialDispose,
    GetMaxRenderCount,
    SplatUpdateTexture,
    SplatUpdateUsingIndex,
    SplatUpdatePointMode,
    SplatUpdateBigSceneMode,
    SplatUpdateLightFactor,
    SplatUpdateTopY,
    SplatUpdateCurrentVisibleRadius,
    SplatUpdateCurrentLightRadius,
    IsBigSceneMode,
    SplatMeshSwitchDisplayMode,
    RunLoopByFrame,
    IsPointcloudMode,
    SplatMeshCycleZoom,
    IsSmallSceneRenderDataReady,
    OnTextureReadySplatCount,
    SplatUpdateMarkPoint,
    MarkUpdateVisible,
    SplatUpdatePerformanceNow,
    SplatUpdateShowWaterMark,
    FlyOnce,
    SplatUpdateDebugEffect,
    SplatUpdateFlagValue,
    SplatUpdateMaxRadius,
    SplatUpdatePerformanceAct,
    OnSmallSceneShowDone,
    SplatUpdateParticleMode,
    SplatUpdateTransitionEffect,
    SplatUpdateMinMaxPixelDiameter,
    SplatUpdateMinAlpha,
    OnQualityLevelChanged,
    WorkerUpdateParams,
    GetSplatMesh,
    IsSplatMeshCreated,
    SplatUpdateUseSimilarExp,
    SplatUpdateActiveFlagValue,
    SplatUpdateShPalettesTexture,
    SplatUpdateShPalettesReady,
    ComputeTextureWidthHeight,
    GetSplatShaderDefines,
    SplatUpdateUseLod,
} from '../../events/EventConstants';
import { SplatMeshOptions, TransitionEffects } from './SplatMeshOptions';
import {
    VarActiveFlagValue,
    VarBigSceneMode,
    VarCurrentLightRadius,
    VarCurrentVisibleRadius,
    VarDebugEffect,
    VarFlagValue,
    VarFocal,
    VarLightFactor,
    VarMarkPoint,
    VarMaxPixelDiameter,
    VarMaxRadius,
    VarMinAlpha,
    VarMinPixelDiameter,
    VarParticleMode,
    VarPerformanceAct,
    VarPerformanceNow,
    VarPointMode,
    VarShDegree,
    VarShowWaterMark,
    VarShPalettes,
    VarShPalettesReady,
    VarSplatIndex,
    VarSplatShTexture12,
    VarSplatShTexture3,
    VarSplatTexture0,
    VarSplatTexture1,
    VarSplatTextureWidth,
    VarTopY,
    VarTransitionEffect,
    VarUseLod,
    VarUseSimilarExp,
    VarUsingIndex,
    VarViewport,
    VarWaterMarkColor,
} from '../../internal/Index';
import {
    WkIndex,
    WkRenderSplatCount,
    WkSortTime,
    WkSplatIndex,
    WkTextureReady,
    WkVersion,
    WkSortStartTime,
    WkXyz,
    WkMinX,
    WkMaxX,
    WkMinY,
    WkMaxY,
    WkMinZ,
    WkMaxZ,
    WkVisibleSplatCount,
    WkModelSplatCount,
    WkWatermarkCount,
    WkBucketBits,
    WkSortType,
    WkSplatIndexDone,
    isMobile,
    QualityLevels,
} from '../../utils/consts/Index';
import vertexShader from './shaders/SplatVertex.glsl';
import fragmentShader from './shaders/SplatFragment.glsl';
import { MetaData } from '../../modeldata/ModelData';
import { SplatMesh } from './SplatMesh';
import { shaderChunk } from '../../utils/CommonUtils';
import CmnFns from './shaders/chunks/CmnFns.glsl';
import FvEffect from './shaders/chunks/FvEffect.glsl';
import WatermarkEffect from './shaders/chunks/WatermarkEffect.glsl';

export function setupSplatMesh(events: Events) {
    let disposed = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let maxRadius: number = 0;
    let currentMaxRadius: number = 0;
    const arySwitchProcess: any[] = [];
    let bucketBits: number = 0;
    let sortType: number = 0;
    const PalettesWidth = 960;

    let currentDisplayShDegree: number = 0;
    on(GetCurrentDisplayShDegree, () => currentDisplayShDegree);

    on(SplatGeometryDispose, () => {}, true);
    on(SplatMaterialDispose, () => {}, true);
    on(SplatUpdateFocal, () => {}, true);
    on(SplatUpdateViewport, () => {}, true);

    on(CreateSplatGeometry, async () => {
        const baseGeometry = new InstancedBufferGeometry();
        baseGeometry.setIndex([0, 1, 2, 0, 2, 3]);
        const positionsArray = new Float32Array(4 * 3);
        const positions = new BufferAttribute(positionsArray, 3);
        baseGeometry.setAttribute('position', positions);
        positions.setXYZ(0, -2.0, -2.0, 0.0);
        positions.setXYZ(1, -2.0, 2.0, 0.0);
        positions.setXYZ(2, 2.0, 2.0, 0.0);
        positions.setXYZ(3, 2.0, -2.0, 0.0);
        positions.needsUpdate = true;

        let geometry = new InstancedBufferGeometry().copy(baseGeometry);

        const MaxSplatCount = await fire(GetMaxRenderCount);
        if (disposed) return;
        const indexArray = new Uint32Array(MaxSplatCount);
        const indexAttribute = new InstancedBufferAttribute(indexArray, 1, false);
        indexAttribute.setUsage(DynamicDrawUsage);
        indexAttribute.needsUpdate = true;
        geometry.setAttribute(VarSplatIndex, indexAttribute);
        geometry.instanceCount = 0;

        on(SplatUpdateSplatIndex, (datas: Uint32Array, index: number, sortTime: number, sortStartTime: number, renderSplatCount: number) => {
            fire(SplatUpdateUsingIndex, index);
            indexArray.set(datas, 0);
            indexAttribute.clearUpdateRanges();
            indexAttribute.addUpdateRange(0, renderSplatCount);
            indexAttribute.needsUpdate = true;
            indexAttribute.onUpload(() => {
                fire(UploadSplatTextureDone, index);
                fire(Information, { renderSplatCount });
            });
            geometry.instanceCount = renderSplatCount;
            fire(NotifyViewerNeedUpdate);
            fire(Information, { sortTime: `${sortTime} / ${Date.now() - sortStartTime}`, bucketBits, sortType });
        });

        on(GetSplatGeometry, () => geometry);
        on(
            SplatGeometryDispose,
            () => {
                indexAttribute.array = null;
                geometry.dispose();
            },
            true,
        );

        return geometry;
    });

    on(GetSplatShaderDefines, () => {
        const defines: any = {};
        const opts: SplatMeshOptions = fire(GetOptions);
        if (opts.bigSceneMode) {
            defines.BigSceneMode = '';
        }
        return defines;
    });

    on(CreateSplatMaterial, async () => {
        if (disposed) return;
        const opts: SplatMeshOptions = fire(GetOptions);
        const { texwidth, texheight } = fire(ComputeTextureWidthHeight, await fire(GetMaxRenderCount));
        const material: ShaderMaterial = new ShaderMaterial({
            uniforms: fire(CreateSplatUniforms, texwidth),
            vertexShader: genShaderSource(vertexShader),
            fragmentShader: genShaderSource(fragmentShader),
            transparent: true,
            alphaTest: 1.0,
            blending: NormalBlending,
            depthTest: opts.depthTest !== false, // 是否启用深度测试。深度测试用于确保只有离相机更近的物体才会被渲染
            depthWrite: false, // 是否将深度值写入深度缓冲区
            side: DoubleSide,
            defines: fire(GetSplatShaderDefines),
        });

        const dataArray0 = new Uint32Array(texwidth * texheight * 4);
        let dataTexture0 = new DataTexture(dataArray0, texwidth, texheight, RGBAIntegerFormat, UnsignedIntType);
        dataTexture0.internalFormat = 'RGBA32UI';
        dataTexture0.needsUpdate = true;
        material.uniforms[VarSplatTexture0].value = dataTexture0;
        const texheight1 = fire(IsBigSceneMode) ? texheight : 1;
        const dataArray1 = new Uint32Array(texwidth * texheight1 * 4);
        let dataTexture1 = new DataTexture(dataArray1, texwidth, texheight1, RGBAIntegerFormat, UnsignedIntType);
        dataTexture1.internalFormat = 'RGBA32UI';
        dataTexture1.needsUpdate = true;
        material.uniforms[VarSplatTexture1].value = dataTexture1;

        const shTexheight12 = await fire(GetShTexheight, 1, texwidth);
        const dataArraySh12 = new Uint32Array(texwidth * shTexheight12 * 4);
        let dataTextureSh12 = new DataTexture(dataArraySh12, texwidth, shTexheight12, RGBAIntegerFormat, UnsignedIntType);
        dataTextureSh12.internalFormat = 'RGBA32UI';
        dataTextureSh12.needsUpdate = true;
        material.uniforms[VarSplatShTexture12].value = dataTextureSh12;
        const shTexheight3 = await fire(GetShTexheight, 3, texwidth);
        const dataArraySh3 = new Uint32Array(texwidth * shTexheight3 * 4);
        let dataTextureSh3 = new DataTexture(dataArraySh3, texwidth, shTexheight3, RGBAIntegerFormat, UnsignedIntType);
        dataTextureSh3.internalFormat = 'RGBA32UI';
        dataTextureSh3.needsUpdate = true;
        material.uniforms[VarSplatShTexture3].value = dataTextureSh3;

        const dataShPalettes = new Uint8Array(PalettesWidth * 4);
        dataShPalettes.fill(128);
        let dataTextureShPalettes = new DataTexture(dataShPalettes, PalettesWidth, 1, RGBAIntegerFormat, UnsignedByteType);
        dataTextureShPalettes.internalFormat = 'RGBA8UI';
        dataTextureShPalettes.needsUpdate = true;
        material.uniforms[VarShPalettes].value = dataTextureShPalettes;

        material.needsUpdate = true;

        let isLastEmpty: boolean = false;
        on(SplatUpdateTexture, (texture: SplatTexdata) => {
            if (!fire(IsBigSceneMode)) {
                if (isLastEmpty && !texture.renderSplatCount) return; // 小场景，不要重复提交空数据
                isLastEmpty = !texture.renderSplatCount;
            }

            const dataArray = texture.txdata;
            texture.txdata = null;
            const dataTexture = new DataTexture(dataArray as BufferSource, texwidth, texheight, RGBAIntegerFormat, UnsignedIntType);
            dataTexture.onUpdate = () => {
                texture.textureReady = true;
                texture.textureReadyTime = Date.now();
                notifyWorkerTextureReady(texture);
                fire(OnTextureReadySplatCount, texture.renderSplatCount); // 用于判断小场景是否可以开始光圈过渡
            };
            dataTexture.internalFormat = 'RGBA32UI';
            dataTexture.needsUpdate = true;
            if (texture.index) {
                material.uniforms[VarSplatTexture1].value = dataTexture;
                dataTexture1?.dispose();
                dataTexture1 = dataTexture;
            } else {
                material.uniforms[VarSplatTexture0].value = dataTexture;
                dataTexture0?.dispose();
                dataTexture0 = dataTexture;
            }

            material.needsUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });

        on(SplatUpdateSh12Texture, async (datas: Uint8Array[]) => {
            if (fire(IsBigSceneMode) || !datas || !datas.length) return;
            const dataArray = new Uint32Array(texwidth * (await fire(GetShTexheight, 1, texwidth)) * 4);
            const ui8s = new Uint8Array(dataArray.buffer);
            for (let i = 0, offset = 0; i < datas.length; i++) {
                ui8s.set(datas[i], offset);
                offset += datas[i].byteLength;
            }
            const dataTexture = new DataTexture(dataArray, texwidth, shTexheight12, RGBAIntegerFormat, UnsignedIntType);
            dataTexture.internalFormat = 'RGBA32UI';
            dataTexture.needsUpdate = true;
            material.uniforms[VarSplatShTexture12].value = dataTexture;
            material.needsUpdate = true;
            dataTextureSh12?.dispose();
            dataTextureSh12 = dataTexture;
            fire(NotifyViewerNeedUpdate);
        });

        on(SplatUpdateSh3Texture, async (datas: Uint8Array[]) => {
            if (fire(IsBigSceneMode) || !datas || !datas.length) return;
            const dataArray = new Uint32Array(texwidth * (await fire(GetShTexheight, 3, texwidth)) * 4);
            const ui8s = new Uint8Array(dataArray.buffer);
            for (let i = 0, offset = 0; i < datas.length; i++) {
                ui8s.set(datas[i], offset);
                offset += datas[i].byteLength;
            }
            const dataTexture = new DataTexture(dataArray, texwidth, shTexheight12, RGBAIntegerFormat, UnsignedIntType);
            dataTexture.internalFormat = 'RGBA32UI';
            dataTexture.needsUpdate = true;
            material.uniforms[VarSplatShTexture3].value = dataTexture;
            material.needsUpdate = true;
            dataTextureSh3?.dispose();
            dataTextureSh3 = dataTexture;
            fire(NotifyViewerNeedUpdate);
        });

        on(SplatUpdateShPalettesTexture, async (ui8s: Uint8Array) => {
            if (!ui8s || !ui8s.length) return;

            const height = 1024;
            const dataShPalettes = new Uint8Array(PalettesWidth * height * 4);
            dataShPalettes.fill(128);
            dataShPalettes.set(ui8s);
            const dataTexture = new DataTexture(dataShPalettes, PalettesWidth, height, RGBAIntegerFormat, UnsignedByteType);
            dataTextureShPalettes.internalFormat = 'RGBA8UI';
            dataTexture.onUpdate = () => fire(SplatUpdateShPalettesReady);
            dataTexture.needsUpdate = true;
            material.uniforms[VarShPalettes].value = dataTexture;
            material.needsUpdate = true;
            dataTextureShPalettes?.dispose();
            dataTextureShPalettes = dataTexture;
            fire(NotifyViewerNeedUpdate);
        });

        on(GetSplatMaterial, () => material);

        on(
            SplatUpdateFocal,
            () => {
                const camera: PerspectiveCamera = fire(GetCamera);
                const { width, height } = fire(GetCanvasSize);
                const fx = Math.abs(camera.projectionMatrix.elements[0]) * 0.5 * width;
                const fy = Math.abs(camera.projectionMatrix.elements[5]) * 0.5 * height;
                const material: ShaderMaterial = fire(GetSplatMaterial);
                material.uniforms[VarFocal].value.set(fx, fy);
                material.uniformsNeedUpdate = true;
                fire(NotifyViewerNeedUpdate);
            },
            true,
        );
        on(
            SplatUpdateViewport,
            () => {
                const { width, height } = fire(GetCanvasSize);
                material.uniforms[VarViewport].value.set(width, height);
                material.uniformsNeedUpdate = true;
                fire(NotifyViewerNeedUpdate);
            },
            true,
        );
        on(SplatUpdateUsingIndex, (index: number) => {
            material.uniforms[VarUsingIndex].value = index;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateTransitionEffect, (value: number) => {
            material.uniforms[VarTransitionEffect].value = value;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdatePointMode, (isPointcloudMode: boolean) => {
            const opts: SplatMeshOptions = fire(GetOptions);
            isPointcloudMode === undefined && (isPointcloudMode = !opts.pointcloudMode);
            material.uniforms[VarPointMode].value = isPointcloudMode;
            material.uniformsNeedUpdate = true;
            opts.pointcloudMode = isPointcloudMode;
            fire(NotifyViewerNeedUpdate);
            opts.viewerEvents && (opts.viewerEvents.fire(GetOptions).pointcloudMode = isPointcloudMode);
        });
        on(SplatUpdateBigSceneMode, (isBigSceneMode: boolean) => {
            material.uniforms[VarBigSceneMode].value = isBigSceneMode;
            material.uniformsNeedUpdate = true;
            const opts: SplatMeshOptions = fire(GetOptions);
            opts.bigSceneMode = isBigSceneMode;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateUseLod, (useLod: boolean) => {
            material.uniforms[VarUseLod].value = useLod;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateLightFactor, (value: number) => {
            material.uniforms[VarLightFactor].value = value;
            material.uniformsNeedUpdate = true;
            const opts: SplatMeshOptions = fire(GetOptions);
            opts.lightFactor = value;
            fire(NotifyViewerNeedUpdate);
        });

        let initTopY: boolean = false;
        on(SplatUpdateTopY, (value: number) => {
            if (fire(IsBigSceneMode) || initTopY) return;
            initTopY = true;
            material.uniforms[VarTopY].value = value;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateCurrentVisibleRadius, (value: number) => {
            material.uniforms[VarCurrentVisibleRadius].value = value;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateCurrentLightRadius, (value: number) => {
            material.uniforms[VarCurrentLightRadius].value = value;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateMaxRadius, (value: number) => {
            material.uniforms[VarMaxRadius].value = value;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateMarkPoint, (x: number, y: number, z: number, isMark: boolean) => {
            material.uniforms[VarMarkPoint].value = [x, y, z, isMark ? 1 : -1];
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateShowWaterMark, (show: boolean = true) => {
            material.uniforms[VarShowWaterMark].value = show;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateShPalettesReady, (val: boolean = true) => {
            material.uniforms[VarShPalettesReady].value = val;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdatePerformanceNow, (value: number) => {
            material.uniforms[VarPerformanceNow].value = value;
            material.uniformsNeedUpdate = true;
        });
        on(SplatUpdatePerformanceAct, (value: number) => {
            material.uniforms[VarPerformanceAct].value = value;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateMinMaxPixelDiameter, (minPix: number, maxPix: number) => {
            material.uniforms[VarMinPixelDiameter].value = minPix;
            material.uniforms[VarMaxPixelDiameter].value = maxPix;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateMinAlpha, (minAlpha: number) => {
            material.uniforms[VarMinAlpha].value = Math.min(Math.max(0, minAlpha), 255) / 255;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateUseSimilarExp, (useSimilarExp: boolean = false) => {
            material.uniforms[VarUseSimilarExp].value = useSimilarExp;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateParticleMode, (value: number) => {
            material.uniforms[VarParticleMode].value = value;
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateDebugEffect, (value: boolean) => {
            material.uniforms[VarDebugEffect].value = value;
            material.uniformsNeedUpdate = true;
        });
        on(SplatUpdateShDegree, async (value: number) => {
            const modelShDegree: number = await fire(GetModelShDegree);
            currentDisplayShDegree = Math.max(0, Math.min(value, modelShDegree));
            material.uniforms[VarShDegree].value = currentDisplayShDegree;
            material.uniformsNeedUpdate = true;
            fire(Information, { shDegree: `${currentDisplayShDegree} / max ${modelShDegree}` });
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateFlagValue, (fvHide: number = 0, fvShow: number = 0) => {
            material.uniforms[VarFlagValue].value = (fvHide << 16) | fvShow;
            material.uniforms[VarPerformanceAct].value = performance.now();
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(SplatUpdateActiveFlagValue, (activeFlagValue: number = -1) => {
            if (activeFlagValue < 0) return material.uniforms[VarActiveFlagValue].value;
            material.uniforms[VarActiveFlagValue].value = activeFlagValue;
            material.uniforms[VarPerformanceAct].value = performance.now();
            material.uniformsNeedUpdate = true;
            fire(NotifyViewerNeedUpdate);
        });
        on(
            SplatMaterialDispose,
            () => {
                material.dispose();
                dataTexture0 && dataTexture0.dispose();
                dataTexture1 && dataTexture1.dispose();
                dataTextureSh12 && dataTextureSh12.dispose();
                dataTextureSh3 && dataTextureSh3.dispose();
                dataTextureShPalettes?.dispose();
            },
            true,
        );

        return material;
    });

    function genShaderSource(src: string) {
        shaderChunk['cmn'] = CmnFns.trim();
        shaderChunk['FvEffect'] = (shaderChunk['custom-FvEffect'] || FvEffect).trim();
        shaderChunk['WatermarkEffect'] = (shaderChunk['custom-WatermarkEffect'] || WatermarkEffect).trim();
        return '#include <cmn>\n#include <FvEffect>\n#include <WatermarkEffect>\n' + src;
    }

    on(CreateSplatMesh, async () => {
        const mesh = new Mesh(await fire(CreateSplatGeometry), await fire(CreateSplatMaterial));
        fire(SplatUpdateFocal);
        fire(SplatUpdateViewport);
        fire(SplatUpdateBigSceneMode, fire(IsBigSceneMode));
        fire(SplatUpdatePointMode, fire(IsPointcloudMode));
        return mesh;
    });

    function resize() {
        fire(SplatUpdateFocal);
        fire(SplatUpdateViewport);
    }
    window.addEventListener('resize', resize);

    on(SplatMeshDispose, () => {
        disposed = true;
        window.removeEventListener('resize', resize);
        fire(SplatGeometryDispose);
        fire(SplatMaterialDispose);
    });

    on(OnQualityLevelChanged, () => {
        if (!fire(IsSplatMeshCreated)) return;

        const opts: SplatMeshOptions = fire(GetOptions);
        const meta: MetaData = (fire(GetSplatMesh) as SplatMesh)?.meta || {};
        const level: number = opts.qualityLevel || QualityLevels.Default5;
        const maxShDegrees = [0, 1, 2, 3, 3, 3, 3, 3, 3];
        fire(SplatUpdateShDegree, maxShDegrees[level - 1]);
        if (isMobile) {
            const minPixs = [4, 3, 3, 2, 1, 1, 1, 1, 1];
            const maxPixs = [128, 128, 128, 256, 256, 256, 512, 512, 512];
            const minAlphas = [7, 6, 5, 4, 4, 3, 2, 2, 2];
            const minPix = meta.minPixelDiameter || minPixs[level - 1];
            const maxPix = meta.maxPixelDiameter || maxPixs[level - 1];
            fire(SplatUpdateMinMaxPixelDiameter, minPix, maxPix);
            fire(SplatUpdateMinAlpha, meta.minAlpha || minAlphas[level - 1]);
            fire(SplatUpdateUseSimilarExp, level < QualityLevels.L4);
        } else {
            const minPixs = [2, 2, 2, 1, 1, 1, 1, 1, 1];
            const maxPixs = [128, 256, 256, 512, 512, 1024, 1024, 1024, 1024];
            const minAlphas = [5, 4, 3, 2, 2, 1, 1, 1, 1];
            const minPix = meta.minPixelDiameter || minPixs[level - 1];
            const maxPix = meta.maxPixelDiameter || maxPixs[level - 1];
            fire(SplatUpdateMinMaxPixelDiameter, minPix, maxPix);
            fire(SplatUpdateMinAlpha, meta.minAlpha || minAlphas[level - 1]);
            fire(SplatUpdateUseSimilarExp, level < QualityLevels.L2);
        }
        fire(WorkerUpdateParams);
    });

    // 小场景圆圈扩大渐进渲染
    on(SplatMeshCycleZoom, async () => {
        if (fire(IsBigSceneMode)) return; // 大场景模式不支持

        // 不需要这个特效时跳过
        const opts: SplatMeshOptions = fire(GetOptions);
        if (opts.disableTransitionEffectOnLoad) return fire(SplatUpdateCurrentVisibleRadius, 0);

        let stepRate = 0.01;
        let currentVisibleRadius = 0.01;

        let stop = false;
        let startTime: number = 0;
        fire(SplatUpdateCurrentVisibleRadius, currentVisibleRadius);

        fire(
            RunLoopByFrame,
            () => {
                if (disposed) return;

                currentVisibleRadius += (currentMaxRadius - currentVisibleRadius) * stepRate;
                fire(SplatUpdateCurrentVisibleRadius, currentVisibleRadius);

                let isDataAllReay = fire(IsSmallSceneRenderDataReady);
                isDataAllReay && !startTime && (startTime = Date.now());
                let visibleRate = currentVisibleRadius / maxRadius;
                if (isDataAllReay && (visibleRate > 0.9 || Date.now() - startTime > 2500)) {
                    fire(IsPointcloudMode) && fire(SplatMeshSwitchDisplayMode, true);
                    fire(SplatUpdateCurrentVisibleRadius, 0);
                    stop = true;
                } else if (isDataAllReay && visibleRate > 0.7) {
                    stepRate = Math.min(stepRate * 1.2, 0.3);
                } else if (isDataAllReay && visibleRate > 0.5) {
                    stepRate = Math.min(stepRate * 1.2, 0.2);
                } else if (visibleRate > 0.4) {
                    stepRate = Math.min(stepRate * 1.05, 0.1);
                }
            },
            () => !disposed && !stop,
            3,
        );
    });

    // 切换渲染模式（0:正常模式，1:点云模式），相互排挤，最后调用的优先响应
    on(SplatMeshSwitchDisplayMode, (showMark: boolean = false) => {
        if (fire(IsBigSceneMode)) return; // 大场景模式下不响应光圈过渡效果

        const opts: SplatMeshOptions = fire(GetOptions);
        fire(SplatUpdateTransitionEffect, opts.transitionEffect); // 设定特效类型
        if (opts.transitionEffect === TransitionEffects.ModelCenterCirccle) {
            // 以模型中心过渡

            while (arySwitchProcess.length) arySwitchProcess.pop().stop = true; // 已有的都停掉
            const currentLightRadius = maxRadius * 0.001;
            let switchProcess = { currentPointMode: opts.pointcloudMode, stepRate: 0.0015, currentLightRadius, stop: false };
            arySwitchProcess.push(switchProcess);

            fire(
                RunLoopByFrame,
                () => {
                    if (disposed) return;
                    switchProcess.currentLightRadius += maxRadius * switchProcess.stepRate; // 动态增量
                    fire(SplatUpdateCurrentLightRadius, switchProcess.currentLightRadius);
                    if (switchProcess.currentLightRadius > maxRadius) {
                        fire(SplatUpdatePointMode, !switchProcess.currentPointMode); // 根据开始时的点云显示模式进行切换
                        fire(SplatUpdateCurrentLightRadius, 0); // 光圈停止
                        switchProcess.stop = true; // 主动完成
                        arySwitchProcess.length === 1 && arySwitchProcess[0] === switchProcess && arySwitchProcess.pop();
                        fire(OnSmallSceneShowDone, showMark);
                    } else if (switchProcess.currentLightRadius / maxRadius < 0.4) {
                        switchProcess.stepRate = Math.min(switchProcess.stepRate * 1.02, 0.03); // 前半圈提速并限速
                    } else {
                        switchProcess.stepRate *= 1.04; // 后半圈加速
                    }
                },
                () => !disposed && !switchProcess.stop,
            );
        } else {
            // 以屏幕中心过渡
            fire(SplatUpdatePerformanceAct, performance.now());
            fire(SplatUpdateCurrentLightRadius, 0.1);
            setTimeout(() => {
                fire(SplatUpdatePointMode); // 根据开始时的点云显示模式进行切换
                fire(SplatUpdateCurrentLightRadius, 0); // 停止过渡
                fire(OnSmallSceneShowDone, showMark);
            }, 500);
        }
    });

    on(
        OnSmallSceneShowDone,
        (showMark: boolean = false) => {
            if (fire(IsBigSceneMode)) return;
            fire(SplatUpdateParticleMode, 0); // 若有，停止粒子加载效果
            showMark && fire(GetOptions).viewerEvents?.fire(MarkUpdateVisible);
            fire(GetOptions).viewerEvents?.fire(FlyOnce);
        },
        true,
    );

    on(CreateSplatUniforms, (texwidth: number) => {
        return {
            [VarSplatTextureWidth]: { type: 'int', value: texwidth },
            [VarSplatTexture0]: { type: 't', value: null },
            [VarSplatTexture1]: { type: 't', value: null },
            [VarSplatShTexture12]: { type: 't', value: null },
            [VarSplatShTexture3]: { type: 't', value: null },
            [VarShPalettes]: { type: 't', value: null },
            [VarShPalettesReady]: { type: 'bool', value: false },
            [VarFocal]: { type: 'v2', value: new Vector2() },
            [VarViewport]: { type: 'v2', value: new Vector2() },
            [VarUsingIndex]: { type: 'int', value: 0 },
            [VarTransitionEffect]: { type: 'int', value: 1 },
            [VarPointMode]: { type: 'bool', value: false },
            [VarDebugEffect]: { type: 'bool', value: true },
            [VarBigSceneMode]: { type: 'bool', value: false },
            [VarUseLod]: { type: 'bool', value: false },
            [VarShDegree]: { type: 'int', value: 0 },
            [VarLightFactor]: { type: 'float', value: 1 },
            [VarTopY]: { type: 'float', value: 0 },
            [VarCurrentVisibleRadius]: { type: 'float', value: 0 },
            [VarCurrentLightRadius]: { type: 'float', value: 0 },
            [VarMaxRadius]: { type: 'float', value: 0 },
            [VarMarkPoint]: { type: 'v4', value: new Vector4(0, 0, 0, -1) },
            [VarParticleMode]: { type: 'int', value: 0 },
            [VarPerformanceNow]: { type: 'float', value: performance.now() },
            [VarPerformanceAct]: { type: 'float', value: 0 },
            [VarMinPixelDiameter]: { type: 'float', value: 1.0 },
            [VarMaxPixelDiameter]: { type: 'float', value: 1024.0 },
            [VarMinAlpha]: { type: 'float', value: 2 / 255 },
            [VarWaterMarkColor]: { type: 'v4', value: new Vector4(1, 1, 0, 0.5) },
            [VarShowWaterMark]: { type: 'bool', value: false },
            [VarUseSimilarExp]: { type: 'bool', value: true },
            [VarFlagValue]: { type: 'uint', value: 1 },
            [VarActiveFlagValue]: { type: 'uint', value: 0 },
        };
    });

    const worker: Worker = fire(GetWorker);
    worker.onmessage = e => {
        const data: any = e.data;
        if (data[WkSplatIndex]) {
            bucketBits = data[WkBucketBits];
            sortType = data[WkSortType];
            const ui32s: Uint32Array = data[WkSplatIndex];
            fire(SplatUpdateSplatIndex, ui32s, data[WkIndex], data[WkSortTime], data[WkSortStartTime], data[WkRenderSplatCount]);
            ui32s.length && worker.postMessage({ [WkSplatIndexDone]: ui32s }, [ui32s.buffer]);
        }
    };

    on(UploadSplatTexture, (texture: SplatTexdata, dataCurrentRadius: number, dataMaxRadius: number) => {
        if (!fire(IsBigSceneMode)) {
            currentMaxRadius = dataCurrentRadius;
            maxRadius = dataMaxRadius;
        }
        fire(SplatUpdateTexture, texture);
    });
    function notifyWorkerTextureReady(texture: SplatTexdata) {
        const xyz = texture.xyz.slice(0);
        worker.postMessage(
            {
                [WkTextureReady]: true,
                [WkXyz]: xyz,
                [WkWatermarkCount]: texture.watermarkCount,
                [WkIndex]: texture.index,
                [WkVersion]: texture.version,
                [WkRenderSplatCount]: texture.renderSplatCount,
                [WkVisibleSplatCount]: texture.visibleSplatCount,
                [WkModelSplatCount]: texture.modelSplatCount,
                [WkMinX]: texture.minX,
                [WkMaxX]: texture.maxX,
                [WkMinY]: texture.minY,
                [WkMaxY]: texture.maxY,
                [WkMinZ]: texture.minZ,
                [WkMaxZ]: texture.maxZ,
            },
            [xyz.buffer],
        );
    }
}
