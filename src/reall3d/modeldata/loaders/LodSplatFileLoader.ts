// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { ModelStatus, SplatModel } from '../ModelData';
import { DataStatus, SplatFile, SplatTiles } from '../SplatTiles';
import { loadSog } from './SogLoader';
import { loadSpx } from './SpxLoader';
import { loadSpz } from './SpzLoader';

export async function loadLodSplatFile(splatModel: SplatModel, splatTiles: SplatTiles, splatFile: SplatFile) {
    const isSpx = splatFile.url.endsWith('.spx');
    const isSpz = splatFile.url.endsWith('.spz');
    const isSog = splatFile.url.endsWith('.sog') || splatFile.url.endsWith('meta.json');
    if (!isSpx && !isSpz && !isSog) {
        splatFile.status |= DataStatus.Fetching | DataStatus.FetchDone | DataStatus.Invalid;
        return;
    }

    splatFile.status |= DataStatus.Fetching;
    splatFile.abortController = new AbortController();
    splatTiles.fetchSet.add(splatFile.url);

    const warpModel = new SplatModel({ url: splatFile.url });
    warpModel.fetchLimit = 500_0000;
    warpModel.abortController = splatFile.abortController;

    if (isSpx) {
        await loadSpx(warpModel);
    } else if (isSpz) {
        await loadSpz(warpModel);
    } else if (isSog) {
        await loadSog(warpModel);
    }

    if (warpModel.status == ModelStatus.FetchDone && warpModel.downloadSplatCount) {
        splatFile.downloadData = warpModel.splatData;
        splatFile.downloadCount = warpModel.downloadSplatCount;
        splatFile.status |= DataStatus.FetchDone;

        splatModel.downloadSplatCount += warpModel.downloadSplatCount;
        splatModel.dataShDegree = Math.max(splatModel.dataShDegree, warpModel.dataShDegree);
        !splatModel.palettes && warpModel.palettes && (splatModel.palettes = warpModel.palettes);
    } else {
        splatFile.status |= DataStatus.FetchDone | DataStatus.FetchFailed;
    }

    splatTiles.fetchSet.delete(splatFile.url);
    splatFile.abortController = null;
}
