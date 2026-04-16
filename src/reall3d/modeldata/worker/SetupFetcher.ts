// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../../events/Events';
import { ModelStatus, SplatModel } from '../ModelData';
import { WorkerDispose, SplatDataFetcher } from '../../events/EventConstants';
import {
    WkFetcherDataShDegree,
    WkFetcherDone,
    WkFetcherDownloadSplatCount,
    WkFetcherPalettes,
    WkFetcherSplatData,
    WkFetcherStatus,
    WkFetcherUrl,
    WkWorkerDispose,
} from '../../utils/consts/WkConstants';

export function setupFetcher(events: Events) {
    let disposed = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);

    const mapUrlFn = new Map<string, Function>();
    const mapUrlModel = new Map<string, SplatModel>();

    const worker = new Worker(new URL('./Fetcher.ts', import.meta.url), { type: 'module' });

    on(SplatDataFetcher, (warpModel: SplatModel): Promise<any> => {
        if (disposed) {
            warpModel.status = ModelStatus.FetchFailed;
            return;
        }

        return new Promise(fnResolve => {
            mapUrlFn.set(warpModel.opts.url, fnResolve);
            mapUrlModel.set(warpModel.opts.url, warpModel);
            worker.postMessage({ [WkFetcherUrl]: warpModel.opts.url });
        });
    });

    worker.onmessage = (e: any) => {
        const data: any = e.data;
        if (!data[WkFetcherDone] || disposed) return;

        const url: string = data[WkFetcherUrl];
        const fnResolve = mapUrlFn.get(url);
        const warpModel = mapUrlModel.get(url);
        const status = data[WkFetcherStatus];
        if (status == ModelStatus.FetchDone) {
            warpModel.status = ModelStatus.FetchDone;
            warpModel.splatData = data[WkFetcherSplatData];
            warpModel.downloadSplatCount = data[WkFetcherDownloadSplatCount];
            warpModel.dataShDegree = data[WkFetcherDataShDegree];
            warpModel.palettes = data[WkFetcherPalettes];
        } else {
            warpModel.status = ModelStatus.FetchFailed;
        }

        mapUrlFn.delete(url);
        mapUrlModel.delete(url);
        fnResolve();
    };

    on(
        WorkerDispose,
        () => {
            disposed = true;
            worker.postMessage({ [WkWorkerDispose]: true });
            worker.terminate();
            mapUrlFn.clear();
            mapUrlModel.clear();
        },
        true,
    );
}
