import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // NEW IMPORT
import { Config } from './Config.js';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.mixers = []; // To handle animations for 3D enemies

        // --- MATERIALS ---
        this.crystalMat = new THREE.MeshStandardMaterial({ color: Config.enemies.crystalColor, roughness: 0.1, metalness: 0.8 });
        this.crystalGeo = new THREE.OctahedronGeometry(1.5, 0);

        this.golemMat = new THREE.MeshStandardMaterial({ color: Config.enemies.golemColor, roughness: 0.5, metalness: 0.4 });
        this.golemEyeMat = new THREE.MeshStandardMaterial({ color: Config.enemies.golemEyeColor, emissive: Config.enemies.golemEyeColor, emissiveIntensity: 3 });

        // --- SPAWN ENEMIES ---
        this.spawn(10, -30, 'golem');
        this.spawn(-10, -30, 'golem');
        this.spawn(-15, -45, 'crystal');
        this.spawn(15, -45, 'crystal');

        // --- SPAWN 3D BOSS ---
        this.spawnEvilWizard(0, -50);
    }

    spawn(x, z, type) {
        let enemy;
        if (type === 'crystal') {
            enemy = new THREE.Mesh(this.crystalGeo, this.crystalMat.clone());
            enemy.userData = { hp: Config.enemies.crystalHP, type: 'crystal', originalY: 4 };
            enemy.position.set(x, 4, z);
        } else {
            enemy = this.createGolem();
            enemy.userData = { hp: Config.enemies.golemHP, type: 'golem', originalY: 0 };
            enemy.position.set(x, 0, z);
            enemy.lookAt(0, 0, 0); 
        }
        enemy.castShadow = true; enemy.receiveShadow = true;
        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

    spawnEvilWizard(x, z) {
        const loader = new GLTFLoader();
        const modelUrl = new URL('/witch.gltf', import.meta.url).href;

        loader.load(modelUrl, (gltf) => {
            const model = gltf.scene;
            
            // Setup Boss Appearance
            model.scale.set(4.0, 4.0, 4.0); // Big Boss
            model.position.set(x, 0, z);
            model.rotation.y = Math.PI; // Face player
            
            // Make him EVIL (Dark Red Tint)
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Clone material so we don't affect the player's look
                    child.material = child.material.clone();
                    child.material.color.setHex(0x550000); // Dark Red
                    child.material.emissive.setHex(0x330000); // Faint evil glow
                }
            });

            // Stats
            model.userData = { 
                hp: 2000, // Huge HP
                type: 'boss', 
                originalY: 0 
            };

            // Animation
            if (gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                // Find Idle
                let clip = gltf.animations.find(a => a.name.toLowerCase().includes('idle'));
                if(!clip) clip = gltf.animations[0];
                mixer.clipAction(clip).play();
                this.mixers.push(mixer);
            }

            this.scene.add(model);
            this.enemies.push(model);

        }, undefined, (e) => console.error("Error loading boss:", e));
    }

    createGolem() {
        const group = new THREE.Group();
        // Legs
        const legGeo = new THREE.BoxGeometry(1.2, 3.5, 1.5);
        const legL = new THREE.Mesh(legGeo, this.golemMat); legL.position.set(-1.0, 1.75, 0); group.add(legL);
        const legR = new THREE.Mesh(legGeo, this.golemMat); legR.position.set(1.0, 1.75, 0); group.add(legR);
        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.0, 2.0), this.golemMat); torso.position.y = 5.0; group.add(torso);
        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), this.golemMat); head.position.y = 7.25; group.add(head);
        // Eye
        const eye = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), this.golemEyeMat); eye.position.set(0, 7.25, 0.76); group.add(eye);
        // Arms
        const armGeo = new THREE.BoxGeometry(1.0, 3.5, 1.0);
        const armL = new THREE.Mesh(armGeo, this.golemMat); armL.position.set(-2.5, 3.5, 0.5); armL.rotation.x = -0.3; group.add(armL);
        const armR = new THREE.Mesh(armGeo, this.golemMat); armR.position.set(2.5, 3.5, 0.5); armR.rotation.x = -0.3; group.add(armR);
        
        // Shadows
        group.traverse(c => { if(c.isMesh) { c.castShadow=true; c.receiveShadow=true; }});
        return group;
    }
    // Add this helper method
    getBoss() {
        // Find the enemy marked as 'boss'
        return this.enemies.find(e => e.userData.type === 'boss');
    }

    // Add this inside the class
    triggerBossHover() {
        const boss = this.getBoss();
        if (boss) {
            boss.userData.isHovering = true;
            boss.userData.hoverEndTime = Date.now() + 3000; // 3 Seconds
        }
    }

    update(delta) {
        const time = Date.now() * 0.002;

        // Update Boss Animations
        this.mixers.forEach(mixer => mixer.update(delta));

        this.enemies.forEach(e => {
            if (e.visible) {
                if (e.userData.type === 'crystal') {
                    e.position.y = e.userData.originalY + Math.sin(time + e.position.x) * 0.5;
                    e.rotation.y += 0.02;
                    if(e.material.emissive.r > 0) e.material.emissive.multiplyScalar(0.9);
                } 
                else if (e.userData.type === 'boss') {
                    // Boss Logic (Flash recovery)
                    // BOSS HOVER LOGIC
                    if (e.userData.isHovering) {
                        if (Date.now() > e.userData.hoverEndTime) e.userData.isHovering = false;
                        
                        // Float up to Y=4
                        const targetY = 4.0 + Math.sin(Date.now() * 0.003) * 0.5;
                        e.position.y += (targetY - e.position.y) * 0.05;
                    } else {
                        // Land at Y=0
                        if (e.position.y > 0) e.position.y += (0 - e.position.y) * 0.1;
                    }
                    e.traverse(child => {
                        if (child.isMesh && child.material.emissive.g > 0) {
                            // Return to dark red (0x330000)
                            child.material.emissive.lerp(new THREE.Color(0x330000), 0.1);
                        }
                    });
                }
                else {
                    // Golem Logic
                    e.rotation.y = Math.sin(time * 0.5) * 0.1;
                    e.children.forEach(child => {
                        if (child.material && child.material.emissive && child.material !== this.golemEyeMat) {
                            if(child.material.emissive.g > 0) child.material.emissive.multiplyScalar(0.9);
                        }
                    });
                }
            }
        });
    }
}