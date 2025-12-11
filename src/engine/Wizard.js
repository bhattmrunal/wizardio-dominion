import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Config } from './Config.js';

export class Wizard {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.currentLane = 0; 
        this.laneWidth = 3.5;
        this.targetX = 0;

        // Hover State
        this.isHovering = false;
        this.hoverTimer = 0;
        this.baseY = Config.wizard.baseHeight; // Store base height

        // Shield Logic
        this.isShielding = false;
        this.shieldMesh = null;

        this.model = null;
        this.createStaff();
        this.createShieldVisual();
        this.loadModel();
    }

    createStaff() {
        this.staffGroup = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x332211 }));
        stick.position.y = 0; stick.castShadow = true; this.staffGroup.add(stick);
        this.gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
        this.gem.position.y = 2.25; this.staffGroup.add(this.gem);
        this.group.add(this.staffGroup);
    }

    createShieldVisual() {
        const geo = new THREE.SphereGeometry(4.5, 32, 32);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x00aaff, transmission: 0.5, opacity: 0.3, transparent: true,
            roughness: 0, metalness: 0.5, emissive: 0x0044aa, emissiveIntensity: 0.2
        });
        this.shieldMesh = new THREE.Mesh(geo, mat);
        this.shieldMesh.position.y = 3.5;
        this.shieldMesh.visible = false;
        this.group.add(this.shieldMesh);
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load('/witch.gltf', (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(3.5, 3.5, 3.5); 
            this.model.rotation.y = 0; 
            this.model.position.y = this.baseY;
            
            this.model.traverse((child) => {
                if (child.isBone && child.name === 'WristR') {
                    this.group.remove(this.staffGroup);
                    child.add(this.staffGroup);
                    const s = 1 / 3.5; this.staffGroup.scale.set(s, s, s);
                    this.staffGroup.position.set(-0.15, 0.1, 0); 
                    this.staffGroup.rotation.set(Math.PI / 2, Math.PI, 0); 
                }
            });
            this.group.add(this.model);
        });
    }

    moveLeft() { if (this.currentLane > -1) { this.currentLane--; this.targetX = this.currentLane * this.laneWidth; } }
    moveRight() { if (this.currentLane < 1) { this.currentLane++; this.targetX = this.currentLane * this.laneWidth; } }

    setShield(active) { this.isShielding = active; if (this.shieldMesh) this.shieldMesh.visible = active; }

    getSpellOrigin() {
        const pos = new THREE.Vector3();
        if (this.gem) { this.gem.updateWorldMatrix(true, false); this.gem.getWorldPosition(pos); }
        else { pos.copy(this.group.position); pos.y += 3; }
        return pos;
    }

    // --- LEVITATE LOGIC ---
    triggerHover() {
        console.log("🧙‍♀️ Wizard Hover Triggered!");
        this.isHovering = true;
        this.hoverTimer = 0; // Reset timer
    }
    
    lookAt(target) { 
        this.group.lookAt(target.x, this.group.position.y, target.z); 
    }

    update(delta) {
        // 1. Lane Movement
        this.group.position.x += (this.targetX - this.group.position.x) * 5.0 * delta;

        // 2. Levitate Animation
        if (this.isHovering) {
            this.hoverTimer += delta;
            
            // Go up to +3.0 height over 0.5s, stay, then come down
            // Simple Sine wave for floating feel
            const hoverHeight = 3.0 * Math.sin(Math.min(this.hoverTimer * 2, 1.57)); 
            
            this.group.position.y = this.baseY + hoverHeight;

            // End after 2 seconds
            if (this.hoverTimer > 2.0) {
                this.isHovering = false;
                this.group.position.y = this.baseY; // Snap back to ground smoothly
            }
        } else {
            // Ensure grounded
            if (this.group.position.y > this.baseY) {
                this.group.position.y -= 5 * delta; // Fall down
                if (this.group.position.y < this.baseY) this.group.position.y = this.baseY;
            }
        }
        
        // 3. Shield Pulse
        if (this.isShielding && this.shieldMesh) {
            const scale = 1.0 + Math.sin(Date.now() * 0.005) * 0.02;
            this.shieldMesh.scale.set(scale, scale, scale);
        }
    }
}

// import * as THREE from 'three';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { Config } from './Config.js';

// export class Wizard {
//     constructor(scene) {
//         this.scene = scene;
//         this.group = new THREE.Group();
//         this.scene.add(this.group);

//         // Lane Logic (Left: -5, Center: 0, Right: 5)
//         this.currentLane = 0; 
//         this.laneWidth = 3.5;
//         this.targetX = 0;

//         // Shield Logic
//         this.isShielding = false;
//         this.shieldMesh = null;

//         this.model = null;
//         this.createStaff();
//         this.createShieldVisual();
//         this.loadModel();
//     }

//     // ... (keep createStaff and loadModel exactly as they were) ...
//     createStaff() { /* Copy from previous code */
//         this.staffGroup = new THREE.Group();
//         this.staffGroup.name = "MY_CUSTOM_STAFF";
//         const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x332211 }));
//         stick.position.y = 0; stick.castShadow = true; this.staffGroup.add(stick);
//         this.gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
//         this.gem.position.y = 2.25; this.staffGroup.add(this.gem);
//         this.group.add(this.staffGroup);
//     }

//     createShieldVisual() {
//         // Radius 4.5 covers the whole character
//         const geo = new THREE.SphereGeometry(4.5, 32, 32); 
//         const mat = new THREE.MeshPhysicalMaterial({
//             color: 0x00aaff,
//             transmission: 0.5,
//             opacity: 0.3,
//             transparent: true,
//             roughness: 0,
//             metalness: 0.5,
//             emissive: 0x0044aa,
//             emissiveIntensity: 0.2
//         });
//         this.shieldMesh = new THREE.Mesh(geo, mat);
//         this.shieldMesh.position.y = 3.5; 
//         this.shieldMesh.visible = false;
//         this.group.add(this.shieldMesh);
//     }

//     loadModel() {
//         const loader = new GLTFLoader();
//         loader.load('/witch.gltf', (gltf) => {
//             this.model = gltf.scene;
//             this.model.scale.set(3.5, 3.5, 3.5); 
//             this.model.rotation.y = 0; 
//             this.model.position.y = Config.wizard.baseHeight;
//             // Attach staff to bone logic (Same as before)
//             this.model.traverse((child) => {
//                 if (child.isBone && child.name === 'WristR') {
//                     this.group.remove(this.staffGroup);
//                     child.add(this.staffGroup);
//                     const s = 1 / 3.5; this.staffGroup.scale.set(s, s, s);
//                     this.staffGroup.position.set(-0.15, 0.1, 0); 
//                     this.staffGroup.rotation.set(Math.PI / 2, Math.PI, 0); 
//                 }
//             });
//             this.group.add(this.model);
//         });
//     }

//     // --- NEW MOVEMENT METHODS ---
//     moveLeft() {
//         if (this.currentLane > -1) {
//             this.currentLane--;
//             this.targetX = this.currentLane * this.laneWidth;
//         }
//     }

//     moveRight() {
//         if (this.currentLane < 1) {
//             this.currentLane++;
//             this.targetX = this.currentLane * this.laneWidth;
//         }
//     }

//     setShield(active) {
//         this.isShielding = active;
//         if (this.shieldMesh) this.shieldMesh.visible = active;
//     }

//     getSpellOrigin() {
//         const pos = new THREE.Vector3();
//         if (this.gem) { this.gem.updateWorldMatrix(true, false); this.gem.getWorldPosition(pos); }
//         else { pos.copy(this.group.position); pos.y += 3; }
//         return pos;
//     }

//     triggerHover() { /* Keep existing logic */ }
//     lookAt(target) { /* Keep existing logic */ this.group.lookAt(target.x, this.group.position.y, target.z); }

//     update(delta) {
//         // Smoothly slide to the target lane X
//         this.group.position.x += (this.targetX - this.group.position.x) * 5.0 * delta;
        
//         // Shield Pulse Effect
//         if (this.isShielding && this.shieldMesh) {
//             const scale = 1.0 + Math.sin(Date.now() * 0.005) * 0.02;
//             this.shieldMesh.scale.set(scale, scale, scale);
//         }
//     }
// }