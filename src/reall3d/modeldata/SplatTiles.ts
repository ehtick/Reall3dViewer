// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { SpxHeader } from './ModelData';

export const SplatLodJsonMagic = 'splat-lod';

export interface SplatTiles {
    version: number;
    magic: string;
    comment?: string;
    lodLevels: number;
    totalCount: number;
    mobileCacheCount?: number;
    pcCacheCount?: number;
    lodDistances: number[]; // 距离层级阈值，从低分辨率到高分辨率，长度等于层级数量
    files: Record<string, SplatFile>;
    tree: SplatTileNode;

    // 内部计算用
    fetchSet?: Set<string>; // 下载统计
    topLodReady?: boolean;
}

export interface SplatFile {
    fileKey: string;
    url: string;
    lod: number;

    // 状态
    status?: DataStatus;
    lastTime?: number;

    // 数据
    spxHeader?: SpxHeader;
    downloadCount?: number;
    downloadData?: Uint8Array;
    abortController?: AbortController;

    // 内部计算用
    currentDistance?: number;
}

export interface SplatTileNode {
    center: number[];
    radius: number;
    fileKey?: string;
    children?: SplatTileNode[];
    lods?: TileMapping[];

    // 内部计算用
    currentDistance?: number;
    currentVisible?: boolean;
    currentRenderLod?: number;
}

export interface TileMapping {
    fileKey: string;
    offset: number;
    count: number;
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

export function traveSplatTree(splatNode: SplatTileNode, fnCall: (node: SplatTileNode) => any) {
    if (fnCall(splatNode) !== false) {
        const children: SplatTileNode[] = splatNode.children || [];
        for (let cld of children) {
            traveSplatTree(cld, fnCall);
        }
    }
}
