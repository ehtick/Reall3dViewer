// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Renderer, Scene } from 'three';
import { Events } from '../../events/Events';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

/**
 * Splat mesh configuration options
 */
export interface SplatMeshOptions {
    /**
     * Name
     */
    name?: string;

    /**
     * Renderer instance to be used
     */
    renderer: Renderer;

    /**
     * Scene instance to be used
     */
    scene: Scene;

    /**
     * Camera controls
     */
    controls?: OrbitControls;

    /**
     * Renderer event manager
     */
    viewerEvents?: Events;

    /**
     * Debug mode flag; defaults to false in production
     */
    debugMode?: boolean;

    /**
     * Large-scene mode flag; cannot be changed after initialization
     */
    bigSceneMode?: boolean;

    /**
     * Point-cloud rendering mode; defaults to true,
     * Can be updated dynamically via viewer.options()
     */
    pointcloudMode?: boolean;

    /**
     * Maximum number of Gaussians to render on mobile devices,
     * Can be updated dynamically via viewer.options()
     */
    maxRenderCountOfMobile?: number;

    /**
     * Maximum number of Gaussians to render on PC,
     * Can be updated dynamically via viewer.options()
     */
    maxRenderCountOfPc?: number;

    /**
     * Brightness scale factor; defaults to 1.0
     */
    lightFactor?: number;

    /**
     * Whether to display a watermark; defaults to true
     */
    showWatermark?: boolean;

    /**
     * Spherical harmonics rendering degree; defaults to 0
     */
    shDegree?: number;

    /**
     * Enable depth testing; defaults to true
     */
    depthTest?: boolean;
}
