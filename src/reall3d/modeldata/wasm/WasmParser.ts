// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { data190To19, data10190To10019, sh123To1, sh123To2, sh123To3 } from '../../utils/CommonUtils';
import {
    SplatDataSize16,
    SplatDataSize32,
    SpxBlockFormatData190,
    SpxBlockFormatData10190,
    SpxBlockFormatSH1,
    SpxBlockFormatSH2,
    SpxBlockFormatSH3,
    SpxBlockFormatSH4,
    WasmBlockSize,
} from '../../utils/consts/GlobalConstants';
import { SpxHeader } from '../ModelData';

const WasmDataV1 = `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`;
const WasmDataV2 = `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`;
const WasmOpen = `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`;

export async function parseSpxHeader(header: Uint8Array): Promise<SpxHeader> {
    const ui32s = new Uint32Array(header.buffer);
    const f32s = new Float32Array(header.buffer);
    const head = new SpxHeader();
    head.Fixed = String.fromCharCode(header[0]) + String.fromCharCode(header[1]) + String.fromCharCode(header[2]);
    head.Version = header[3];
    head.SplatCount = ui32s[1];
    head.MinX = f32s[2];
    head.MaxX = f32s[3];
    head.MinY = f32s[4];
    head.MaxY = f32s[5];
    head.MinZ = f32s[6];
    head.MaxZ = f32s[7];
    head.MinTopY = f32s[8];
    head.MaxTopY = f32s[9];
    head.CreateDate = ui32s[10];
    head.CreaterId = ui32s[11];
    head.ExclusiveId = ui32s[12];
    head.ShDegree = header[52];
    head.Flag1 = header[53];
    head.Flag2 = header[54];
    head.Flag3 = header[55];
    head.Reserve1 = ui32s[14];
    head.Reserve2 = ui32s[15];

    let comment: string = '';
    for (let i = 64; i < 124; i++) {
        comment += String.fromCharCode(header[i]);
    }
    head.Comment = comment.trim();

    head.HashCheck = true;
    if (head.Fixed !== 'spx' && head.Version !== 1) {
        return null;
    }

    // 哈希校验（检查模型是否由特定工具生成）
    const wasmBase64 = head.ExclusiveId ? WasmDataV2 : WasmOpen;
    const wasmModule = WebAssembly.compile(Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0)).buffer);
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    const instance = await WebAssembly.instantiate(await wasmModule, { env: { memory, expf } });
    const headerParser: any = instance.exports.H;

    const wasmMemory = new Uint8Array(memory.buffer);
    wasmMemory.set(header, 0);
    const code: number = headerParser(0);
    if (code) {
        head.HashCheck = false;
    }

    return head;
}

interface SpxBlockResult {
    splatCount: number;
    blockFormat: number;
    datas?: Uint8Array;
    isSplat?: boolean;
    isSh?: boolean;
    isSh1?: boolean;
    isSh2?: boolean;
    isSh3?: boolean;
    isSh23?: boolean;
    dataSh3?: Uint8Array;
    success: boolean;
}

export async function parseSpxBlockData(data: Uint8Array, header: SpxHeader = null): Promise<SpxBlockResult> {
    let ui32s = new Uint32Array(data.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const blockFormat = ui32s[1];

    if (blockFormat == SpxBlockFormatSH4) {
        if (header.ShDegree == SpxBlockFormatSH1) {
            const data1 = await sh123To1(data);
            return parseBlockData(splatCount, SpxBlockFormatSH1, data1, header.Version);
        } else if (header.ShDegree == SpxBlockFormatSH2) {
            const data2 = await sh123To2(data);
            return parseBlockData(splatCount, SpxBlockFormatSH2, data2, header.Version);
        } else if (header.ShDegree == SpxBlockFormatSH3) {
            const data2 = await sh123To2(data);
            const data3 = await sh123To3(data);
            const rs2 = await parseBlockData(splatCount, SpxBlockFormatSH2, data2, header.Version);
            const rs3 = await parseBlockData(splatCount, SpxBlockFormatSH3, data3, header.Version);
            rs2.success = rs2.success && rs3.success;
            rs2.isSh23 = true;
            rs2.dataSh3 = rs3.datas;
            return rs2;
        }
    }

    if (blockFormat == SpxBlockFormatData190) {
        data = await data190To19(data);
    } else if (blockFormat == SpxBlockFormatData10190) {
        data = await data10190To10019(data);
    }
    return parseBlockData(splatCount, blockFormat, data, header?.Version || 1);
}

async function parseBlockData(splatCount: number, blockFormat: number, data: Uint8Array, spxVer: number): Promise<SpxBlockResult> {
    const isSh1: boolean = SpxBlockFormatSH1 == blockFormat;
    const isSh2: boolean = SpxBlockFormatSH2 == blockFormat;
    const isSh3: boolean = SpxBlockFormatSH3 == blockFormat;
    const isSh: boolean = isSh1 || isSh2 || isSh3;
    const isSplat: boolean = !isSh;
    const isOpenFormat = blockFormat < 65536;

    const wasmBase64 = isOpenFormat ? WasmOpen : spxVer > 1 ? WasmDataV2 : WasmDataV1;
    const resultByteLength = splatCount * (isSh ? SplatDataSize16 : SplatDataSize32);
    const wasmModule = WebAssembly.compile(Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0)).buffer);
    const blockCnt: number = Math.floor((resultByteLength + data.byteLength) / WasmBlockSize) + 2;
    const memory = new WebAssembly.Memory({ initial: blockCnt, maximum: blockCnt });
    const instance = await WebAssembly.instantiate(await wasmModule, { env: { memory, expf } });
    const dataParser: any = instance.exports.D;

    const wasmMemory = new Uint8Array(memory.buffer);
    wasmMemory.set(data, resultByteLength);
    const code = dataParser(0, resultByteLength);
    if (code) return { splatCount, blockFormat, success: false };
    return { splatCount, blockFormat, success: true, datas: wasmMemory.slice(0, resultByteLength), isSplat, isSh, isSh1, isSh2, isSh3 };
}

export async function parseSplatToTexdata(data: Uint8Array, splatCount: number): Promise<Uint8Array> {
    const wasmModule = WebAssembly.compile(Uint8Array.from(atob(WasmOpen), c => c.charCodeAt(0)).buffer);
    const blockCnt = Math.floor((splatCount * SplatDataSize32) / WasmBlockSize) + 2;
    const memory = new WebAssembly.Memory({ initial: blockCnt, maximum: blockCnt });
    const instance = await WebAssembly.instantiate(await wasmModule, { env: { memory, expf } });
    const dataParser: any = instance.exports.s;

    const wasmMemory = new Uint8Array(memory.buffer);
    wasmMemory.set(data.slice(0, splatCount * SplatDataSize32), 0);
    const code: number = dataParser(0, splatCount);
    if (code) {
        console.error('splat data parser failed:', code);
        return new Uint8Array(0);
    }

    return wasmMemory.slice(0, splatCount * SplatDataSize32);
}

export async function parseWordToTexdata(x: number, y0z: number, isY: boolean = true, isNgativeY: boolean = true): Promise<Uint8Array> {
    const wasmModule = WebAssembly.compile(Uint8Array.from(atob(WasmDataV2), c => c.charCodeAt(0)).buffer);
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    const instance = await WebAssembly.instantiate(await wasmModule, { env: { memory, expf } });
    const dataSplat: any = instance.exports.w;

    const wasmMemory = new Uint8Array(memory.buffer);
    const f32s = new Float32Array(wasmMemory.buffer);
    const ngativeY = isNgativeY ? -1 : 1;
    f32s[0] = x;
    isY ? (f32s[1] = ngativeY * y0z) : (f32s[2] = ngativeY * y0z);
    dataSplat(0, isY ? 1 : 0);
    return wasmMemory.slice(0, SplatDataSize32);
}

function expf(v: number) {
    return Math.exp(v);
}
