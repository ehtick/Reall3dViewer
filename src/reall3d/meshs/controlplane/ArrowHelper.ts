// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';

export class ArrowHelper extends Object3D {
    private line: Mesh;
    private cone: Mesh;
    declare public type: string;
    private _axis: Vector3 = new Vector3();

    constructor(
        dir = new Vector3(0, 0, 1),
        origin = new Vector3(0, 0, 0),
        length = 1,
        radius = 0.1,
        color = 0xffff00,
        headLength = length * 0.2,
        headRadius = headLength * 0.2,
    ) {
        super();

        this.type = 'ArrowHelper';

        const lineGeometry = new CylinderGeometry(radius, radius, length, 32);
        lineGeometry.translate(0, length / 2.0, 0);
        const coneGeometry = new CylinderGeometry(0, headRadius, headLength, 32);
        coneGeometry.translate(0, length, 0);

        this.position.copy(origin);

        const lineMaterial = new MeshBasicMaterial({ color: color, toneMapped: false, opacity: 0.9, transparent: true });
        lineMaterial.side = DoubleSide;
        this.line = new Mesh(lineGeometry, lineMaterial);
        this.line.matrixAutoUpdate = false;
        // @ts-ignore
        this.line.ignoreIntersect = true;
        this.add(this.line);

        const coneMaterial = new MeshBasicMaterial({ color: color, toneMapped: false, opacity: 0.9, transparent: true });
        coneMaterial.side = DoubleSide;
        this.cone = new Mesh(coneGeometry, coneMaterial);
        this.cone.matrixAutoUpdate = false;
        // @ts-ignore
        this.cone.ignoreIntersect = true;
        this.add(this.cone);

        this.setDirection(dir);
        this.renderOrder = 99999;
    }

    setDirection(dir) {
        if (dir.y > 0.99999) {
            this.quaternion.set(0, 0, 0, 1);
        } else if (dir.y < -0.99999) {
            this.quaternion.set(1, 0, 0, 0);
        } else {
            this._axis.set(dir.z, 0, -dir.x).normalize();
            const radians = Math.acos(dir.y);
            this.quaternion.setFromAxisAngle(this._axis, radians);
        }
    }

    setColor(color) {
        // @ts-ignore
        this.line.material.color.set(color);
        // @ts-ignore
        this.cone.material.color.set(color);
    }

    copy(source) {
        super.copy(source, false);
        this.line.copy(source.line);
        this.cone.copy(source.cone);
        return this;
    }

    dispose() {
        this.line.geometry.dispose();
        // @ts-ignore
        this.line.material.dispose();
        this.cone.geometry.dispose();
        // @ts-ignore
        this.cone.material.dispose();
    }
}
