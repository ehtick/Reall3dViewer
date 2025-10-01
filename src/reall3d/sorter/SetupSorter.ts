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
    WorkerUpdateQualityLevel,
} from '../events/EventConstants';
import { WkInit, WkIsBigSceneMode, WkMaxRenderCount, WkQualityLevel, WkUpdateParams, WkViewProjection } from '../utils/consts/WkConstants';

export function setupSorter(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const worker = new Worker(new URL('./Sorter.ts', import.meta.url), { type: 'module' });

    on(GetWorker, () => worker);
    on(WorkerSort, () => worker.postMessage({ [WkViewProjection]: fire(GetViewProjectionMatrixArray) }));
    on(WorkerDispose, () => worker.terminate());
    on(WorkerUpdateQualityLevel, () => worker.postMessage({ [WkUpdateParams]: true, [WkQualityLevel]: fire(GetRenderQualityLevel) }));

    (async () => {
        worker.postMessage({
            [WkInit]: true,
            [WkMaxRenderCount]: await fire(GetMaxRenderCount),
            [WkIsBigSceneMode]: fire(IsBigSceneMode),
            [WkQualityLevel]: fire(GetRenderQualityLevel),
        });
    })();
}
