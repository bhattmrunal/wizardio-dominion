import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    // Call this when an enemy dies
    createExplosion(position, color, count = 20) {
        const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const material = new THREE.MeshStandardMaterial({ 
            color: color, 
            emissive: color, 
            emissiveIntensity: 2,
            roughness: 0.4 
        });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone()); // Clone mat for individual opacity
            mesh.position.copy(position);
            
            // Random spread offset
            mesh.position.x += (Math.random() - 0.5) * 1.0;
            mesh.position.y += (Math.random() - 0.5) * 1.0;
            mesh.position.z += (Math.random() - 0.5) * 1.0;

            // Random rotation
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            this.scene.add(mesh);

            this.particles.push({
                mesh: mesh,
                // Explode outward from center
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.8,
                    (Math.random() * 0.5) + 0.2, // Upward pop
                    (Math.random() - 0.5) * 0.8
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                ),
                life: 1.0 // 100% life
            });
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Physics
            p.mesh.position.add(p.velocity);
            p.mesh.rotation.x += p.rotationSpeed.x;
            p.mesh.rotation.y += p.rotationSpeed.y;
            p.mesh.rotation.z += p.rotationSpeed.z;

            // Gravity
            p.velocity.y -= 0.03;

            // Floor collision
            if (p.mesh.position.y < 0) {
                p.mesh.position.y = 0;
                p.velocity.y *= -0.5; // Bounce
                p.velocity.x *= 0.8;  // Friction
                p.velocity.z *= 0.8;
            }

            // Fade out
            p.life -= 0.02;
            p.mesh.material.opacity = p.life;
            p.mesh.material.transparent = true;
            p.mesh.scale.setScalar(p.life); // Shrink

            // Kill
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
}