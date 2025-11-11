// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Audio, Camera, Frustum, Matrix4, Object3D, PerspectiveCamera, ShaderChunk, Vector3 } from 'three';
import { Events } from '../events/Events';
import {
    Vector3ToString,
    IsFetching,
    RunLoopByFrame,
    RunLoopByTime,
    GetOptions,
    OnFetchStop,
    OnFetchStart,
    Information,
    IsDebugMode,
    IsSmallSceneRenderDataReady,
    OnTextureReadySplatCount,
    OnFetching,
    EncodeBase64,
    DecodeBase64,
    GetCanvasSize,
    GetCanvas,
    TraverseDisposeAndClear,
    IsCameraChangedNeedLoadData,
    GetCamera,
    CommonUtilsDispose,
    IsCameraLookAtPoint,
    GetControls,
} from '../events/EventConstants';
import { SplatMeshOptions } from '../meshs/splatmesh/SplatMeshOptions';
import { QualityLevels, ViewerVersion } from './consts/GlobalConstants';
import { XzReadableStream } from 'xz-decompress';
import { unzip, unzipSync } from 'fflate';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

export function setupCommonUtils(events: Events) {
    let disposed: boolean = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    on(IsDebugMode, () => fire(GetOptions).debugMode);

    on(CommonUtilsDispose, () => (disposed = true));

    // 按帧率执行
    let iFrameCount: number = 0;
    (function countFrame() {
        iFrameCount++;
        !disposed && requestAnimationFrame(countFrame);
    })();

    on(RunLoopByFrame, (fnRun: Function, fnIsContinue: Function = null, div: number = 0) => {
        const run = () => {
            if (!disposed) {
                div > 0 ? !(iFrameCount % div) && fnRun(iFrameCount) : fnRun(iFrameCount);
                fnIsContinue && fnIsContinue() && requestAnimationFrame(run);
            }
        };
        run();
    });

    // 默认按每秒50次执行
    on(RunLoopByTime, (fnRun: Function, fnIsContinue: Function = null, delay: number = 20) => {
        const run = () => {
            if (!disposed) {
                fnRun();
                fnIsContinue && fnIsContinue() && setTimeout(run, delay);
            }
        };
        run();
    });

    let loading = false;
    let renderSplatCount: number = 0;
    let textureReadySplatCount: number = 0;
    on(OnFetchStart, () => {
        loading = true;

        (async () => {
            const wrap: HTMLElement = document.querySelector('#gsviewer #progressBarWrap');
            if (wrap) {
                wrap.style.display = 'block';
                const dom: HTMLElement = document.querySelector('#gsviewer #progressBar');
                dom && (dom.style.width = `0%`);
            }
        })();
        (async () => document.querySelector('#gsviewer .logo')?.classList.add('loading'))();
        // @ts-ignore
        parent?.onProgress && parent.onProgress(0.001, '0.001%');
        // @ts-ignore
        window.onProgress && window.onProgress(0.001, '0.001%');
    });
    on(OnFetchStop, (totalRenderSplatCount: number) => {
        totalRenderSplatCount && (renderSplatCount = totalRenderSplatCount);
        loading = false;

        if (totalRenderSplatCount !== undefined) {
            (async () => {
                const wrap: HTMLElement = document.querySelector('#gsviewer #progressBarWrap');
                wrap && (wrap.style.display = 'none');
            })();
            (async () => document.querySelector('#gsviewer .logo')?.classList.remove('loading'))();

            // @ts-ignore
            parent?.onProgress && parent.onProgress(0, '100%', 9); // 用自定义的 9 代表完全加载完成
            // @ts-ignore
            window.onProgress && window.onProgress(0, '100%', 9); // 用自定义的 9 代表完全加载完成
        }
    });
    on(OnFetching, (per: number) => {
        loading = true;
        (async () => {
            const dom: HTMLElement = document.querySelector('#gsviewer #progressBar');
            dom && (dom.style.width = `${per}%`);
        })();
        // @ts-ignore
        parent?.onProgress && parent.onProgress(per, `${per}%`);
        // @ts-ignore
        window.onProgress && window.onProgress(per, `${per}%`);
    });
    on(IsFetching, () => loading);
    on(OnTextureReadySplatCount, (renderCount: number) => {
        textureReadySplatCount = renderCount;
    });
    on(IsSmallSceneRenderDataReady, () => {
        return !loading && renderSplatCount && textureReadySplatCount >= renderSplatCount;
    });

    on(GetCanvasSize, () => {
        const root: HTMLElement = (fire(GetCanvas) as HTMLCanvasElement).parentElement;
        const rect = root.getBoundingClientRect();
        return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    });

    on(Vector3ToString, (v: Vector3): string => {
        let x = v.x.toFixed(3).split('.');
        let y = v.y.toFixed(3).split('.');
        let z = v.z.toFixed(3).split('.');
        if (x[1] === '000' || x[1] === '00000') x[1] = '0';
        if (y[1] === '000' || y[1] === '00000') y[1] = '0';
        if (z[1] === '000' || z[1] === '00000') z[1] = '0';
        return `${x.join('.')}, ${y.join('.')}, ${z.join('.')}`;
    });

    on(EncodeBase64, (str: string): string => btoa(str));
    on(DecodeBase64, (str: string): string => atob(str));

    const epsilon = 0.001;
    let lastLoadDataPosition: Vector3 = new Vector3();
    let lastLoadDataDirection2: Vector3 = new Vector3();
    let lastLoadDataFov: number = 0;
    on(IsCameraChangedNeedLoadData, () => {
        const camera: PerspectiveCamera = fire(GetCamera);
        const fov = camera.fov;
        const position = camera.position.clone();
        const direction = camera.getWorldDirection(new Vector3());
        if (
            Math.abs(lastLoadDataFov - fov) < epsilon &&
            Math.abs(position.x - lastLoadDataPosition.x) < epsilon &&
            Math.abs(position.y - lastLoadDataPosition.y) < epsilon &&
            Math.abs(position.z - lastLoadDataPosition.z) < epsilon &&
            Math.abs(direction.x - lastLoadDataDirection2.x) < epsilon &&
            Math.abs(direction.y - lastLoadDataDirection2.y) < epsilon &&
            Math.abs(direction.z - lastLoadDataDirection2.z) < epsilon
        ) {
            return false;
        }

        lastLoadDataFov = fov;
        lastLoadDataPosition = position;
        lastLoadDataDirection2 = direction;

        return true;
    });

    on(TraverseDisposeAndClear, (obj3d: Object3D) => {
        if (!obj3d) return;

        const objects: any[] = [];
        obj3d.traverse((object: any) => objects.push(object));
        objects.forEach((object: any) => {
            if (object.dispose) {
                object.dispose();
            } else {
                object.geometry?.dispose?.();
                object.material && object.material instanceof Array
                    ? object.material.forEach((material: any) => material?.dispose?.())
                    : object.material?.dispose?.();
            }
        });
        obj3d.clear();
    });

    on(
        Information,
        async ({
            renderSplatCount,
            visibleSplatCount,
            modelSplatCount,
            fps,
            realFps,
            sortTime,
            bucketBits,
            sortType,
            qualityLevel,
            fov,
            position,
            lookUp,
            lookAt,
            worker,
            scene,
            // updateSceneData,
            scale,
            cuts,
            shDegree,
        }: Partial<Record<string, any>> = {}) => {
            if (!fire(IsDebugMode)) return;

            shDegree !== undefined && setInfo('shDegree', `${shDegree}`);
            renderSplatCount !== undefined && setInfo('renderSplatCount', `${renderSplatCount}`);
            visibleSplatCount !== undefined && setInfo('visibleSplatCount', `${visibleSplatCount}`);
            modelSplatCount !== undefined && setInfo('modelSplatCount', `${modelSplatCount}`);
            // models && setInfo('models', models);
            // renderModels !== undefined && setInfo('renderModels', renderModels);
            fps !== undefined && setInfo('fps', fps);
            realFps !== undefined && setInfo('realFps', `raw ${realFps}`);
            sortTime !== undefined &&
                setInfo('sort', `${sortTime} ms （L ${fire(GetOptions).qualityLevel || QualityLevels.Default5}, ${bucketBits} B, T ${sortType}）`);
            cuts !== undefined && setInfo('cuts', cuts === '' ? '' : `（${cuts} cuts）`);
            worker && setInfo('worker', `${worker}`);
            // updateSceneData && setInfo('updateSceneData', `（up ${updateSceneData} ms）`);
            scene && setInfo('scene', scene);
            fov && setInfo('fov', fov);
            position && setInfo('position', position);
            lookUp && setInfo('lookUp', lookUp);
            lookAt && setInfo('lookAt', lookAt);
            lookAt && setInfo('viewer-version', ViewerVersion);

            // @ts-ignore
            let memory = performance.memory || { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
            let strMemory = '';
            let usedJSHeapSize = memory.usedJSHeapSize / 1024 / 1024;
            usedJSHeapSize > 1000 ? (strMemory += (usedJSHeapSize / 1024).toFixed(2) + ' G') : (strMemory += usedJSHeapSize.toFixed(0) + ' M');
            strMemory += ' / ';
            let totalJSHeapSize = memory.totalJSHeapSize / 1024 / 1024;
            totalJSHeapSize > 1000 ? (strMemory += (totalJSHeapSize / 1024).toFixed(2) + ' G') : (strMemory += totalJSHeapSize.toFixed(0) + ' M');
            let jsHeapSizeLimit = memory.jsHeapSizeLimit / 1024 / 1024;
            strMemory += ' / ';
            jsHeapSizeLimit > 1000 ? (strMemory += (jsHeapSizeLimit / 1024).toFixed(2) + ' G') : (strMemory += jsHeapSizeLimit.toFixed(0) + ' M');
            setInfo('memory', strMemory);

            scale && setInfo('scale', scale);
        },
    );
    async function setInfo(name: string, txt: any) {
        let dom: HTMLDivElement = document.querySelector(`#gsviewer .debug .${name}`);
        dom && (dom.innerText = txt);
    }
}

export const shaderChunk = ShaderChunk;

export function initSplatMeshOptions(options: SplatMeshOptions): SplatMeshOptions {
    const opts: SplatMeshOptions = { ...options };

    // 默认参数校验设定
    opts.pointcloudMode ??= !opts.bigSceneMode; // 小场景默认点云模式，大场景默认正常模式
    opts.lightFactor ??= 1.0;
    opts.maxRenderCountOfMobile ??= opts.bigSceneMode ? 256 * 10000 : (256 + 32) * 10000;
    opts.maxRenderCountOfPc ??= opts.bigSceneMode ? (256 + 64) * 10000 : (256 + 128) * 10000;
    opts.debugMode ??= location.protocol === 'http:' || /^test\./.test(location.host); // 生产环境不开启

    return opts;
}

export const decodeB64 = atob;

/** 是否7天内 */
export function isNeedReload(yyyymmdd: number = 0): boolean {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return yyyymmdd >= date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export function clipUint8(value: number): number {
    return value < 0 ? 0 : value > 255 ? 255 : value | 0;
}

export function encodeSplatSH(val: number): number {
    const encodeSHval = clipUint8(Math.round(val * 128) + 128);
    return clipUint8(Math.floor((encodeSHval + 4) / 8) * 8);
}

export function computeCompressionRatio(splatCount: number, bytelength: number): string {
    const plySize = 1500 + splatCount * 248;
    const compressionRatio = plySize / bytelength;
    return compressionRatio.toFixed(2) + 'x';
}

export async function DecompressGzip(data: Uint8Array): Promise<Uint8Array> {
    try {
        const stream = new ReadableStream({
            async start(controller: any) {
                controller.enqueue(data);
                controller.close();
            },
        });

        const rs = new Response(stream.pipeThrough(new DecompressionStream('gzip')));
        return new Uint8Array(await rs.arrayBuffer());
    } catch (error) {
        console.error('Decompress gzip failed:', error);
        return null;
    }
}

export async function DecompressXZ(datas: Uint8Array): Promise<Uint8Array> {
    try {
        const url = URL.createObjectURL(new Blob([datas as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
        const compressedResponse = await fetch(url);

        const decompressedResponse = new Response(new XzReadableStream(compressedResponse.body));
        return new Uint8Array(await decompressedResponse.arrayBuffer());
    } catch (error) {
        console.error('Decompress xz failed:', error);
        return null;
    }
}

export function showTvText(txt: string, duration: number, audio: Audio): Promise<boolean> {
    return new Promise((res, rej) => {
        const div: HTMLDivElement = document.querySelector('.tv-text');
        if (div) {
            div.innerText = txt;
            div.classList.remove('hide');
        }
        setTimeout(() => {
            clearTvText();
            if (audio.isPlaying) {
                setTimeout(() => res(true), 200);
            } else {
                rej('stop');
            }
        }, duration);
    });
}

export function clearTvText() {
    const div: HTMLDivElement = document.querySelector('.tv-text');
    if (div) {
        div.classList.add('hide');
        div.innerText = '';
    }
}

export async function data190To19(data190: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data190.slice(0, 12).buffer);
    const splatCount = ui32s[0];
    const size1 = ui32s[2];
    let offset = 8;
    const data1: Uint8Array = data190.slice(offset + 4, offset + 4 + size1);
    const { rgba: rgba1 } = await webpToRgba(data1);
    offset += 4 + size1;
    const size2 = new Uint32Array(data190.slice(offset, offset + 4).buffer)[0];
    const data2: Uint8Array = data190.slice(offset + 4, offset + 4 + size2);
    const { rgba: rgba2 } = await webpToRgba(data2);
    offset += 4 + size2;
    const size3 = new Uint32Array(data190.slice(offset, offset + 4).buffer)[0];
    const data3: Uint8Array = data190.slice(offset + 4, offset + 4 + size3);
    const { rgba: rgba3 } = await webpToRgba(data3);
    offset += 4 + size3;
    const size4 = new Uint32Array(data190.slice(offset, offset + 4).buffer)[0];
    const data4: Uint8Array = data190.slice(offset + 4, offset + 4 + size4);
    const { rgba: rgba4 } = await webpToRgba(data4);

    const rs = new Uint8Array(8 + splatCount * 19);
    let n = 0;
    rs[n] = data190[n++];
    rs[n] = data190[n++];
    rs[n] = data190[n++];
    rs[n] = data190[n++];
    rs[n++] = 19;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 0]; // x0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 1]; // y0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 2]; // z0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 0]; // x1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 1]; // y1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 2]; // z1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 0]; // x2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 1]; // y2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 2]; // z2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 0]; // sx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 1]; // sy
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 2]; // sz
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 0]; // r
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 1]; // g
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 2]; // b
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 3]; // a
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 0]; // rx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 1]; // ry
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 2]; // rz
    }

    return rs;
}

export async function data10190To10019(data10190: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data10190.slice(0, 16).buffer);
    const splatCount = ui32s[0];
    const size1 = ui32s[3];
    let offset = 12;
    const data1: Uint8Array = data10190.slice(offset + 4, offset + 4 + size1);
    const { rgba: rgba1 } = await webpToRgba(data1);
    offset += 4 + size1;
    const size2 = new Uint32Array(data10190.slice(offset, offset + 4).buffer)[0];
    const data2: Uint8Array = data10190.slice(offset + 4, offset + 4 + size2);
    const { rgba: rgba2 } = await webpToRgba(data2);
    offset += 4 + size2;
    const size3 = new Uint32Array(data10190.slice(offset, offset + 4).buffer)[0];
    const data3: Uint8Array = data10190.slice(offset + 4, offset + 4 + size3);
    const { rgba: rgba3 } = await webpToRgba(data3);
    offset += 4 + size3;
    const size4 = new Uint32Array(data10190.slice(offset, offset + 4).buffer)[0];
    const data4: Uint8Array = data10190.slice(offset + 4, offset + 4 + size4);
    const { rgba: rgba4 } = await webpToRgba(data4);

    const rs = new Uint8Array(8 + splatCount * 19);
    let n = 0;
    rs[n] = data10190[n++]; // 数量保持不变
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];
    rs[n++] = 35; // 格式转10019[35, 39, 0, 0]
    rs[n++] = 39;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n] = data10190[n++]; // log编码次数保持不变
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];

    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 0]; // x0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 1]; // y0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 2]; // z0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 0]; // x1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 1]; // y1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 2]; // z1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 0]; // x2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 1]; // y2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 2]; // z2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 0]; // sx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 1]; // sy
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 2]; // sz
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 0]; // r
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 1]; // g
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 2]; // b
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 3]; // a
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 0]; // rx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 1]; // ry
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 2]; // rz
    }

    return rs;
}

export async function data220Decode(data220: Uint8Array, hasSh: boolean): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data220.slice(0, 12).buffer);
    const splatCount = ui32s[0];
    const size1 = ui32s[2];
    let offset = 8;
    const data1: Uint8Array = data220.slice(offset + 4, offset + 4 + size1);
    const { rgba: rgbaPosition } = await webpToRgba(data1);
    offset += 4 + size1;
    const size2 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
    const data2: Uint8Array = data220.subarray(offset + 4, offset + 4 + size2);
    const { rgba: rgbaScale } = await webpToRgba(data2);
    offset += 4 + size2;
    const size3 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
    const data3: Uint8Array = data220.subarray(offset + 4, offset + 4 + size3);
    const { rgba: rgbaColor } = await webpToRgba(data3);
    offset += 4 + size3;
    const size4 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
    const data4: Uint8Array = data220.subarray(offset + 4, offset + 4 + size4);
    const { rgba: rgbaRotation } = await webpToRgba(data4);

    const rs = new Uint8Array(8 + splatCount * (hasSh ? 28 : 24));
    let n = 0;
    rs[n] = data220[n++]; // 数量保持不变
    rs[n] = data220[n++];
    rs[n] = data220[n++];
    rs[n] = data220[n++];
    rs[n++] = 220; // 格式220
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;
    let start = 8;
    rs.set(rgbaPosition.subarray(0, splatCount * 12), start);
    start += splatCount * 12;
    rs.set(rgbaScale.subarray(0, splatCount * 4), start);
    start += splatCount * 4;
    rs.set(rgbaColor.subarray(0, splatCount * 4), start);
    start += splatCount * 4;
    rs.set(rgbaRotation.subarray(0, splatCount * 4), start);
    if (hasSh) {
        offset += 4 + size4;
        const size5 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
        const data5: Uint8Array = data220.subarray(offset + 4, offset + 4 + size5);
        const { rgba } = await webpToRgba(data5);

        start += splatCount * 4;
        rs.set(rgba.subarray(0, splatCount * 4), start);
    }
    return rs;
}

export async function sh123To1(data123: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data123.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const data1: Uint8Array = data123.slice(8);
    const { rgba } = await webpToRgba(data1);

    const rs = new Uint8Array(8 + splatCount * 9);
    let n = 0;
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n++] = 1;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        for (let j = 0; j < 3; j++) {
            rs[n++] = rgba[i * 60 + j * 4 + 0];
            rs[n++] = rgba[i * 60 + j * 4 + 1];
            rs[n++] = rgba[i * 60 + j * 4 + 2];
        }
    }
    return rs;
}

export async function sh123To2(data123: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data123.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const data1: Uint8Array = data123.slice(8);
    const { rgba } = await webpToRgba(data1);

    const rs = new Uint8Array(8 + splatCount * 24);
    let n = 0;
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n++] = 2;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        for (let j = 0; j < 8; j++) {
            rs[n++] = rgba[i * 60 + j * 4 + 0];
            rs[n++] = rgba[i * 60 + j * 4 + 1];
            rs[n++] = rgba[i * 60 + j * 4 + 2];
        }
    }
    return rs;
}

export async function sh123To3(data123: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data123.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const data1: Uint8Array = data123.slice(8);
    const { rgba } = await webpToRgba(data1);

    const rs = new Uint8Array(8 + splatCount * 21);
    let n = 0;
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n++] = 3;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        for (let j = 8; j < 15; j++) {
            rs[n++] = rgba[i * 60 + j * 4 + 0];
            rs[n++] = rgba[i * 60 + j * 4 + 1];
            rs[n++] = rgba[i * 60 + j * 4 + 2];
        }
    }
    return rs;
}

export async function webpToRgba(webps: Uint8Array): Promise<{ width: number; height: number; rgba: Uint8Array }> {
    const blob = new Blob([webps as any], { type: 'image/webp' });
    const url = URL.createObjectURL(blob);
    const bmp = await createImageBitmap(await fetch(url).then(r => r.blob()));
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const imData = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const width = bmp.width;
    const height = bmp.height;
    bmp.close();
    URL.revokeObjectURL(url);
    return { width, height, rgba: imData.data as any };
}

export function unzipToMap(zipBytes: Uint8Array): Map<string, Uint8Array> {
    const map = new Map<string, Uint8Array>();

    try {
        const entries = unzipSync(zipBytes);
        for (const [filename, file] of Object.entries(entries)) {
            if (file) {
                const content = new Uint8Array(file);
                map.set(filename, content);
            }
        }
    } catch (error) {
        console.error('解压失败:', error);
    }

    return map;
}

export function uint8ArrayToString(uint8Array: Uint8Array): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(uint8Array);
}

export function logEncode(v: number): number {
    return Math.sign(v) * Math.log(Math.abs(v) + 1);
}

export function logDecode(v: number): number {
    return Math.sign(v) * (Math.exp(v) - 1);
}

export function loopByTime(fnRun: Function, fnIsContinue: Function = null, delay: number = 20) {
    const run = () => {
        fnRun();
        fnIsContinue?.() && setTimeout(run, delay);
    };
    run();
}

const frustum = new Frustum();
const projScreenMatrix = new Matrix4();
const viewMatrix = new Matrix4();
export function isInFrustum(camera: Camera, point: Vector3) {
    viewMatrix.copy(camera.matrixWorld).invert();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, viewMatrix);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    return frustum.containsPoint(point);
}
