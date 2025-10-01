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
    GetRenderQuality,
} from '../events/EventConstants';
import { WkInit, WkIsBigSceneMode, WkMaxRenderCount, WkRenderQuality, WkViewProjection } from '../utils/consts/WkConstants';

export function setupSorter(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const worker = new Worker(new URL('./Sorter.ts', import.meta.url), { type: 'module' });

    on(GetWorker, () => worker);
    on(WorkerSort, () => worker.postMessage({ [WkViewProjection]: fire(GetViewProjectionMatrixArray) }));
    on(WorkerDispose, () => worker.terminate());

    (async () => {
        worker.postMessage({
            [WkInit]: true,
            [WkMaxRenderCount]: await fire(GetMaxRenderCount),
            [WkIsBigSceneMode]: fire(IsBigSceneMode),
            [WkRenderQuality]: fire(GetRenderQuality),
        });
    })();
}
