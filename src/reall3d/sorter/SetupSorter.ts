// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../events/Events';
import {
    GetWorker,
    WorkerSort,
    WorkerDispose,
    GetViewProjectionMatrixArray,
    GetMaxRenderCount,
    IsBigSceneMode,
    GetRenderQualityLevel,
    WorkerUpdateParams,
    GetCameraPosition,
    GetCameraDirection,
    GetSortType,
    GetSplatMesh,
} from '../events/EventConstants';
import {
    WkCameraDirection,
    WkCameraPosition,
    WkDepthNearRate,
    WkDepthNearValue,
    WkInit,
    WkIsBigSceneMode,
    WkMaxRenderCount,
    WkQualityLevel,
    WkSortType,
    WkUpdateParams,
    WkViewProjection,
} from '../utils/consts/WkConstants';
import { Vector3 } from 'three';
import { SplatMesh } from '../pkg';

export function setupSorter(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const worker = new Worker(new URL('./Sorter.ts', import.meta.url), { type: 'module' });

    on(GetWorker, () => worker);
    on(WorkerSort, () =>
        worker.postMessage({
            [WkViewProjection]: fire(GetViewProjectionMatrixArray),
            [WkCameraDirection]: fire(GetCameraDirection),
            [WkCameraPosition]: (fire(GetCameraPosition) as Vector3).toArray(),
        }),
    );
    on(WorkerDispose, () => worker.terminate());
    on(WorkerUpdateParams, () =>
        worker.postMessage({
            [WkUpdateParams]: true,
            [WkQualityLevel]: fire(GetRenderQualityLevel),
            [WkSortType]: fire(GetSortType),
            [WkDepthNearRate]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearRate,
            [WkDepthNearValue]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearValue,
        }),
    );

    (async () => {
        worker.postMessage({
            [WkInit]: true,
            [WkMaxRenderCount]: await fire(GetMaxRenderCount),
            [WkIsBigSceneMode]: fire(IsBigSceneMode),
            [WkQualityLevel]: fire(GetRenderQualityLevel),
            [WkSortType]: fire(GetSortType),
            [WkDepthNearRate]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearRate,
            [WkDepthNearValue]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearValue,
        });
    })();
}
