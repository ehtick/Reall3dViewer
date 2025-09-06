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
} from '../events/EventConstants';
import { CameraControls } from './CameraControls';
import { MetaData } from '../modeldata/ModelData';

export function setupFlying(events: Events) {
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);

    const flyPositions: Vector3[] = [];
    const flyTargets: Vector3[] = [];
    let flyEnable: boolean = false;
    let flyOnceDone: boolean = false;

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
        const meta: MetaData = fire(GetSplatMesh).meta || fire(GetMeta);
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
    const flyTotalTime = 120 * 1000;
    let flyStartTime = 0;
    let curvePos: CatmullRomCurve3 | null;
    let curveTgt: CatmullRomCurve3 | null;
    on(Flying, (force: boolean) => {
        t = 0;
        flyStartTime = Date.now();
        curvePos = null;
        curveTgt = null;
        if (!flyPositions.length) return;
        if (!force && !fire(GetControls).autoRotate) return; // 避免在非自动旋转模式下执行

        const controls: CameraControls = fire(GetControls);

        const points: Vector3[] = [controls.object.position.clone()];
        const tgts: Vector3[] = [controls.target.clone()];
        // const points: Vector3[] = [];
        // const tgts: Vector3[] = [];
        const all: Vector3[] = fire(GetFlyPositions) || [];
        for (let i = 0, max = Math.min(all.length, 100); i < max; i++) {
            all[i] && points.push(all[i]);
            flyTargets[i] && tgts.push(flyTargets[i]);
        }
        curvePos = new CatmullRomCurve3(points);
        curvePos.closed = true;
        curveTgt = new CatmullRomCurve3(tgts);
        curveTgt.closed = true;

        fire(FlyEnable);
        fire(StopAutoRotate, false);
    });

    on(
        OnViewerAfterUpdate,
        () => {
            if (Date.now() - flyStartTime > flyTotalTime) fire(FlyDisable);
            if (!flyEnable || !curvePos || !curveTgt) return;

            const controls: CameraControls = fire(GetControls);

            t = (Date.now() - flyStartTime) / flyTotalTime;
            const pt = curvePos.getPoint(t);
            const tgt = curveTgt.getPoint(t);

            controls.object.position.set(pt.x, pt.y, pt.z);
            controls.target.set(tgt.x, tgt.y, tgt.z);
        },
        true,
    );
}
