// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    Raycaster,
    RingGeometry,
    Scene,
    Vector2,
    Vector3,
} from 'three';
import { Events } from '../events/Events';
import {
    GetCamera,
    GetCameraPosition,
    GetCanvasSize,
    GetPlayer,
    GetScene,
    OnViewerDispose,
    PhysicsGetEnvCollision,
    PhysicsGetGroundCollision,
    UpdateIndicatorTargetStatus,
    UpdateVirtualGroundPosition,
} from '../events/EventConstants';

export function setupVirtualGround(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let indicator: Mesh = null;
    let indicatorTarget: Mesh = null;
    let virtualGround: Mesh = null;

    on(UpdateVirtualGroundPosition, () => virtualGround?.position.copy((fire(GetPlayer) as Group).position));

    on(UpdateIndicatorTargetStatus, (point: Vector3, hide = false) => {
        if (!indicatorTarget) return;
        if (hide) {
            indicatorTarget.visible = false;
        } else {
            indicatorTarget.position.copy(point);
            const { height } = fire(GetCanvasSize);
            const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicatorTarget.position) * 3.2) / height;
            indicatorTarget.scale.set(newScale, newScale, newScale);
            indicatorTarget.visible = true;
            indicator.visible = false;
        }
    });

    on(PhysicsGetGroundCollision, () => {
        const obj3ds: Object3D[] = [];
        virtualGround && obj3ds.push(virtualGround);
        const collision = fire(PhysicsGetEnvCollision);
        collision && obj3ds.push(collision);
        return obj3ds;
    });

    initVirtualGround();

    function initVirtualGround() {
        const scene: Scene = fire(GetScene);

        // 虚拟地面
        const gridGeometry = new PlaneGeometry(300, 300);
        const gridMaterial = new MeshStandardMaterial({ color: 0x00ff00, side: DoubleSide });
        virtualGround = new Mesh(gridGeometry, gridMaterial);
        virtualGround.rotation.x = -Math.PI / 2;
        virtualGround.receiveShadow = true;
        virtualGround.visible = false;
        scene.add(virtualGround);

        // 鼠标移动提示圈
        const indicatorGeometry = new RingGeometry(0, 6, 16);
        const indicatorMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: DoubleSide });
        indicator = new Mesh(indicatorGeometry, indicatorMaterial);
        indicator.rotation.x = -Math.PI / 2;
        indicator.visible = false;
        indicator.renderOrder = 99999;
        indicator.onBeforeRender = () => {
            if (indicator.visible) {
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicator.position) * 3.2) / height;
                indicator.scale.set(newScale, newScale, newScale);
            }
        };
        scene.add(indicator);

        // 目标点提示圈
        const indicatorTargetGeometry = new RingGeometry(0, 6, 16);
        const indicatorTargetMaterial = new MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.3, side: DoubleSide });
        indicatorTarget = new Mesh(indicatorTargetGeometry, indicatorTargetMaterial);
        indicatorTarget.rotation.x = -Math.PI / 2;
        indicatorTarget.visible = false;
        indicatorTarget.renderOrder = 99999;
        indicatorTarget.onBeforeRender = () => {
            if (indicatorTarget.visible) {
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicatorTarget.position) * 3.2) / height;
                indicatorTarget.scale.set(newScale, newScale, newScale);
            }
        };
        scene.add(indicatorTarget);

        // 鼠标移动显示提示圈
        const mouse = new Vector2();
        const raycaster: Raycaster = new Raycaster();
        function onMouseMove(event: MouseEvent) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            const camera: PerspectiveCamera = fire(GetCamera);
            if (!camera) return;
            raycaster.setFromCamera(mouse, camera);

            const obj3ds: Object3D[] = fire(PhysicsGetGroundCollision);
            const intersects = raycaster.intersectObjects(obj3ds, true); // 检测地面或静态碰撞体交点

            if (intersects.length > 0) {
                const intersectObjs = [];
                for (let i = 0; i < intersects.length; i++) {
                    intersectObjs.push({ point: intersects[i].point, distance: camera.position.distanceTo(intersects[i].point) });
                }
                intersectObjs.sort((a, b) => a.distance - b.distance);

                let point = intersectObjs[0].point;
                if (intersects.length > 1 && camera.position.distanceTo(intersects[0].point) > camera.position.distanceTo(intersects[1].point)) {
                    point.copy(intersects[1].point);
                }
                indicator.position.copy(point);
                indicator.visible = true;
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicator.position) * 3.2) / height;
                indicator.scale.set(newScale, newScale, newScale);
            } else {
                indicator.visible = false;
            }
        }

        window.addEventListener('mousemove', onMouseMove, false);
        on(OnViewerDispose, () => window.removeEventListener('mousemove', onMouseMove), true);
    }
}
