import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createEnvironment } from './Environment.js';
import { Wizard } from './Wizard.js';
import { SpellSystem } from './SpellSystem.js';
import { EnemyManager } from './EnemyManager.js';
import { NetworkManager } from './NetworkManager.js';
import { ParticleSystem } from './ParticleSystem.js';
import { NativeSensorManager } from './NativeSensorManager.js';

export class GameEngine {
    constructor(canvas) {
        if (!canvas) { console.error("Canvas missing!"); return; }
        
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.isRunning = true;
        
        // CAMERA SETUP
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 12, 16); 
        this.camera.lookAt(0, 2, -5);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        this.renderer.shadowMap.enabled = true;

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.2, 0.85));
        this.composer.addPass(new OutputPass());

        // SYSTEMS
        this.windSystem = createEnvironment(this.scene);
        this.particleSystem = new ParticleSystem(this.scene);
        this.wizard = new Wizard(this.scene);
        this.enemyManager = new EnemyManager(this.scene);
        this.spellSystem = new SpellSystem(this.scene, this.wizard, this.particleSystem);
        this.networkManager = new NetworkManager(this.scene, this.spellSystem, this.enemyManager);
        
        // SENSORS
        this.sensorManager = new NativeSensorManager();
        this.sensorManager.startListeners();
        this.sensorManager.onJerk = () => {
            const target = this.sensorManager.target;
            this.triggerCast(target);
        };

        this.setupInputs();
        this.animate();

        this.resizeHandler = () => this.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);
    }

    triggerCast(target) {
        if (!this.spellSystem.isCasting) {
            this.spellSystem.startCasting(target);
            const type = this.spellSystem.type;
            
            if (type === 'beam' || type === 'lightning') {
                this.networkManager.sendCastSpell(type + '_start', target);
            } else if (type === 'water') {
                this.networkManager.sendCastSpell('water', target);
            } else {
                this.networkManager.sendCastSpell(type, target);
            }
        }
    }

    triggerStop(target) {
        if (this.spellSystem.isCasting) {
            const type = this.spellSystem.type;
            if (type === 'beam' || type === 'lightning') {
                this.networkManager.sendCastSpell('stop_channel', target);
            }
        }
        this.spellSystem.stopCasting();
    }

setupInputs() {
        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); 
        const target = new THREE.Vector3();
        const canvas = this.renderer.domElement;

        const handlePointer = (clientX, clientY, isDown, isMove) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const mouse = new THREE.Vector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -((clientY - rect.top) / rect.height) * 2 + 1
            );

            raycaster.setFromCamera(mouse, this.camera);
            
            // 1. Raycast Floor
            const intersectPoint = new THREE.Vector3();
            const hit = raycaster.ray.intersectPlane(plane, intersectPoint);
            
            if (hit) {
                target.copy(intersectPoint);
                if (target.z > -2.0) target.z = -2.0; 
            }

            // 2. Update Visuals
            if (!this.sensorManager.enabled) {
                this.wizard.lookAt(target);
                if (isMove || isDown) {
                    this.networkManager.sendAim(target);
                }
                // Always update spell target visually
                this.spellSystem.updateTarget(target);
            }

            // 3. TRIGGER ACTIONS
            if (!isMove) {
                if (isDown) {
                    this.triggerCast(target);
                } else {
                    // --- FORCE STOP ---
                    // We send this regardless of state to ensure the network clears
                    console.log("👆 Input Up: Sending STOP");
                    this.networkManager.sendCastSpell('stop_channel', target);
                    this.spellSystem.stopCasting();
                }
            }
        };

        // --- LISTENERS ---
        
        canvas.addEventListener('mousedown', (e) => {
            if(e.target.closest('.spell-btn')) return;
            handlePointer(e.clientX, e.clientY, true, false);
        });

        window.addEventListener('mousemove', (e) => {
            handlePointer(e.clientX, e.clientY, e.buttons === 1, true);
        });

        // Global Mouse Up
        window.addEventListener('mouseup', () => { 
            handlePointer(0, 0, false, false); 
        });

        // Touch
        canvas.addEventListener('touchstart', (e) => {
            if(e.target.closest('.spell-btn')) return;
            e.preventDefault();
            handlePointer(e.touches[0].clientX, e.touches[0].clientY, true, false);
        }, { passive: false });
        
        window.addEventListener('touchmove', (e) => {
             if(e.target.closest('.spell-btn')) return;
             e.preventDefault();
             if (e.touches.length > 0) {
                handlePointer(e.touches[0].clientX, e.touches[0].clientY, true, true);
             }
        }, { passive: false });
        
        // Global Touch End
        window.addEventListener('touchend', () => { 
            handlePointer(0, 0, false, false); 
        });
    }
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

  animate() {
        if (!this.renderer) return;
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        // 1. UPDATE SENSORS
        // Only use sensors if they are truly active and we aren't using the mouse
        this.sensorManager.update();
        
        // CHECK: Is the sensor actually doing anything?
        // On Desktop, this.sensorManager.enabled might be false, but let's be explicit.
        if (this.sensorManager.enabled) {
            const target = this.sensorManager.target;
            
            // Only override if we haven't touched the mouse recently
            // (You can add a 'lastInputType' variable to track 'mouse' vs 'sensor')
            // For now, let's assume if sensor is enabled, it wins on mobile.
            // BUT on desktop, enabled should be false.
            
            this.wizard.lookAt(target);
            this.networkManager.sendAim(target);
            
            // CRITICAL FIX: Only update spell target if NOT casting via mouse
            if (this.spellSystem.isCasting) {
                this.spellSystem.updateTarget(target);
            }
        }

        // 2. UPDATE GAME
        if(this.windSystem) this.windSystem.update(delta);
        this.particleSystem.update();
        this.wizard.update(delta);
        this.spellSystem.update(this.enemyManager.enemies, delta);
        this.enemyManager.update(delta);

        this.composer.render();
    }

    dispose() {
        this.isRunning = false;
        window.removeEventListener('resize', this.resizeHandler);
        if (this.networkManager) this.networkManager.disconnect();
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        console.log("🗑️ Game Engine Disposed");
    }
}