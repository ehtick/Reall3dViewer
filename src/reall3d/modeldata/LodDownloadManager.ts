// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { RunLoopByFrame, SplatTexdataManagerAddSplatLod, LodDownloadManagerAddLodMeta, GetOptions } from '../events/EventConstants';
import { Events } from '../events/Events';
import { SplatMeshOptions } from '../meshs/splatmesh/SplatMeshOptions';
import { getUrl } from '../utils/CommonUtils';
import { isMobile } from '../utils/consts/GlobalConstants';
import { MetaData } from './MetaData';
import { ModelOptions } from './ModelOptions';
import { DataStatus, SplatFile, SplatLodJsonMagic, SplatTiles, traveSplatTree } from './SplatTiles';

const MaxDownloadCount = 7;
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

    on(LodDownloadManagerAddLodMeta, async (opts: ModelOptions, sceneMeta: MetaData) => {
        const lodUrl = getUrl(opts.url, /^(http:|https:)/.test(sceneMeta.url) ? sceneMeta.url : opts.baseUrl);

        if (lodUrl.endsWith('lod-meta.json')) {
            let lodMeta: any = null;
            try {
                const res = await fetch(lodUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
                if (res.status === 200) {
                    lodMeta = await res.json();
                } else {
                    return console.error('lod scene file fetch failed, status:', res.status);
                }
            } catch (e) {
                return console.error('lod scene file fetch failed', e.message);
            }

            const files = {};
            for (let i = 0; i < lodMeta.filenames.length; i++) {
                files[i + ''] = { url: lodMeta.filenames[i] };
            }
            lodMeta.files = files;
            delete lodMeta.filenames;

            let totalCount = 0;
            traveSplatTree(lodMeta.tree, node => {
                const nd = node as any;
                const { center, radius } = calcCenterRadius(nd.bound.min, nd.bound.max);
                nd.center = center;
                nd.radius = radius;
                delete nd.bound;

                if (nd.lods) {
                    const lods = [];
                    for (let key of Object.keys(nd.lods)) {
                        const lod = parseInt(key);
                        const obj = nd.lods[key];
                        const fileKey = obj.file + '';
                        lods[lod] = { fileKey, offset: obj.offset, count: obj.count };
                        files[fileKey].lod = lod;
                        totalCount += obj.count;
                    }
                    nd.lods = lods;
                }
            });

            splatTiles = lodMeta;
            splatTiles.version = 1;
            splatTiles.magic = SplatLodJsonMagic;
            splatTiles.totalCount = totalCount;
            splatTiles.pcLodTargets = sceneMeta.pcLodTargets;
            splatTiles.mobileLodTargets = sceneMeta.mobileLodTargets;
            splatTiles.pcLodDistances = sceneMeta.pcLodDistances;
            splatTiles.mobileLodDistances = sceneMeta.mobileLodDistances;
            splatTiles.pcLodCacheCount = sceneMeta.pcLodCacheCount;
            splatTiles.mobileLodCacheCount = sceneMeta.mobileLodCacheCount;

            splatTiles.fetchSet = new Set<string>();
            splatTiles.lodTargets = getLodTargets(splatTiles);
            splatTiles.lodDistances = getLodDistances(splatTiles);

            for (let key of Object.keys(splatTiles.files)) {
                const file = splatTiles.files[key];
                file.url = getUrl(file.url, lodUrl);
            }
            if ((fire(GetOptions) as SplatMeshOptions).enableEnvironment && splatTiles.environment) {
                splatTiles.environment = { fileKey: 'environment', url: getUrl(splatTiles.environment as string, lodUrl) };
            }

            // console.log(JSON.parse(JSON.stringify(splatTiles)));
            return;
        }

        try {
            const res = await fetch(lodUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
            if (res.status === 200) {
                let lodJson = await res.json();

                splatTiles = lodJson;
                splatTiles.pcLodTargets = sceneMeta.pcLodTargets;
                splatTiles.mobileLodTargets = sceneMeta.mobileLodTargets;
                splatTiles.pcLodDistances = sceneMeta.pcLodDistances;
                splatTiles.mobileLodDistances = sceneMeta.mobileLodDistances;
                splatTiles.pcLodCacheCount = sceneMeta.pcLodCacheCount;
                splatTiles.mobileLodCacheCount = sceneMeta.mobileLodCacheCount;

                splatTiles.fetchSet = new Set<string>();
                splatTiles.lodTargets = getLodTargets(splatTiles);
                splatTiles.lodDistances = getLodDistances(splatTiles);

                for (let key of Object.keys(splatTiles.files)) {
                    const file = splatTiles.files[key];
                    file.url = getUrl(file.url, lodUrl);
                }
                if ((fire(GetOptions) as SplatMeshOptions)?.enableEnvironment && splatTiles.environment) {
                    splatTiles.environment = { fileKey: 'environment', url: getUrl(splatTiles.environment as string, lodUrl) };
                }

                // console.log(JSON.parse(JSON.stringify(splatTiles)));
            } else {
                return console.error('lod scene file fetch failed, status:', res.status);
            }
        } catch (e) {
            return console.error('lod scene file fetch failed', e.message);
        }
    });

    function checkTopLodDownloadStatus() {
        if (splatTiles.topLodReady) return;
        let ready = true;
        let cnt = 0;
        for (let key of Object.keys(splatTiles.files)) {
            let file = splatTiles.files[key];
            if (file.lod === splatTiles.lodLevels - 1) {
                if (++cnt > 4) {
                    return (splatTiles.topLodReady = true);
                }
                !file.downloadData && (ready = false);
            }
        }
        splatTiles.topLodReady = ready;
    }

    function checkDownload() {
        if (!splatTiles) return; // 无数据
        checkTopLodDownloadStatus();

        // 遍历检查
        let fetchingCnt = 0;
        let todoCnt = 0;
        let lod0Files: SplatFile[] = [];
        if ((splatTiles?.environment as SplatFile)?.url && !(splatTiles.environment as SplatFile).status) {
            lod0Files.push(splatTiles.environment as SplatFile);
        }
        for (let file of Object.values(splatTiles.files)) {
            if (file.status) {
                file.status < DataStatus.FetchDone && fetchingCnt++;
            } else {
                todoCnt++;
                file.lod === splatTiles.lodLevels - 1 && lod0Files.length < MaxDownloadCount && lod0Files.push(file);
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
        if (lod0Files.length) return; // 可能内含调色板，让优先下载完

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

    function getLodTargets(splatTiles: SplatTiles): number[] {
        let lodTargets = [...new Set((isMobile ? splatTiles.mobileLodTargets : splatTiles.pcLodTargets) || [])];
        if (!lodTargets?.length || lodTargets.length >= splatTiles.lodLevels) {
            lodTargets = [];
            for (let i = 0; i < splatTiles.lodLevels; i++) {
                lodTargets.push(i);
            }
        }
        lodTargets.sort((a, b) => a - b); // 升序
        return lodTargets;
    }

    function getLodDistances(splatTiles: SplatTiles): number[] {
        const tgtLodCount = splatTiles.lodTargets.length;
        let lodDistances = [...new Set((isMobile ? splatTiles.mobileLodDistances : splatTiles.pcLodDistances) || [])];

        if (lodDistances.length == tgtLodCount) {
            lodDistances.sort((a, b) => a - b); // 升序
            lodDistances[0] = 0; // 确保首个0
        } else if (lodDistances.length == tgtLodCount - 1) {
            lodDistances.push(0);
            lodDistances.sort((a, b) => a - b); // 升序
        } else {
            // 设定有误就重置
            lodDistances = [];
            for (let i = 0; i < tgtLodCount; i++) {
                lodDistances.push(i * 20);
            }
            lodDistances.sort((a, b) => a - b); // 升序
        }

        delete splatTiles.pcLodTargets;
        delete splatTiles.mobileLodTargets;
        delete splatTiles.pcLodDistances;
        delete splatTiles.mobileLodDistances;

        return lodDistances;
    }
}

function calcCenterRadius(mins: any, maxs: any) {
    const center = [(maxs[0] + mins[0]) / 2, (maxs[1] + mins[1]) / 2, (maxs[2] + mins[2]) / 2];
    const sizeX = maxs[0] - mins[0];
    const sizeY = maxs[1] - mins[1];
    const sizeZ = maxs[2] - mins[2];
    const radius = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ) / 2;
    return { center, radius };
}
