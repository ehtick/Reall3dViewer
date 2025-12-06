// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { SpxHeader } from './ModelData';

export interface SplatCube3D {
    version: number;
    comment: string;
    totalCount: number;
    mobileCacheCount: number;
    lodDistances: number[]; // 距离层级阈值，从低分辨率到高分辨率，长度等于层级数量
    cubes: SplatCube[];
}

export interface SplatCube {
    // 元数据
    key: string;
    mins: number[];
    maxs: number[];
    center: number[];
    radius: number;

    // lodDistances: number[]; // 距离层级阈值
    lods: SplatLod[];

    // 内部计算用
    currentDistance: number;
    currentVisible: boolean;
    currentRenderCnt: number;
    currentFetchLodIndex: number;
    currentRenderLodIndex: number;
}

export interface SplatLod {
    level: number;
    url: string;
    count: number;

    // 状态
    status: DataStatus;
    lastTime: number;

    // 数据
    spxHeader: SpxHeader;
    downloadCount: number;
    downloadData?: Uint8Array;
    abortController: AbortController;

    // 内部计算用
    currentRenderCnt: number;
}

export enum DataStatus {
    None = 0,
    WaitFetch = 0b1,
    Fetching = 0b10,
    FetchDone = 0b100,
    FetchAborted = 0b1000,
    FetchFailed = 0b10000,
    Invalid = 0b100000,
}
