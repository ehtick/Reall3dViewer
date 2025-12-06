// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Plane, Vector3, Vector4 } from 'three';
import {
    RunLoopByFrame,
    GetViewProjectionMatrix,
    GetCameraPosition,
    SplatTexdataManagerAddSplatLod,
    LodDownloadManagerAddLodMeta,
} from '../events/EventConstants';
import { Events } from '../events/Events';
import { distanceToCube, extractFrustumPlanes, isSplatCubeVisible } from '../utils/CommonUtils';
import { MetaData, SpxHeader } from './ModelData';
import { DataStatus, SplatCube, SplatCube3D, SplatLod } from './SplatCube3D';

const MaxDownloadCount = 16;

export function setupLodDownloadManager(events: Events) {
    let disposed: boolean;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    const mapCube: Map<string, SplatCube> = new Map();
    const tmpPlanes = new Array(6).fill(null).map(() => new Plane());
    let splatCube3D: SplatCube3D;
    let checkCounter = 0;

    fire(
        RunLoopByFrame,
        () => checkDownload(),
        () => !disposed,
        30,
    );

    on(LodDownloadManagerAddLodMeta, async (meta: MetaData) => {
        try {
            const res = await fetch(meta.url, { mode: 'cors', credentials: 'omit', cache: 'reload' });
            if (res.status === 200) {
                splatCube3D = await res.json();
            } else {
                return console.error('lod scene file fetch failed, status:', res.status);
            }
        } catch (e) {
            return console.error('lod scene file fetch failed', e.message);
        }

        const cubes = splatCube3D?.cubes || [];
        for (let cube of cubes) {
            mapCube.set(cube.key, cube);
        }
    });

    function checkDownload() {
        if (!splatCube3D) return; // 无数据

        const viewProjMatrix: Matrix4 = fire(GetViewProjectionMatrix);
        const cameraPosition: Vector3 = fire(GetCameraPosition);
        extractFrustumPlanes(viewProjMatrix, tmpPlanes); // 更新视锥体平面

        // 遍历检查
        let fetchingCnt = 0;
        let todoCnt = 0;
        for (let cube of mapCube.values()) {
            for (let lod of cube.lods) {
                !lod.status && todoCnt++;
                lod.status && lod.status < DataStatus.FetchDone && fetchingCnt++;
            }
        }

        if (!todoCnt || fetchingCnt >= MaxDownloadCount) return; // 无可下载或已并发受限

        // 可见格中有待处理的都汇总起来
        let cubes: SplatCube[] = [];
        for (let cube of mapCube.values()) {
            if (!cube.lods.some(lod => !lod.status)) continue; // 无待处理时跳过
            cube.currentDistance = distanceToCube(cameraPosition, cube); // 计算距离
            const visible = isSplatCubeVisible(cameraPosition, tmpPlanes, cube);
            if (!visible) {
                const dist0 = Math.max(0, cube.currentDistance - cube.radius * 10); // 周边10格
                if (cube.currentDistance - cube.radius * 10 < 0 && cube.lods[0]?.downloadCount) {
                    // 不可见的周边10格，如果有0层级数据，强制拉进来用
                } else {
                    continue; // 不可见时跳过
                }
            }

            // 距离阈值相应的层级已处理时跳过
            for (let i = 0; i < splatCube3D.lodDistances.length; i++) {
                if (cube.currentDistance >= splatCube3D.lodDistances[i]) {
                    const lod = cube.lods[i];
                    if (!cube.lods[i].status) {
                        // 初始化变量
                        lod.downloadCount = 0;
                        lod.currentRenderCnt = 0;
                        lod.lastTime = Date.now();

                        cube.currentFetchLodIndex = i;
                        cubes.push(cube); // 所需层级待处理，加入队列
                    }
                    break;
                }
            }
        }

        // 可见格从近到远排序，确保近处先下载
        cubes.sort((a, b) => a.currentDistance - b.currentDistance);

        // 控制下载并发数，推进下载
        cubes = cubes.slice(0, MaxDownloadCount - fetchingCnt);
        for (let cube of cubes) {
            const lod = cube.lods[cube.currentFetchLodIndex];
            lod.status = DataStatus.WaitFetch; // 待下载
            fire(SplatTexdataManagerAddSplatLod, splatCube3D, cube); // g.status会被更新
        }
    }
}
