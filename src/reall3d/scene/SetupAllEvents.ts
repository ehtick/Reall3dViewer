// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../events/Events';
import { setupApi } from '../api/SetupApi';
import { setupCameraControls } from '../controls/SetupCameraControls';
import { setupFlying } from '../controls/SetupFlying';
import { setupEventListener } from '../events/EventListener';
import { setupMark } from '../meshs/mark/SetupMark';
import { setupCommonUtils } from '../utils/CommonUtils';
import { setupViewerUtils } from '../utils/ViewerUtils';
import { setupFocusMarker } from './SetupFocusMarker';
import { setupRaycaster } from './SetupRaycaster';
import { setupMapUtils } from '../mapviewer/utils/MapUtils';
import { setupMapEventListener } from '../mapviewer/events/MapEventListener';
import { setupControlPlane } from './SetupControlPlane';
import { setupSplatTextureManager } from '../modeldata/SplatTexdataManager';
import { setupSorter } from '../sorter/SetupSorter';
import { setupSplatMesh } from '../meshs/splatmesh/SetupSplatMesh';
import { setupGaussianText } from '../modeldata/text/SetupGaussianText';
import { setupFetcher } from '../modeldata/worker/SetupFetcher';
import { setupLodDownloadManager } from '../modeldata/LodDownloadManager';
import { setupCustomUtils } from '../utils/CustomUtils';

export function setupAllEventsVerwer(events: Events) {
    setupCommonUtils(events);
    setupCustomUtils(events);
    setupViewerUtils(events);
    setupApi(events);
    setupCameraControls(events);
    setupMark(events);
    setupEventListener(events);
    setupRaycaster(events);
    setupFocusMarker(events);
    setupFlying(events);
    setupControlPlane(events);
}

export function setupAllEventsMapVerwer(events: Events) {
    setupCommonUtils(events);
    setupCustomUtils(events);
    setupApi(events);
    setupMapUtils(events);
    setupRaycaster(events);
    setupFlying(events);
    setupMark(events);
    setupMapEventListener(events);
}

export function setupAllEventsSplatMesh(events: Events) {
    setupCommonUtils(events);
    setupApi(events);
    setupFetcher(events);
    setupSplatTextureManager(events);
    setupLodDownloadManager(events);
    setupSorter(events);
    setupSplatMesh(events);
    setupGaussianText(events);
}
