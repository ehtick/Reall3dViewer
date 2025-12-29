// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { ModelStatus, SplatModel } from '../ModelData';
import { DataStatus, SplatFile, SplatTiles } from '../SplatTiles';
import { loadSpz } from './SpzLoader';

export async function loadSpzLod(model: SplatModel, splatTiles: SplatTiles, splatFile: SplatFile) {
    splatFile.status |= DataStatus.Fetching;
    splatFile.abortController = new AbortController();
    splatTiles.fetchSet.add(splatFile.url);

    const spzModel = new SplatModel({ url: splatFile.url });
    spzModel.fetchLimit = 500_0000;
    spzModel.abortController = splatFile.abortController;
    await loadSpz(spzModel);

    if (spzModel.status == ModelStatus.FetchDone && spzModel.downloadSplatCount) {
        splatFile.downloadData = spzModel.splatData;
        splatFile.downloadCount = spzModel.downloadSplatCount;
        splatFile.status |= DataStatus.FetchDone;

        model.downloadSplatCount += spzModel.downloadSplatCount;
    } else {
        splatFile.status |= DataStatus.FetchFailed | DataStatus.FetchDone;
    }

    splatTiles.fetchSet.delete(splatFile.url);
}
