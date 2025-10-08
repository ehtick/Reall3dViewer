// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Vector3 } from 'three';
import { CameraInfo } from '../controls/SetupCameraControls';
import { ModelOptions } from './ModelOptions';

/**
 * SPX file header information
 */
export class SpxHeader {
    public Fixed: string;
    public Version: number;
    public SplatCount: number;
    public MinX: number;
    public MaxX: number;
    public MinY: number;
    public MaxY: number;
    public MinZ: number;
    public MaxZ: number;
    public MinTopY: number;
    public MaxTopY: number;
    public CreateDate: number;
    public CreaterId: number;
    public ExclusiveId: number;
    public ShDegree: number;
    public Flag1: number;
    public Flag2: number;
    public Flag3: number;
    public Reserve1: number;
    public Reserve2: number;
    public Comment: string;

    public HashCheck: boolean;
}

/**
 * Splat model
 */
export class SplatModel {
    /** Model options */
    public readonly opts: ModelOptions;

    /** File size (bytes) */
    public fileSize: number = 0;
    /** Downloaded size (bytes) */
    public downloadSize: number = 0;

    /** Current model status */
    public status: ModelStatus = ModelStatus.FetchReady;

    /** Raw model data */
    public splatData: Uint8Array = null;
    /** Watermark data */
    public watermarkData: Uint8Array = null;
    /** Number of Gaussians in the model */
    public dataSplatCount: number = 0;
    /** Number of watermark Gaussians */
    public watermarkCount: number = 0;

    /** Spherical harmonics (level 1 or 1+2) */
    public sh12Data: Uint8Array[] = [];
    /** Spherical harmonics (level 3 only) */
    public sh3Data: Uint8Array[] = [];
    /** Downloaded SH (level 1 or 1+2) count */
    public sh12Count: number = 0;
    /** Downloaded SH (level 3 only) count */
    public sh3Count: number = 0;

    /** Byte length of a single Gaussian record */
    public rowLength: number = 0;
    /** Total Gaussian count in the model */
    public modelSplatCount: number = -1;
    /** Downloaded Gaussian count */
    public downloadSplatCount: number = 0;
    /** Render-ready Gaussian count (dynamic for large scenes) */
    public renderSplatCount: number = 0;

    /** Abort controller for fetch cancellation */
    public abortController: AbortController;

    /** Header info for .spx format */
    public header: SpxHeader = null;

    public spzVersion: number;
    public sogVersion: number;

    public CompressionRatio: string = '';

    public dataShDegree: number = 0;

    /** Model metadata */
    public meta: MetaData;
    /** Map of cut data for large scenes */
    public map: Map<string, CutData>;

    /** Bounding box extents */
    public minX: number = Infinity;
    public maxX: number = -Infinity;
    public minY: number = Infinity;
    public maxY: number = -Infinity;
    public minZ: number = Infinity;
    public maxZ: number = -Infinity;
    /** Highest Y coordinate */
    public topY: number = 0;
    public currentRadius: number = 0;
    public aabbCenter: Vector3;
    /** Bounding sphere radius for .spx */
    public maxRadius: number = 0;
    public metaMatrix: Matrix4;

    /** Flags */
    public notifyFetchStopDone: boolean;
    public smallSceneUploadDone: boolean;
    public textWatermarkVersion: number = 0;
    public lastTextWatermarkVersion: number = 0;

    public fetchLimit: number = 0;

    /** Active points data */
    public activePoints: any;

    constructor(opts: ModelOptions, meta: MetaData = {}) {
        this.opts = { ...opts };
        const that = this;

        that.meta = meta;
        meta.autoCut && (that.map = new Map());
        that.metaMatrix = meta.transform ? new Matrix4().fromArray(meta.transform) : null;

        if (!opts.format) {
            if (opts.url?.endsWith('.spx')) {
                that.opts.format = 'spx';
            } else if (opts.url?.endsWith('.splat')) {
                that.opts.format = 'splat';
            } else if (opts.url?.endsWith('.ply')) {
                that.opts.format = 'ply';
            } else if (opts.url?.endsWith('.spz')) {
                that.opts.format = 'spz';
            } else if (opts.url?.endsWith('.sog')) {
                that.opts.format = 'sog';
            } else {
                console.error('unknown format!');
            }
        }
        that.abortController = new AbortController();
    }
}

/**
 * Data chunk used in large-scene tiling
 */
export interface CutData {
    /** Number of Gaussians in this chunk */
    splatCount?: number;
    /** Raw data of this chunk */
    splatData?: Uint8Array;

    // Bounding box of the chunk
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
    minZ?: number;
    maxZ?: number;
    // Bounding sphere of the chunk
    center?: Vector3;
    radius?: number;

    /** Current renderable points (computed at runtime) */
    currentRenderCnt?: number;
    /** Distance to camera (computed at runtime) */
    distance?: number;
}

/**
 * Model status
 */
export enum ModelStatus {
    /** Ready */
    FetchReady = 0,
    /** In progress */
    Fetching,
    /** Completed successfully */
    FetchDone,
    /** Interrupted during request */
    FetchAborted,
    /** Request failed */
    FetchFailed,
    /** Invalid model format or data */
    Invalid,
}

/**
 * Metadata
 */
export interface MetaData {
    /** Name */
    name?: string;
    /** Version */
    version?: string;
    /** Update date (YYYYMMDD) */
    updateDate?: number;

    /** Enable auto-rotation */
    autoRotate?: boolean;
    /** Enable debug mode */
    debugMode?: boolean;
    /** Enable point-cloud rendering */
    pointcloudMode?: boolean;
    /** Maximum render count for mobile */
    maxRenderCountOfMobile?: number;
    /** Maximum render count for PC */
    maxRenderCountOfPc?: number;
    /** Maximum download count for mobile splats */
    mobileDownloadLimitSplatCount?: number;
    /** Maximum download count for PC splats */
    pcDownloadLimitSplatCount?: number;

    /** Meter scale factor */
    meterScale?: number;
    /** Text watermark */
    watermark?: string;
    /** Display watermark */
    showWatermark?: boolean;
    /** Display bounding box */
    showBoundBox?: boolean;
    /** Camera parameters */
    cameraInfo?: CameraInfo;
    /** Annotations */
    marks?: any[];
    /** Fly-through camera positions */
    flyPositions?: number[];
    /** Fly-through camera look-at points */
    flyTargets?: number[];

    /** render quality level */
    qualityLevel?: number;
    /** sort type */
    sortType?: number;
    /** depth near rate */
    depthNearRate?: number;
    /** depth near value */
    depthNearValue?: number;
    /** 最小可渲染直径像素 */
    minPixelDiameter?: number;
    /** 最大直径像素 */
    maxPixelDiameter?: number;
    /** 最小可渲染透明度 */
    minAlpha?: number;

    /** Enable particle loading effect (small scenes) */
    particleMode?: boolean;

    /** Auto-cut count */
    autoCut?: number;
    /** Transformation matrix */
    transform?: number[];
    /** Geolocation (EPSG:4326 WGS 84) */
    WGS84?: number[];
    /** Model URL */
    url?: string;
}
