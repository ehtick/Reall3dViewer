// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { ModelStatus, SplatModel } from '../ModelData';
import { DataStatus, SplatFile, SplatTiles } from '../SplatTiles';
import { loadSog } from './SogLoader';

export async function loadSogLod(model: SplatModel, splatTiles: SplatTiles, splatFile: SplatFile) {
    splatFile.status |= DataStatus.Fetching;
    splatFile.abortController = new AbortController();
    splatTiles.fetchSet.add(splatFile.url);

    const sogModel = new SplatModel({ url: splatFile.url });
    sogModel.fetchLimit = 500_0000;
    sogModel.abortController = splatFile.abortController;
    await loadSog(sogModel);

    if (sogModel.status == ModelStatus.FetchDone && sogModel.downloadSplatCount) {
        splatFile.downloadData = sogModel.splatData;
        splatFile.downloadCount = sogModel.downloadSplatCount;
        splatFile.status |= DataStatus.FetchDone;

        model.downloadSplatCount += sogModel.downloadSplatCount;
    } else {
        splatFile.status |= DataStatus.FetchFailed | DataStatus.FetchDone;
    }

    splatTiles.fetchSet.delete(splatFile.url);
}
