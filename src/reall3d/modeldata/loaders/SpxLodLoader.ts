// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { SplatDataSize20, SplatDataSize32, SpxHeaderSize, SpxOpenFormat0, SpxExclusiveFormatReall3d } from '../../utils/consts/GlobalConstants';
import { parseSpxBlockData, parseSpxHeader } from '../wasm/WasmParser';
import { SplatModel, SpxHeader } from '../ModelData';
import { DecompressGzip, DecompressXZ } from '../../utils/CommonUtils';
import { DataStatus, SplatFile, SplatTiles } from '../SplatTiles';

/** Specify the Recognizable Formats Here */
const ExclusiveFormats: number[] = [SpxOpenFormat0, SpxExclusiveFormatReall3d];

export async function loadSpxLod(model: SplatModel, splatTiles: SplatTiles, splatFile: SplatFile) {
    try {
        splatFile.status |= DataStatus.Fetching;
        splatFile.abortController = new AbortController();
        splatTiles.fetchSet.add(splatFile.url);
        const signal: AbortSignal = splatFile.abortController.signal;
        const cache = 'default'; // model.opts.fetchReload ? 'reload' : 'default';
        const req = await fetch(splatFile.url, { mode: 'cors', credentials: 'omit', cache, signal });
        if (req.status != 200) {
            console.warn(`fetch error: ${req.status}`);
            splatFile.status |= DataStatus.FetchFailed;
            return;
        }
        const reader = req.body.getReader();
        const contentLength = parseInt(req.headers.get('content-length') || '0');
        const dataSize = contentLength - SpxHeaderSize;
        if (dataSize < SplatDataSize20) {
            console.warn('data empty', model.opts.url);
            splatFile.status |= DataStatus.Invalid;
            return;
        }

        model.fileSize += contentLength;

        let headChunks: Uint8Array[] = [];
        let headChunk = new Uint8Array(SpxHeaderSize);
        let perValue = new Uint8Array(SplatDataSize32);
        let perByteLen: number = 0;
        let readBlockSize = false;
        let blockSize: number = 0;
        let fetchedBlockSize: number = 0;
        let blockValues: Uint8Array[];
        let isCompress = false;
        let compressType: number = 0; // 0:gzip, 1:xz

        while (true) {
            let { done, value } = await reader.read();
            if (done) break;

            if (headChunks) {
                headChunks.push(value);
                let size = 0;
                for (let i = 0; i < headChunks.length; i++) {
                    size += headChunks[i].byteLength;
                }
                if (size < SpxHeaderSize) {
                    continue;
                }

                let cnt = 0;
                for (let i = 0; i < headChunks.length; i++) {
                    if (cnt + headChunks[i].byteLength < SpxHeaderSize) {
                        headChunk.set(headChunks[i], cnt);
                        cnt += headChunks[i].byteLength;
                    } else {
                        headChunk.set(headChunks[i].subarray(0, SpxHeaderSize - cnt), cnt);
                        value = new Uint8Array(headChunks[i].slice(SpxHeaderSize - cnt));
                    }
                }

                // 解析头数据
                const h: SpxHeader = await parseSpxHeader(headChunk);
                if (!h) {
                    splatFile.status |= DataStatus.Invalid;
                    console.error(`invalid spx format`);
                    splatFile.abortController.abort();
                    break;
                }
                if (h.Version < 3) {
                    splatFile.status |= DataStatus.Invalid;
                    console.error(`unsupport spx version of lod scene`, h.Version);
                    splatFile.abortController.abort();
                    break;
                }

                splatFile.spxHeader = h;
                model.modelSplatCount += h.SplatCount;
                model.dataShDegree = h.ShDegree;
                headChunks = null;
                headChunk = null;

                // 文件头检查校验
                if (!ExclusiveFormats.includes(h.ExclusiveId)) {
                    // 属于无法识别的格式时停止处理，或者进一步结合CreaterId判断是否能识别，避免后续出现数据解析错误
                    splatFile.status |= DataStatus.Invalid;
                    console.error(`Unrecognized format, creater id =`, h.CreaterId, ', exclusive id =', h.ExclusiveId, h.Comment);
                    splatFile.abortController.abort();
                    break;
                }
            }

            // 读取块大小
            if (!readBlockSize) {
                if (perByteLen + value.byteLength < 4) {
                    perValue.set(value, perByteLen);
                    perByteLen += value.byteLength;
                    continue;
                }

                const ui8s = new Uint8Array(perByteLen + value.byteLength);
                ui8s.set(perValue.subarray(0, perByteLen), 0);
                ui8s.set(value, perByteLen);
                value = ui8s.slice(4);

                perByteLen = 0;
                readBlockSize = true;
                blockValues = [];
                fetchedBlockSize = 0;

                const i32 = new Int32Array(ui8s.slice(0, 4).buffer)[0];
                isCompress = i32 < 0; // 负数代表压缩
                compressType = (Math.abs(i32) >> 28) >>> 0; // 高位2~4位代表压缩方式
                blockSize = (Math.abs(i32) << 4) >>> 4; // 低位供28位代表块数据长度
            }

            // 块数据不足时，暂存
            let totalSize = fetchedBlockSize + value.byteLength;
            blockValues.push(value);
            if (totalSize < blockSize) {
                fetchedBlockSize += value.byteLength;
                continue;
            }

            // 解析块数据
            while (totalSize >= blockSize) {
                let ui8sBlock: Uint8Array = new Uint8Array(blockSize);
                let offset = 0;
                for (let i = 0; i < blockValues.length; i++) {
                    if (offset + blockValues[i].byteLength < blockSize) {
                        ui8sBlock.set(blockValues[i], offset);
                        offset += blockValues[i].byteLength;
                    } else {
                        ui8sBlock.set(blockValues[i].subarray(0, blockSize - offset), offset);
                        value = new Uint8Array(blockValues[i].slice(blockSize - offset)); // 剩余部分，可能足够长包含多块
                    }
                }

                if (isCompress) {
                    if (compressType === 0) {
                        ui8sBlock = await DecompressGzip(ui8sBlock);
                    } else if (compressType === 1) {
                        ui8sBlock = await DecompressXZ(ui8sBlock);
                    } else {
                        console.error('unsuported compress type:', compressType);
                    }
                }
                const spxBlock = await parseSpxBlockData(ui8sBlock, splatFile.spxHeader);
                if (!spxBlock.success) {
                    console.error('spx block data parser failed. block format:', spxBlock.blockFormat);
                    splatFile.status |= DataStatus.Invalid;
                    splatFile.abortController.abort();
                    break;
                }

                if (spxBlock.isSplat) {
                    !splatFile.downloadData && (splatFile.downloadData = new Uint8Array(splatFile.spxHeader.SplatCount * SplatDataSize32));
                    splatFile.downloadData.set(spxBlock.datas, splatFile.downloadCount * SplatDataSize32);
                    splatFile.downloadCount += spxBlock.splatCount;
                    model.downloadSplatCount += spxBlock.splatCount;
                } else if (spxBlock.palettes) {
                    model.palettes = spxBlock.palettes; // 调色板
                } else {
                    // ignore
                    console.warn('ignore unknow spx data');
                }

                if (value.byteLength < 4) {
                    // 剩余不足以读取下一个块长度，缓存起来待继续下载
                    perValue.set(value, 0);
                    perByteLen = value.byteLength;
                    readBlockSize = false; // 下回应读取块大小
                    break;
                } else {
                    // 读取块大小，并整理供继续解析（剩余数据要么还足够多个块，要么不足得继续下载）
                    const i32 = new Int32Array(value.slice(0, 4).buffer)[0];
                    isCompress = i32 < 0; // 负数代表压缩
                    compressType = (Math.abs(i32) >> 28) >>> 0; // 高位2~4位代表压缩方式
                    blockSize = (Math.abs(i32) << 4) >>> 4; // 低位供28位代表块数据长度

                    value = value.slice(4);
                    totalSize = value.byteLength;
                    blockValues = [value];
                    fetchedBlockSize = value.byteLength;
                }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn('Fetch Abort', model.opts.url);
            splatFile.status |= DataStatus.FetchAborted;
        } else {
            console.error(e);
            splatFile.status |= DataStatus.FetchFailed;
            splatFile.abortController.abort();
        }
        console.info(splatFile.url);
    } finally {
        splatFile.status |= DataStatus.FetchDone;
        splatTiles.fetchSet.delete(splatFile.url);
        splatFile.abortController = null;
    }
}
