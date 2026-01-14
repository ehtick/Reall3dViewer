// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
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
    GetSplatMesh,
    OnViewerDispose,
    UpdateIndicatorTargetStatus,
    UpdateVirtualGroundPosition,
} from '../events/EventConstants';
import { SplatMesh } from '../meshs/splatmesh/SplatMesh';

export function setupVirtualGround(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let indicator: Mesh = null;
    let indicatorTarget: Mesh = null;
    let virtualGround: Mesh = null;

    on(UpdateVirtualGroundPosition, () => {
        if (!virtualGround) return;
        const player: Group = fire(GetPlayer);
        virtualGround.position.copy(player.position);
    });

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

    initVirtualGround();

    function initVirtualGround() {
        const scene: Scene = fire(GetScene);
        const splatMesh: SplatMesh = fire(GetSplatMesh);
        const lenX = Math.max(50, Math.min(100, splatMesh.boundBox.maxs[0] - splatMesh.boundBox.mins[0]));
        const lenZ = Math.max(50, Math.min(100, splatMesh.boundBox.maxs[2] - splatMesh.boundBox.mins[2]));

        // 添加虚拟地面网格
        const gridGeometry = new PlaneGeometry(lenX, lenZ);
        const gridMaterial = new MeshStandardMaterial({ color: 0x00ff00, side: DoubleSide });
        virtualGround = new Mesh(gridGeometry, gridMaterial);
        virtualGround.rotation.x = -Math.PI / 2; // 旋转网格使其平铺在 xz 平面上
        virtualGround.receiveShadow = true;
        virtualGround.visible = false;
        scene.add(virtualGround);

        // 创建提示圈的几何体和材质
        const indicatorGeometry = new RingGeometry(2, 6, 16);
        const indicatorMaterial = new MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6, side: DoubleSide });
        indicator = new Mesh(indicatorGeometry, indicatorMaterial);
        indicator.rotation.x = -Math.PI / 2; // 初始时与地面平行
        indicator.visible = false; // 默认不显示
        indicator.renderOrder = 99999;
        indicator.onBeforeRender = () => {
            if (indicator.visible) {
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicator.position) * 3.2) / height;
                indicator.scale.set(newScale, newScale, newScale);
            }
        };
        scene.add(indicator);

        // 创建目标点提示圈的几何体和材质
        const indicatorTargetGeometry = new RingGeometry(0, 6, 16);
        const indicatorTargetMaterial = new MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6, side: DoubleSide });
        indicatorTarget = new Mesh(indicatorTargetGeometry, indicatorTargetMaterial);
        indicatorTarget.rotation.x = -Math.PI / 2; // 初始时与地面平行
        indicatorTarget.visible = false; // 默认不显示
        indicatorTarget.renderOrder = 99999;
        indicatorTarget.onBeforeRender = () => {
            if (indicatorTarget.visible) {
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicatorTarget.position) * 3.2) / height;
                indicatorTarget.scale.set(newScale, newScale, newScale);
            }
        };
        scene.add(indicatorTarget);

        // 鼠标移动事件
        const mouse = new Vector2();
        const raycaster: Raycaster = new Raycaster();
        function onMouseMove(event: MouseEvent) {
            // 将鼠标位置归一化到 [-1, 1]
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // 更新射线
            const camera: PerspectiveCamera = fire(GetCamera);
            if (!camera) return;

            raycaster.setFromCamera(mouse, camera);

            // 检测射线与地面网格的交点
            const intersects = raycaster.intersectObject(virtualGround, true); // 只检测虚拟地面

            if (intersects.length > 0) {
                const point = intersects[0].point; // 获取交点位置
                indicator.position.copy(point);
                indicator.visible = true;
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicator.position) * 3.2) / height;
                indicator.scale.set(newScale, newScale, newScale);
            } else {
                indicator.visible = false;
            }
        }

        // 添加鼠标移动事件监听器
        window.addEventListener('mousemove', onMouseMove, false);
        on(OnViewerDispose, () => window.removeEventListener('mousemove', onMouseMove), true);
    }
}
