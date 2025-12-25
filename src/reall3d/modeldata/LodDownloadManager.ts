// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { RunLoopByFrame, SplatTexdataManagerAddSplatLod, LodDownloadManagerAddLodMeta } from '../events/EventConstants';
import { Events } from '../events/Events';
import { getUrl } from '../utils/CommonUtils';
import { ModelOptions } from './ModelOptions';
import { DataStatus, SplatFile, SplatTiles } from './SplatTiles';

const MaxDownloadCount = 6;
const splatFileSet = new Set<SplatFile>();

export function todoDownload(splatFile: SplatFile) {
    splatFile && !splatFile.status && splatFileSet.add(splatFile);
}

export function setupLodDownloadManager(events: Events) {
    let disposed: boolean;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let splatTiles: SplatTiles;

    fire(
        RunLoopByFrame,
        () => checkDownload(),
        () => !disposed,
        30,
    );

    on(LodDownloadManagerAddLodMeta, async (opts: ModelOptions) => {
        try {
            const lodUrl = getUrl(opts.url, opts.baseUrl);
            const res = await fetch(lodUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
            if (res.status === 200) {
                splatTiles = await res.json();
                splatTiles.fetchSet = new Set<string>();

                for (let key of Object.keys(splatTiles.files)) {
                    const file = splatTiles.files[key];
                    file.url = getUrl(file.url, lodUrl);
                }
            } else {
                return console.error('lod scene file fetch failed, status:', res.status);
            }
        } catch (e) {
            return console.error('lod scene file fetch failed', e.message);
        }
    });

    function checkTopLodDownloadStatus() {
        if (splatTiles.topLodReady) return;
        for (let key of Object.keys(splatTiles.files)) {
            let file = splatTiles.files[key];
            if (file.lod === 0 && !file.downloadData) return;
        }
        splatTiles.topLodReady = true;
    }

    function checkDownload() {
        if (!splatTiles) return; // 无数据
        checkTopLodDownloadStatus();

        // 遍历检查
        let fetchingCnt = 0;
        let todoCnt = 0;
        let lod0Files: SplatFile[] = [];
        for (let file of Object.values(splatTiles.files)) {
            if (file.status) {
                file.status < DataStatus.FetchDone && fetchingCnt++;
            } else {
                todoCnt++;
                file.lod === 0 && lod0Files.length < MaxDownloadCount && lod0Files.push(file);
            }
        }
        if (!todoCnt || fetchingCnt >= MaxDownloadCount) return; // 无可下载或已并发受限

        // 顶层级优先下载
        for (let splatFile of lod0Files) {
            splatFile.downloadCount = 0;
            splatFile.lastTime = Date.now();
            splatFile.status = DataStatus.WaitFetch; // 待下载
            fire(SplatTexdataManagerAddSplatLod, splatTiles, splatFile); // status会被更新
        }
        if (lod0Files.length) return; // 让优先下载

        // 调整优先顺序
        let todos = [...splatFileSet];
        let dones = todos.filter(v => v.status >= DataStatus.FetchDone);
        todos = todos.filter(v => !v.status);
        todos.sort((a, b) => a.currentDistance - b.currentDistance); // 从近到远排序
        todos = todos.slice(0, Math.min(MaxDownloadCount - fetchingCnt, todos.length)); // 截取近处限制数内节点

        // 待下载
        for (let splatFile of todos) {
            splatFile.downloadCount = 0;
            splatFile.lastTime = Date.now();
            splatFile.status = DataStatus.WaitFetch; // 待下载
            fire(SplatTexdataManagerAddSplatLod, splatTiles, splatFile); // status会被更新
            splatFileSet.delete(splatFile);
        }
        for (let file of dones) {
            splatFileSet.delete(file);
        }
    }
}
