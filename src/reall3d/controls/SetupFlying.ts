// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { CatmullRomCurve3, Vector3 } from 'three';
import { Events } from '../events/Events';
import {
    AddFlyPosition,
    ClearFlyPosition,
    FlySavePositions,
    GetControls,
    GetFlyPositionArray,
    GetFlyPositions,
    GetFlyTargetArray,
    GetSplatMesh,
    HttpPostMetaData,
    OnSetFlyPositions,
    OnSetFlyTargets,
    OnViewerAfterUpdate,
    StopAutoRotate,
    Flying,
    FlyDisable,
    FlyEnable,
    FlyOnce,
    GetMeta,
    FlyingPause,
    FlyingPlay,
    OnSetFlyDuration,
} from '../events/EventConstants';
import { CameraControls } from './CameraControls';
import { MetaData } from '../modeldata/ModelData';
import { ScenesJsonData } from '../mapviewer/Reall3dMapViewer';

export function setupFlying(events: Events) {
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);

    const flyPositions: Vector3[] = [];
    const flyTargets: Vector3[] = [];
    let flyEnable: boolean = false;
    let flyOnceDone: boolean = false;
    let flyDuration = 125 * 1000;

    on(FlyDisable, () => (flyEnable = false));
    on(FlyEnable, () => (flyEnable = true));
    on(GetFlyPositions, () => flyPositions);
    on(GetFlyPositionArray, () => {
        const rs = [];
        for (let i = 0, max = flyPositions.length; i < max; i++) {
            rs.push(...flyPositions[i].toArray());
        }
        return rs;
    });
    on(GetFlyTargetArray, () => {
        const rs = [];
        for (let i = 0, max = flyTargets.length; i < max; i++) {
            rs.push(...flyTargets[i].toArray());
        }
        return rs;
    });
    on(OnSetFlyPositions, (v3s: number[]) => {
        for (let i = 0, max = (v3s.length / 3) | 0; i < max; i++) {
            flyPositions[i] = new Vector3(v3s[i * 3 + 0], v3s[i * 3 + 1], v3s[i * 3 + 2]);
        }
    });
    on(OnSetFlyTargets, (v3s: number[]) => {
        for (let i = 0, max = (v3s.length / 3) | 0; i < max; i++) {
            flyTargets[i] = new Vector3(v3s[i * 3 + 0], v3s[i * 3 + 1], v3s[i * 3 + 2]);
        }
    });
    on(OnSetFlyDuration, (duration: number = 125 * 1000) => {
        flyDuration = duration;
    });
    on(AddFlyPosition, () => {
        const controls: CameraControls = fire(GetControls);
        flyPositions.push(controls.object.position.clone());
        flyTargets.push(controls.target.clone());
    });
    on(ClearFlyPosition, () => {
        flyPositions.length = 0;
        flyTargets.length = 0;
    });
    on(FlySavePositions, async (bSave: boolean = true) => {
        const obj: MetaData | ScenesJsonData = fire(GetSplatMesh)?.meta || fire(GetMeta);
        if ((obj as any).scenes) {
            // 地图
            const meta = obj as ScenesJsonData;
            if (flyPositions.length) {
                const positions: number[] = [];
                const targets: number[] = [];
                for (let i = 0, max = flyPositions.length; i < max; i++) {
                    positions.push(...flyPositions[i].toArray());
                    targets.push(...flyTargets[i].toArray());
                }
                meta.flyPositions = positions;
                meta.flyTargets = targets;
            } else {
                delete meta.flyPositions;
                delete meta.flyTargets;
            }

            const controls: CameraControls = fire(GetControls);
            meta.position = controls.object.position.toArray();
            meta.lookAt = controls.target.toArray();

            bSave && (await fire(HttpPostMetaData, meta));
        } else {
            // 小场景
            const meta = obj as MetaData;
            if (flyPositions.length) {
                const positions: number[] = [];
                const targets: number[] = [];
                for (let i = 0, max = flyPositions.length; i < max; i++) {
                    positions.push(...flyPositions[i].toArray());
                    targets.push(...flyTargets[i].toArray());
                }
                meta.flyPositions = positions;
                meta.flyTargets = targets;
            } else {
                delete meta.flyPositions;
                delete meta.flyTargets;
            }
            bSave && (await fire(HttpPostMetaData, meta));
        }
        const meta = (obj as any).scenes ? (obj as ScenesJsonData) : (obj as MetaData);
        if (flyPositions.length) {
            const positions: number[] = [];
            const targets: number[] = [];
            for (let i = 0, max = flyPositions.length; i < max; i++) {
                positions.push(...flyPositions[i].toArray());
                targets.push(...flyTargets[i].toArray());
            }
            meta.flyPositions = positions;
            meta.flyTargets = targets;
        } else {
            delete meta.flyPositions;
            delete meta.flyTargets;
        }
        bSave && (await fire(HttpPostMetaData, meta));
    });

    on(FlyOnce, () => {
        if (flyOnceDone) return;
        (flyOnceDone = true) && fire(Flying, true);
    });

    let t = 0; // 插值因子
    let flyTotalTime = flyDuration;
    let flyStartTime = 0;
    let flyPauseTime = 0;
    let flyElapsedTime = 0;
    let flyElapsed = 0;
    let flySpeed = 1;
    let curvePos: CatmullRomCurve3 | null;
    let curveTgt: CatmullRomCurve3 | null;
    on(Flying, (force: boolean) => {
        t = 0;
        flyTotalTime = flyDuration;
        flyStartTime = Date.now();
        flyPauseTime = 0;
        flyElapsedTime = flyStartTime;
        flyElapsed = 0;
        flySpeed = 1;
        curvePos = null;
        curveTgt = null;
        if (!flyPositions.length) return;
        if (!force && !fire(GetControls).autoRotate) return; // 避免在非自动旋转模式下执行

        const controls: CameraControls = fire(GetControls);

        const points: Vector3[] = [controls.object.position.clone()];
        const tgts: Vector3[] = [controls.target.clone()];
        const all: Vector3[] = fire(GetFlyPositions) || [];
        for (let i = 0, max = Math.min(all.length, 1000); i < max; i++) {
            all[i] && points.push(all[i]);
            flyTargets[i] && tgts.push(flyTargets[i]);
        }
        curvePos = new CatmullRomCurve3(points);
        curvePos.closed = false;
        curveTgt = new CatmullRomCurve3(tgts);
        curveTgt.closed = false;

        fire(FlyEnable);
        fire(StopAutoRotate, false);
    });

    on(FlyingPause, () => {
        flyPauseTime = flyPauseTime || Date.now(); // 重复暂停仅首次有效
    });

    // 1,2,4,-2,-4
    on(FlyingPlay, (speed: number, elapsed: number) => {
        if (elapsed) {
            flyElapsed = elapsed * flyDuration;
        }

        if (flyPauseTime) {
            flyElapsedTime = Date.now();
            flyPauseTime = 0;
        }

        if (!flyEnable) {
            fire(Flying, true);
        }
        flySpeed = speed;
    });

    on(
        OnViewerAfterUpdate,
        () => {
            const controls: CameraControls = fire(GetControls);
            if (flyPauseTime) return; // 暂停

            flyElapsed += flySpeed * (Date.now() - flyElapsedTime); // 累加最近一次计时至今的时长
            flyElapsedTime = Date.now();
            if (flyElapsed < 0 || flyElapsed > flyTotalTime) {
                fire(FlyDisable); // 播放结束
            }
            if (!flyEnable || !curvePos || !curveTgt) return;

            t = flyElapsed / flyTotalTime;
            const pt = curvePos.getPoint(t);
            const tgt = curveTgt.getPoint(t);

            controls.object.position.set(pt.x, pt.y, pt.z);
            controls.target.set(tgt.x, tgt.y, tgt.z);
        },
        true,
    );
}
