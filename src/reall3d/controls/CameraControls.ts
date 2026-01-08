// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Camera, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';

/**
 * 旋转控制器
 */
export class CameraControls extends OrbitControls {
    constructor(opts: Reall3dViewerOptions) {
        const camera: Camera = opts.camera;
        super(camera, opts.renderer.domElement);

        const that = this;
        that.dampingFactor = 0.1;
        that.rotateSpeed = 0.4;
        that.updateByOptions(opts);
    }

    public updateByOptions(opts: Reall3dViewerOptions = {}) {
        if (!opts) return;
        const that = this;

        opts.enableDamping !== undefined && (that.enableDamping = opts.enableDamping);
        opts.autoRotate !== undefined && (that.autoRotate = opts.autoRotate);
        opts.enableZoom !== undefined && (that.enableZoom = opts.enableZoom);
        opts.enableRotate !== undefined && (that.enableRotate = opts.enableRotate);
        opts.enablePan !== undefined && (that.enablePan = opts.enablePan);
        opts.minDistance !== undefined && (that.minDistance = opts.minDistance);
        opts.maxDistance !== undefined && (that.maxDistance = opts.maxDistance);
        opts.minPolarAngle !== undefined && (that.minPolarAngle = opts.minPolarAngle);
        opts.maxPolarAngle !== undefined && (that.maxPolarAngle = opts.maxPolarAngle);

        opts.fov !== undefined && ((that.object as PerspectiveCamera).fov = opts.fov);
        opts.near !== undefined && ((that.object as PerspectiveCamera).near = opts.near);
        opts.far !== undefined && ((that.object as PerspectiveCamera).far = opts.far);
        opts.position && that.object.position.fromArray(opts.position);
        opts.lookAt && that.target.fromArray(opts.lookAt);
        opts.lookUp && that.object.up.fromArray(opts.lookUp);

        that.updateRotateAxis();
        that.update();
    }

    /**
     * 更新旋转轴
     */
    public updateRotateAxis() {
        // @ts-ignore
        this._quat?.setFromUnitVectors?.(this.object.up, new Vector3(0, 1, 0));
        // @ts-ignore
        this._quatInverse = this._quat?.clone?.()?.invert?.();
    }
}
