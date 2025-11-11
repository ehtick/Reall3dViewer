// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { data190To19, data10190To10019, sh123To1, sh123To2, sh123To3, webpToRgba, data220Decode } from '../../utils/CommonUtils';
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
    SpxBlockFormatSH8,
    SpxBlockFormatSH9,
    SpxBlockFormatData220,
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
    if (head.Fixed !== 'spx') {
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
    palettes?: Uint8Array;
    success: boolean;
}

export async function parseSpxBlockData(data: Uint8Array, header: SpxHeader = null): Promise<SpxBlockResult> {
    let ui32s = new Uint32Array(data.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const blockFormat = ui32s[1];

    if (blockFormat == SpxBlockFormatSH8) {
        const splatCount = 0;
        const palettes: Uint8Array = data.subarray(8);
        const success = true;
        return { splatCount, blockFormat, palettes, success };
    } else if (blockFormat == SpxBlockFormatSH9) {
        const { rgba } = await webpToRgba(data.subarray(8));
        const splatCount = 0;
        const palettes: Uint8Array = rgba;
        const success = true;
        return { splatCount, blockFormat, palettes, success };
    }

    let shDegree = header?.ShDegree || 0;
    if (blockFormat == SpxBlockFormatSH4) {
        if (header.ShDegree == SpxBlockFormatSH1) {
            const data1 = await sh123To1(data);
            return parseBlockData(splatCount, SpxBlockFormatSH1, data1, header.Version, shDegree);
        } else if (header.ShDegree == SpxBlockFormatSH2) {
            const data2 = await sh123To2(data);
            return parseBlockData(splatCount, SpxBlockFormatSH2, data2, header.Version, shDegree);
        } else if (header.ShDegree == SpxBlockFormatSH3) {
            const data2 = await sh123To2(data);
            const data3 = await sh123To3(data);
            const rs2 = await parseBlockData(splatCount, SpxBlockFormatSH2, data2, header.Version, shDegree);
            const rs3 = await parseBlockData(splatCount, SpxBlockFormatSH3, data3, header.Version, shDegree);
            rs2.success = rs2.success && rs3.success;
            rs2.isSh23 = true;
            rs2.dataSh3 = rs3.datas;
            return rs2;
        }
    }

    if (blockFormat == SpxBlockFormatData190) {
        data = await data190To19(data);
    } else if (blockFormat == SpxBlockFormatData220) {
        data = await data220Decode(data, shDegree > 0);
    } else if (blockFormat == SpxBlockFormatData10190) {
        data = await data10190To10019(data);
    }
    return parseBlockData(splatCount, blockFormat, data, header?.Version || 1, shDegree);
}

async function parseBlockData(splatCount: number, blockFormat: number, data: Uint8Array, spxVer: number, shDegree: number): Promise<SpxBlockResult> {
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
    const code = dataParser(0, resultByteLength, shDegree);
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
