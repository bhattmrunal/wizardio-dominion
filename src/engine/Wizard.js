import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Config } from './Config.js';

export class Wizard {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.model = null;
        this.mixer = null;
        this.handBone = null; 
        this.armBone = null;
        
        this.isHovering = false;
        this.hoverEndTime = 0;

        this.createStaff();
        this.loadModel();
    }

    createStaff() {
        this.staffGroup = new THREE.Group();
        this.staffGroup.name = "MY_CUSTOM_STAFF";
        
        // 1. Stick
        const stick = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.06, 4.5, 8), 
            new THREE.MeshStandardMaterial({ color: 0x332211 })
        );
        stick.position.y = 0; 
        stick.castShadow = true;
        this.staffGroup.add(stick);

        // 2. Gem
        this.gem = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.25, 1), 
            new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 })
        );
        this.gem.position.y = 2.25; 
        this.staffGroup.add(this.gem);
        
        this.group.add(this.staffGroup);
    }

    loadModel() {
        const loader = new GLTFLoader();
        // VITE FIX: Load from root public path
        loader.load('/witch.gltf', (gltf) => {
            this.model = gltf.scene;
            
            this.model.scale.set(3.5, 3.5, 3.5); 
            this.model.rotation.y = 0; 
            this.model.position.y = Config.wizard.baseHeight;

            this.model.traverse((child) => {
                if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
                if (child.isBone) {
                    if (child.name === 'WristR') this.handBone = child;
                    if (child.name === 'UpperArmR') this.armBone = child;
                }
            });

            if (this.handBone) {
                // Hide original items
                for (let i = this.handBone.children.length - 1; i >= 0; i--) {
                    const child = this.handBone.children[i];
                    if (child.name !== "MY_CUSTOM_STAFF" && (child.isMesh || child.type === 'Group')) {
                        child.visible = false; 
                    }
                }

                this.group.remove(this.staffGroup);
                this.handBone.add(this.staffGroup);
                
                const s = 1 / 3.5; 
                this.staffGroup.scale.set(s, s, s);
                this.staffGroup.position.set(-0.15, 0.1, 0); 
                this.staffGroup.rotation.set(Math.PI / 2, Math.PI, 0); 
            }

            if (gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.model);
                let clip = gltf.animations.find(a => a.name.toLowerCase().includes('idle'));
                if (!clip) clip = gltf.animations[0];
                if(clip) this.mixer.clipAction(clip).play();
            }

            this.group.add(this.model);

        }, undefined, (e) => console.error("Model Error:", e));
    }

    getSpellOrigin() {
        const pos = new THREE.Vector3();
        if (this.gem) {
            this.gem.updateWorldMatrix(true, false); 
            this.gem.getWorldPosition(pos);
        } else {
            // Safety Fallback: Chest height, slightly forward
            pos.copy(this.group.position);
            pos.y += 3;
            pos.z -= 1;
        }
        return pos;
    }

    triggerHover() {
        this.isHovering = true;
        this.hoverEndTime = Date.now() + Config.wizard.hoverDuration;
    }

    get armGroup() {
        if (this.armBone) return this.armBone;
        return this.group; 
    }

    lookAt(target) {
        const lookTarget = new THREE.Vector3(target.x, this.group.position.y, target.z);
        this.group.lookAt(lookTarget);
    }

    update(delta) {
        if (this.mixer) this.mixer.update(delta);

        if (this.isHovering) {
            if (Date.now() > this.hoverEndTime) this.isHovering = false;
            const targetY = 4.0 + Math.sin(Date.now() * 0.003) * 0.5;
            this.group.position.y += (targetY - this.group.position.y) * 0.05;
        } else {
            if (this.group.position.y > Config.wizard.baseHeight) {
                this.group.position.y += (Config.wizard.baseHeight - this.group.position.y) * 0.1;
            }
        }
    }
}