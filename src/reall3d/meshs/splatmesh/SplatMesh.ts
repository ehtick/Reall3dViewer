// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { Events } from '../../events/Events';
import {
    SplatUpdatePerformanceNow,
    SplatUpdatePointMode,
    SplatUpdateLightFactor,
    IsPointcloudMode,
    CreateSplatMesh,
    SplatMeshDispose,
    SplatTexdataManagerDispose,
    WorkerDispose,
    GetScene,
    GetOptions,
    GetCanvas,
    GetRenderer,
    IsBigSceneMode,
    SplatTexdataManagerAddModel,
    WorkerSort,
    SplatTexdataManagerDataChanged,
    NotifyViewerNeedUpdate,
    ViewerNeedUpdate,
    TraverseDisposeAndClear,
    GetCamera,
    GetCameraFov,
    GetCameraPosition,
    GetViewProjectionMatrixArray,
    GetViewProjectionMatrix,
    CommonUtilsDispose,
    GetSplatMesh,
    GetCameraLookAt,
    GetCameraDirection,
    SplatUpdateBoundBox,
    SplatSetBoundBoxVisible,
    GetRenderQualityLevel,
    WorkerUpdateParams,
    GetSortType,
    OnQualityLevelChanged,
    IsSplatMeshCreated,
    OnSmallSceneShowDone,
} from '../../events/EventConstants';
import { setupSplatTextureManager } from '../../modeldata/SplatTexdataManager';
import { SplatMeshOptions } from './SplatMeshOptions';
import { ModelOptions } from '../../modeldata/ModelOptions';
import { setupSplatMesh } from './SetupSplatMesh';
import { setupGaussianText } from '../../modeldata/text/SetupGaussianText';
import { setupApi } from '../../api/SetupApi';
import { initSplatMeshOptions } from '../../utils/ViewerUtils';
import { setupCommonUtils } from '../../utils/CommonUtils';
import { MetaData } from '../../modeldata/ModelData';
import { setupSorter } from '../../sorter/SetupSorter';
import { BoundBox } from '../boundbox/BoundBox';
import { QualityLevels, SortTypes } from '../../utils/consts/GlobalConstants';
import { AudioText } from '../../media/AudioText';

/**
 * Gaussian splatting mesh
 */
export class SplatMesh extends Mesh {
    public readonly isSplatMesh: boolean = true;
    public meta: MetaData;
    private disposed: boolean = false;
    private events: Events;
    private opts: SplatMeshOptions;
    private audioText: AudioText;
    public boundBox: BoundBox;

    /**
     * 构造函数
     * @param options 渲染器、场景、相机都应该传入
     */
    constructor(options: SplatMeshOptions) {
        super();
        const that = this;
        const events = new Events();
        const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
        const fire = (key: number, ...args: any): any => events.fire(key, ...args);
        let isSplatMeshCreated = false;

        const opts: SplatMeshOptions = initSplatMeshOptions(options); // 默认参数校验设定
        const camera = (opts.camera || opts.controls?.object) as PerspectiveCamera;
        on(GetOptions, () => opts);
        on(GetCanvas, () => opts.renderer.domElement);
        on(GetCamera, () => camera);
        on(GetCameraFov, () => camera.fov);
        on(GetCameraPosition, (copy: boolean = false) => (copy ? camera.position.clone() : camera.position));
        on(GetCameraLookAt, (copy: boolean = false) => (opts.controls ? (copy ? opts.controls.target.clone() : opts.controls.target) : new Vector3()));
        on(GetViewProjectionMatrixArray, () => camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).multiply(that.matrix).toArray());
        on(GetViewProjectionMatrix, () => camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse));
        on(GetCameraDirection, () => camera.getWorldDirection(new Vector3()).toArray());
        on(GetRenderer, () => opts.renderer);
        on(GetScene, () => opts.scene);
        on(IsBigSceneMode, () => opts.bigSceneMode);
        on(IsPointcloudMode, () => opts.pointcloudMode);
        on(GetSplatMesh, () => that);
        on(GetRenderQualityLevel, () => opts.qualityLevel || QualityLevels.Default5);
        on(GetSortType, () => opts.sortType || SortTypes.Default1);
        on(IsSplatMeshCreated, () => isSplatMeshCreated);

        on(NotifyViewerNeedUpdate, () => opts.viewerEvents?.fire(ViewerNeedUpdate));
        on(OnSmallSceneShowDone, () => !fire(IsBigSceneMode) && setTimeout(() => that.audioText?.play(), 5000), true);

        setupCommonUtils(events);
        setupApi(events);
        setupSplatTextureManager(events);
        setupSorter(events);
        setupSplatMesh(events);
        setupGaussianText(events);

        that.name = `${opts.name || that.id}`;

        that.events = events;
        that.opts = opts;

        (async () => {
            that.copy(await events.fire(CreateSplatMesh));
            that.meta.transform && that.applyMatrix4(new Matrix4().fromArray(that.meta.transform));
            that.frustumCulled = false;
            that.onBeforeRender = () => {
                fire(WorkerSort);
                fire(SplatUpdatePerformanceNow, performance.now());
            };
            that.onAfterRender = () => {
                fire(SplatTexdataManagerDataChanged, 10000) && fire(NotifyViewerNeedUpdate); // 纹理数据更新后10秒内总是要刷新
            };

            isSplatMeshCreated = true;
            fire(OnQualityLevelChanged);
        })();

        // 包围盒
        const boundBox = new BoundBox();
        boundBox.visible = false;
        boundBox.renderOrder = 99999;
        that.boundBox = boundBox;
        that.add(boundBox);
        on(SplatUpdateBoundBox, (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, show?: boolean) => {
            boundBox.update(minX, minY, minZ, maxX, maxY, maxZ, show);
        });
        on(SplatSetBoundBoxVisible, (visible: boolean = true) => (boundBox.visible = visible));
    }

    /**
     * 设定或者获取最新配置项
     * @param opts 配置项
     * @returns 最新配置项
     */
    public options(opts?: SplatMeshOptions): SplatMeshOptions {
        const that = this;
        if (that.disposed) return;
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);
        const thisOpts = that.opts;

        if (opts) {
            opts.pointcloudMode !== undefined && fire(SplatUpdatePointMode, opts.pointcloudMode);
            opts.lightFactor !== undefined && fire(SplatUpdateLightFactor, opts.lightFactor);
            opts.maxRenderCountOfMobile !== undefined && (thisOpts.maxRenderCountOfMobile = opts.maxRenderCountOfMobile);
            opts.maxRenderCountOfPc !== undefined && (thisOpts.maxRenderCountOfPc = opts.maxRenderCountOfPc);
            opts.qualityLevel !== undefined && (thisOpts.qualityLevel = opts.qualityLevel) && fire(OnQualityLevelChanged);
            !thisOpts.mapMode && opts.sortType !== undefined && (thisOpts.sortType = opts.sortType) && fire(WorkerUpdateParams);

            fire(NotifyViewerNeedUpdate);
        }
        return { ...thisOpts };
    }

    /**
     * 添加渲染指定高斯模型
     * @param opts 高斯模型选项
     * @param meta 元数据
     */
    public addModel(opts: ModelOptions, meta: MetaData = {}) {
        const that = this;
        if (that.disposed) return;
        that.meta = meta;
        that.audioText = new AudioText(meta.audio?.autoPlay, meta.audio?.mp3, meta.audio?.textDurations);
        that.events.fire(SplatTexdataManagerAddModel, opts, meta);
    }

    public fire(key: number, ...args: any): any {
        const that = this;
        if (that.disposed) return;
        return that.events.fire(key, ...args);
    }

    /**
     * 销毁
     */
    public dispose(): void {
        const that = this;
        if (that.disposed) return;
        that.disposed = true;
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);

        fire(TraverseDisposeAndClear, that);
        fire(TraverseDisposeAndClear, that.boundBox);
        fire(GetScene).remove(that);
        fire(GetScene).remove(that.boundBox);
        that.audioText?.dispose();

        fire(CommonUtilsDispose);
        fire(SplatTexdataManagerDispose);
        fire(WorkerDispose);
        fire(SplatMeshDispose);

        that.events.clear();
        that.events = null;
        that.opts = null;
        that.onAfterRender = null;
        that.boundBox = null;
        that.audioText = null;
    }
}
