import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Config } from './Config.js';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.mixers = []; 
        this.boss = null;

        // Spawn Boss at Center
        this.spawnEvilWizard(0, -40);
    }

    spawnEvilWizard(x, z) {
        const loader = new GLTFLoader();
        const modelUrl = new URL('/witch.gltf', import.meta.url).href;

        loader.load(modelUrl, (gltf) => {
            const model = gltf.scene;
            
            model.scale.set(3.5, 3.5, 3.5); 
            
            // --- FIX 1: SPAWN ON GROUND (Y=0) ---
            model.position.set(x, 0, z); 
            model.rotation.y = 0; 

            // Visual Setup (Evil Tint)
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material = child.material.clone();
                    child.material.color.setHex(0x882222); 
                    child.material.emissive.setHex(0x220000); 
                }
            });

            // Shield Visual
            const shieldGeo = new THREE.SphereGeometry(4.5, 32, 32);
            const shieldMat = new THREE.MeshPhysicalMaterial({
                color: 0xff0000, transmission: 0.5, opacity: 0.3, transparent: true,
                emissive: 0xaa0000, emissiveIntensity: 0.2
            });
            const shield = new THREE.Mesh(shieldGeo, shieldMat);
            shield.position.y = 3.5;
            shield.visible = false;
            model.add(shield);

            // Stats
            model.userData = { 
                hp: 2000, 
                type: 'boss', 
                shieldMesh: shield,
                isHovering: false,
                hoverEndTime: 0
            };

            // Animation
            if (gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                let clip = gltf.animations.find(a => a.name.toLowerCase().includes('idle'));
                if(!clip) clip = gltf.animations[0];
                mixer.clipAction(clip).play();
                this.mixers.push(mixer);
            }

            this.scene.add(model);
            this.enemies.push(model);
            this.boss = model;
            
            console.log("👾 EVIL WIZARD SPAWNED ON GROUND");

        }, undefined, (e) => console.error("Error loading boss:", e));
    }

    getBoss() { return this.boss; }

    updateBossPosition(x) {
        if (this.boss) this.boss.position.x = x; 
    }

    setBossShield(active) {
        if (this.boss && this.boss.userData.shieldMesh) {
            this.boss.userData.shieldMesh.visible = active;
        }
    }

    triggerBossHover() {
        if (this.boss) {
            this.boss.userData.isHovering = true;
            this.boss.userData.hoverEndTime = Date.now() + 2000;
        }
    }

    update(delta) {
        this.mixers.forEach(mixer => mixer.update(delta));

        if (this.boss) {
            // --- FIX 2: LANDING LOGIC ---
            const groundLevel = 0; // The floor is at 0

            // Hover Logic
            if (this.boss.userData.isHovering) {
                if (Date.now() > this.boss.userData.hoverEndTime) {
                    this.boss.userData.isHovering = false;
                }
                // Float up to Y=4
                const targetY = groundLevel + 4.0 + Math.sin(Date.now() * 0.003) * 0.5;
                this.boss.position.y += (targetY - this.boss.position.y) * 0.05;
            } else {
                // Land back to Ground Level
                if (this.boss.position.y > groundLevel) {
                    this.boss.position.y += (groundLevel - this.boss.position.y) * 0.1;
                }
            }

            // Shield Pulse
            if (this.boss.userData.shieldMesh.visible) {
                const s = 1.0 + Math.sin(Date.now() * 0.01) * 0.02;
                this.boss.userData.shieldMesh.scale.set(s, s, s);
            }

            // Hit Recovery
            this.boss.traverse(child => {
                if (child.isMesh && child.material.emissive.g > 0) {
                    child.material.emissive.lerp(new THREE.Color(0x220000), 0.1);
                }
            });
        }
    }
}