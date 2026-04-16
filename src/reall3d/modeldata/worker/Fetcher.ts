// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
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
import { loadSog } from '../loaders/SogLoader';
import { loadSpx } from '../loaders/SpxLoader';
import { ModelStatus, SplatModel } from '../ModelData';

const worker: Worker = self as any;
const mapUrlModel = new Map<string, SplatModel>();

async function downloadAndParse(url: string) {
    const warpModel = new SplatModel({ url });
    warpModel.fetchLimit = 300_0000;
    warpModel.abortController = new AbortController();
    mapUrlModel.set(url, warpModel);
    if (url.endsWith('.spx')) {
        await loadSpx(warpModel);
    } else if (url.endsWith('.sog') || url.endsWith('meta.json')) {
        await loadSog(warpModel);
    }
    mapUrlModel.delete(url);

    if (warpModel.status == ModelStatus.FetchDone) {
        worker.postMessage(
            {
                [WkFetcherDone]: true,
                [WkFetcherUrl]: url,
                [WkFetcherStatus]: warpModel.status,
                [WkFetcherSplatData]: warpModel.splatData,
                [WkFetcherDownloadSplatCount]: warpModel.downloadSplatCount,
                [WkFetcherDataShDegree]: warpModel.dataShDegree,
                [WkFetcherPalettes]: warpModel.palettes,
            },
            [warpModel.splatData.buffer],
        );
    } else {
        worker.postMessage({
            [WkFetcherDone]: true,
            [WkFetcherUrl]: url,
            [WkFetcherStatus]: ModelStatus.FetchFailed,
        });
    }
}

worker.onmessage = (e: any) => {
    const data: any = e.data;
    if (data[WkFetcherUrl]) {
        // 下载解析
        downloadAndParse(data[WkFetcherUrl]);
    } else if (data[WkWorkerDispose]) {
        // 取消下载
        const splatModels = [...mapUrlModel.values()];
        for (const model of splatModels) {
            model.abortController.abort();
        }
    }
};
