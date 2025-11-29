import * as THREE from 'three';

export class DebugSystem {
    constructor(scene) {
        this.scene = scene;
    }

    mark(x, y, z, color) {
        // UPDATED: Much smaller sphere (0.1)
        const geo = new THREE.SphereGeometry(0.1, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: color, wireframe: false });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.position.set(x, y, z);
        this.scene.add(mesh);

        // Remove after 2 seconds
        setTimeout(() => {
            this.scene.remove(mesh);
            geo.dispose();
            mat.dispose();
        }, 2000);
    }
}