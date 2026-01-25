// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { BoxGeometry, BufferAttribute, Clock, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Scene, Vector3 } from 'three';
import { DRACOLoader, GLTFLoader, OrbitControls } from 'three/examples/jsm/Addons.js';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { Events } from '../events/Events';
import {
    PhysicsEnableDebug,
    GetScene,
    PhysicsAddMesh,
    PhysicsRemoveMesh,
    PhysicsAdStaticMesh,
    PhysicsAdDynamicMesh,
    PhysicsInitCharacterController,
    PhysicsMovePlayer,
    OnViewerDispose,
    GetControls,
    PhysicsAddStaticCollisionGlb,
} from '../events/EventConstants';

export function setupPhysics(events: Events) {
    let disposed: boolean = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    const controls: OrbitControls = fire(GetControls);
    let world: RAPIER.World;
    let ready: Promise<boolean> = null;
    let enablePhysics = true;
    let enablePhysicsDebug = false;
    let characterController: RAPIER.KinematicCharacterController;
    let characterCollider: RAPIER.Collider;
    const up = new Vector3(0, 1, 0);
    let rapierHelper: RapierHelper;

    const meshes = [];
    const meshMap = new WeakMap();
    const _vector = new Vector3();
    const _quaternion = new Quaternion();
    const _matrix = new Matrix4();
    const _scale = new Vector3(1, 1, 1);
    const ZERO = new Vector3();
    const clock = new Clock();
    let keySet: Set<string> = new Set();

    on(PhysicsEnableDebug, (enable = true) => (enablePhysicsDebug = enable));

    on(PhysicsAddStaticCollisionGlb, async (glbUrl: string) => {
        if (!glbUrl) return;
        await initPhysics();

        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://reall3d.com/reall3dviewer/libs/draco/');
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            glbUrl,
            gltf => {
                gltf.scene.traverse((object: any) => object.isMesh && addMesh(object, { type: 'static', mass: 0, friction: 0 }));
            },
            () => {},
            error => {},
        );
    });

    on(PhysicsAddMesh, async (mesh: any, opt: PhysicsOptions = {}) => {
        await initPhysics();
        addMesh(mesh, opt);
    });
    on(PhysicsAdStaticMesh, async (mesh: any, opt: PhysicsOptions = {}) => {
        await initPhysics();
        opt.type = 'static';
        opt.mass = 0;
        opt.restitution = 0.5;
        addMesh(mesh, opt);
    });
    on(PhysicsAdDynamicMesh, async (mesh: any, opt: PhysicsOptions = {}) => {
        await initPhysics();
        opt.type = 'dynamic';
        opt.mass = opt.mass || 1;
        addMesh(mesh, opt);
    });
    on(PhysicsRemoveMesh, async (mesh: any) => {
        await initPhysics();
        removeMesh(mesh);
    });

    let doing = false;
    on(PhysicsInitCharacterController, async (position = new Vector3(0, 0, 0)) => {
        if (doing) return;
        doing = true;
        await initPhysics();
        const controller = world.createCharacterController(0.05);
        controller.setApplyImpulsesToDynamicBodies(true); // 与动态刚体交互
        controller.setCharacterMass(1);

        controller.setMaxSlopeClimbAngle(Math.PI / 4); // 上坡 45°
        controller.setMinSlopeSlideAngle(Math.PI / 4); // 下坡 45°
        controller.enableAutostep(0.4, 0.2, false); // 自动跨步(maxHeight, minWidth, includeDynamicBodies)
        controller.enableSnapToGround(0.7); // 贴地
        controller.setSlideEnabled(true); // 滑动

        // const boxColor = 0xbbbbbb;
        // const boxGeometry = new BoxGeometry(1000, 0.1, 1000);
        // const boxMesh = new Mesh(boxGeometry, new MeshBasicMaterial({ color: boxColor }));
        // boxMesh.position.set(0, 1, 0);
        // addMesh(boxMesh, { type: 'static', mass: 0 });
        // fire(GetScene).add(boxMesh);

        let groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
        let groundBody = world.createRigidBody(groundBodyDesc);
        let groundColliderDesc = RAPIER.ColliderDesc.cuboid(1000, 0.1, 1000).setTranslation(0, 1, 0);
        world.createCollider(groundColliderDesc, groundBody);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z)
            .setCcdEnabled(true)
            .setCanSleep(false);
        const characterBody = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.6, 0.3).setMass(1).setTranslation(0, 0.1, 0).setFriction(0.0).setRestitution(0.0);
        characterCollider = world.createCollider(colliderDesc, characterBody);
        characterController = controller;
    });

    let velocityY = 0.01;
    on(PhysicsMovePlayer, (moveVector: Vector3, delta = 1 / 60): Vector3 | null => {
        if (!characterController) {
            fire(PhysicsInitCharacterController);
            return null;
        }
        rapierHelper?.update();
        const position = characterCollider.translation();
        let moveY = moveVector.y + velocityY;
        if (position.y > 0.1) {
            moveY = -0.1; // 别掉了
        }
        const movement = new RAPIER.Vector3(moveVector.x, moveY, moveVector.z);
        characterController.computeColliderMovement(characterCollider, movement);

        step(delta);

        const translation = characterController.computedMovement();
        if (Math.abs(translation.y - moveY) > 0.03) {
            velocityY = 0.01; // 上坡
        } else if (Math.abs(translation.y - moveY) < 0.01) {
            velocityY = 0.35; // 下滑
        }

        position.x += translation.x;
        position.y += translation.y;
        position.z += translation.z;

        characterCollider.setTranslation(position);

        return new Vector3(translation.x, translation.y, translation.z);
    });

    window.addEventListener('keydown', keydownEventListener);
    window.addEventListener('keyup', keyupEventListener);
    on(
        OnViewerDispose,
        () => {
            if (disposed) return;
            disposed = true;
            window.removeEventListener('keydown', keydownEventListener);
            window.removeEventListener('keyup', keyupEventListener);
        },
        true,
    );

    // 根据按键计算弧度方向
    function computeTargetMoveDirection(): Vector3 {
        const forward = keySet.has('KeyW') || keySet.has('ArrowUp');
        const backward = keySet.has('KeyS') || keySet.has('ArrowDown');
        const left = keySet.has('KeyA') || keySet.has('ArrowLeft');
        const right = keySet.has('KeyD') || keySet.has('ArrowRight');
        if (!forward && !backward && !left && !right) return null;

        let angle = 0;
        if (forward) {
            angle = right ? Math.PI / 4 : left ? -Math.PI / 4 : 0;
        } else if (backward) {
            angle = right ? (3 * Math.PI) / 4 : left ? (-3 * Math.PI) / 4 : Math.PI;
        } else if (right) {
            angle = Math.PI / 2;
        } else if (left) {
            angle = -Math.PI / 2;
        }
        return computeMoveDirection(angle);
    }

    // 根据按键计算弧度方向
    function computeKeyboardMoveDirection(): Vector3 | null {
        const forward = keySet.has('KeyW') || keySet.has('ArrowUp');
        const backward = keySet.has('KeyS') || keySet.has('ArrowDown');
        const left = keySet.has('KeyA') || keySet.has('ArrowLeft');
        const right = keySet.has('KeyD') || keySet.has('ArrowRight');
        if (!forward && !backward && !left && !right) return null;

        let angle = 0;
        if (forward) {
            angle = right ? Math.PI / 4 : left ? -Math.PI / 4 : 0;
        } else if (backward) {
            angle = right ? (3 * Math.PI) / 4 : left ? (-3 * Math.PI) / 4 : Math.PI;
        } else if (right) {
            angle = Math.PI / 2;
        } else if (left) {
            angle = -Math.PI / 2;
        }
        return computeMoveDirection(angle);
    }

    function computeMoveDirection(moveAngle: number): Vector3 {
        const cameraForward = new Vector3();
        controls.object.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();

        const cameraRight = new Vector3();
        cameraRight.crossVectors(up, cameraForward).normalize();

        const targetDirection = new Vector3();
        targetDirection.x = Math.sin(moveAngle) * cameraRight.x + Math.cos(moveAngle) * cameraForward.x;
        targetDirection.z = Math.sin(moveAngle) * cameraRight.z + Math.cos(moveAngle) * cameraForward.z;
        return targetDirection;
    }

    function initPhysics(): Promise<boolean> {
        if (ready) return ready;
        return (ready = new Promise(async resolve => {
            await RAPIER.init();
            world = new RAPIER.World(new Vector3(0.0, -9.81, 0.0));

            const scene: Scene = fire(GetScene);
            rapierHelper = new RapierHelper();
            scene.add(rapierHelper);
            resolve(true);
        }));
    }

    // 几何体转换为 碰撞体描述
    function getShape(geometry: any) {
        const parameters = geometry.parameters;
        if (geometry.type === 'RoundedBoxGeometry') {
            const sx = parameters.width !== undefined ? parameters.width / 2 : 0.5;
            const sy = parameters.height !== undefined ? parameters.height / 2 : 0.5;
            const sz = parameters.depth !== undefined ? parameters.depth / 2 : 0.5;
            const radius = parameters.radius !== undefined ? parameters.radius : 0.1;

            return RAPIER.ColliderDesc.roundCuboid(sx - radius, sy - radius, sz - radius, radius);
        } else if (geometry.type === 'BoxGeometry') {
            const sx = parameters.width !== undefined ? parameters.width / 2 : 0.5;
            const sy = parameters.height !== undefined ? parameters.height / 2 : 0.5;
            const sz = parameters.depth !== undefined ? parameters.depth / 2 : 0.5;

            return RAPIER.ColliderDesc.cuboid(sx, sy, sz);
        } else if (geometry.type === 'SphereGeometry' || geometry.type === 'IcosahedronGeometry') {
            const radius = parameters.radius !== undefined ? parameters.radius : 1;
            return RAPIER.ColliderDesc.ball(radius);
        } else if (geometry.type === 'CylinderGeometry') {
            const radius = parameters.radiusBottom !== undefined ? parameters.radiusBottom : 0.5;
            const length = parameters.height !== undefined ? parameters.height : 0.5;

            return RAPIER.ColliderDesc.cylinder(length / 2, radius);
        } else if (geometry.type === 'CapsuleGeometry') {
            const radius = parameters.radius !== undefined ? parameters.radius : 0.5;
            const length = parameters.height !== undefined ? parameters.height : 0.5;

            return RAPIER.ColliderDesc.capsule(length / 2, radius);
        } else if (geometry.type === 'BufferGeometry') {
            const vertices: number[] = [];
            const vertex = new Vector3();
            const position = geometry.getAttribute('position');

            for (let i = 0; i < position.count; i++) {
                vertex.fromBufferAttribute(position, i);
                vertices.push(vertex.x, vertex.y, vertex.z);
            }

            // if the buffer is non-indexed, generate an index buffer
            const indices = geometry.getIndex() === null ? Uint32Array.from(Array(Math.floor(vertices.length / 3)).keys()) : geometry.getIndex().array;

            return RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), indices);
        }

        console.error('RapierPhysics: Unsupported geometry type:', geometry.type);
        return null;
    }

    function addScene(scene: any) {
        scene.traverse(function (child: any) {
            if (child.isMesh) {
                const physics = child.userData.physics;
                if (physics) {
                    addMesh(child, physics);
                }
            }
        });
    }

    function addMesh(mesh: any, opts: PhysicsOptions = {}) {
        const shape = getShape(mesh.geometry);
        if (!shape) return;

        const mass = opts.mass || 0;

        shape.setMass(mass); // 质量
        shape.setFriction(opts.friction || 0.1); // 摩擦系数
        shape.setRestitution(opts.restitution || 0); // 反弹系数

        const { body, collider } = mesh.isInstancedMesh ? createInstancedBody(mesh, mass, shape) : createBody(mesh.position, mesh.quaternion, mass, shape);

        if (!mesh.userData.physics) mesh.userData.physics = {};

        mesh.userData.physics.body = body;
        mesh.userData.physics.collider = collider;

        if (mass > 0) {
            meshes.push(mesh);
            meshMap.set(mesh, { body, collider });
        }
    }

    function removeMesh(mesh: any) {
        const index = meshes.indexOf(mesh);

        if (index !== -1) {
            meshes.splice(index, 1);
            meshMap.delete(mesh);

            if (!mesh.userData.physics) return;

            const body = mesh.userData.physics.body;
            const collider = mesh.userData.physics.collider;

            if (body) removeBody(body);
            if (collider) removeCollider(collider);
        }
    }

    function createInstancedBody(mesh: any, mass: number, shape: RAPIER.ColliderDesc) {
        const array = mesh.instanceMatrix.array;

        const bodies = [];
        const colliders = [];

        for (let i = 0; i < mesh.count; i++) {
            const position = _vector.fromArray(array, i * 16 + 12);
            const { body, collider } = createBody(position, null, mass, shape);
            bodies.push(body);
            colliders.push(collider);
        }

        return { body: bodies, collider: colliders };
    }

    function createBody(position: Vector3, quaternion: RAPIER.Rotation, mass: number, shape: RAPIER.ColliderDesc) {
        const desc = mass > 0 ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
        desc.setTranslation(position.x, position.y, position.z);
        quaternion && desc.setRotation(quaternion);

        const body = world.createRigidBody(desc);
        const collider = world.createCollider(shape, body);
        return { body, collider };
    }

    function removeBody(body: RAPIER.RigidBody[] | RAPIER.RigidBody) {
        if (Array.isArray(body)) {
            for (let i = 0; i < body.length; i++) {
                world.removeRigidBody(body[i]);
            }
        } else {
            world.removeRigidBody(body);
        }
    }

    function removeCollider(collider: RAPIER.Collider) {
        if (Array.isArray(collider)) {
            for (let i = 0; i < collider.length; i++) {
                world.removeCollider(collider[i], false);
            }
        } else {
            world.removeCollider(collider, false);
        }
    }

    function setMeshPosition(mesh: any, position: Vector3, index = 0) {
        let { body } = meshMap.get(mesh);

        if (mesh.isInstancedMesh) {
            body = body[index];
        }

        body.setAngvel(ZERO);
        body.setLinvel(ZERO);
        body.setTranslation(position);
    }

    function setMeshVelocity(mesh: any, velocity: number, index = 0) {
        let { body } = meshMap.get(mesh);

        if (mesh.isInstancedMesh) {
            body = body[index];
        }

        body.setLinvel(velocity);
    }

    function addHeightfield(mesh: any, width: number, depth: number, heights, scale) {
        const shape = RAPIER.ColliderDesc.heightfield(width, depth, heights, scale);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        bodyDesc.setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
        bodyDesc.setRotation(mesh.quaternion);

        const body = world.createRigidBody(bodyDesc);
        world.createCollider(shape, body);

        if (!mesh.userData.physics) mesh.userData.physics = {};
        mesh.userData.physics.body = body;

        return body;
    }

    function step(timestep: number) {
        if (!enablePhysics || !world) return;
        world.timestep = timestep || Math.min(clock.getDelta(), 1 / 60);
        world.step();

        for (let i = 0, l = meshes.length; i < l; i++) {
            const mesh = meshes[i];

            if (mesh.isInstancedMesh) {
                const array = mesh.instanceMatrix.array;
                const { body: bodies } = meshMap.get(mesh);

                for (let j = 0; j < bodies.length; j++) {
                    const body = bodies[j];
                    const position = body.translation();
                    _quaternion.copy(body.rotation());
                    _matrix.compose(position, _quaternion, _scale).toArray(array, j * 16);
                }

                mesh.instanceMatrix.needsUpdate = true;
                mesh.computeBoundingSphere();
            } else {
                const { body } = meshMap.get(mesh);
                mesh.position.copy(body.translation());
                mesh.quaternion.copy(body.rotation());
            }
        }
    }

    function keydownEventListener(e: KeyboardEvent) {
        if (e.target['type'] === 'text') return;
        e.preventDefault();
        keySet.add(e.code);
    }

    function keyupEventListener(e: KeyboardEvent) {
        if (e.target['type'] === 'text') return;
        keySet.delete(e.code);
    }

    class RapierHelper extends LineSegments {
        constructor() {
            super();
            this.material = new LineBasicMaterial({ vertexColors: true });
            this.frustumCulled = false;
        }

        public update() {
            if (disposed) return;
            if (!enablePhysicsDebug || !world) {
                this.visible && (this.visible = false);
                return;
            }
            !this.visible && (this.visible = true);

            const { vertices, colors } = world.debugRender();
            this.geometry.deleteAttribute('position');
            this.geometry.deleteAttribute('color');
            this.geometry.setAttribute('position', new BufferAttribute(vertices, 3));
            this.geometry.setAttribute('color', new BufferAttribute(colors, 4));
        }

        public dispose() {
            this.geometry.dispose();
            (this.material as any).dispose?.();
        }
    }
}

export interface PhysicsOptions {
    /** 静态刚体、动态刚体、运动学刚体 */
    type?: 'static' | 'dynamic' | 'kinematic';
    /** 质量 */
    mass?: number;
    /** 摩擦系数 */
    friction?: number;
    /** 反弹系数 */
    restitution?: number;
}
