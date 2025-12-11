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
        
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 12, 12); 
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
        
        // --- SENSOR & GESTURE SETUP ---
        this.sensorManager = new NativeSensorManager();
        this.sensorManager.startListeners();

        // 1. FLICK TO CAST
        this.sensorManager.onCast = (direction) => {
            console.log(`🚀 Engine received Flick: ${direction}`);

            // TARGET LOGIC
            // Y=5 (Chest Height), Z=-40 (Opponent Distance)
            const target = new THREE.Vector3(0, 5, -40); 
            
            // X Lanes (Lane Width approx 8 units at distance)
            if (direction === 'left') target.x = -12;
            if (direction === 'right') target.x = 12;
            
            // VISUAL DEBUG (Move the red dot instantly)
            this.spellSystem.updateTarget(target);

            this.wizard.lookAt(target);
            this.networkManager.sendAim(target);
            this.triggerCast(target);
            
            // Auto-Stop after 500ms
            setTimeout(() => {
                this.triggerStop(target);
            }, 500); 
        };

        // 2. TILT TO SHIELD
        this.sensorManager.onShield = (isActive) => {
            if (this.wizard.isShielding !== isActive) {
                console.log(`🛡️ Shield State: ${isActive}`);
                this.wizard.setShield(isActive);
                this.networkManager.sendShield(isActive);
            }
        };

        this.setupInputs();
        this.animate();

        this.resizeHandler = () => this.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);
    }

    // --- BUTTON CONTROLS (Called from App.jsx) ---
    movePlayer(direction) {
        console.log("Moving Player:", direction);
        if (direction === 'left') {
            this.wizard.moveLeft();
            // Optional: Send move to network if you have that implemented
             if(this.networkManager.sendMove) this.networkManager.sendMove(this.wizard.group.position.x); 
        }
        if (direction === 'right') {
            this.wizard.moveRight();
             if(this.networkManager.sendMove) this.networkManager.sendMove(this.wizard.group.position.x);
        }
    }

    triggerCast(target) {
        console.log("🔫 triggerCast called!"); // <--- LOOK FOR THIS

        if (!this.spellSystem.isCasting) {
            console.log("✨ Starting Spell System Cast..."); 
            this.spellSystem.startCasting(target);
            
            // Network Logic
            const type = this.spellSystem.type;
            if (type === 'beam' || type === 'lightning') {
                this.networkManager.sendCastSpell(type + '_start', target);
            } else if (type === 'water') {
                this.networkManager.sendCastSpell('water', target);
            } else {
                this.networkManager.sendCastSpell(type, target);
            }
        } else {
            console.log("⚠️ Ignored: Already casting!");
        }
    }

    // Call this whenever the UI changes the spell
    setSpellType(type) {
        // 1. Update Physics Engine
        if (this.spellSystem) {
            this.spellSystem.setType(type);
        }
        
        // 2. Update Sensor Engine (for cooldowns)
        if (this.sensorManager) {
            this.sensorManager.setSpellType(type);
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

    // Call this whenever the UI changes the spell
    setSpellType(type) {
        // 1. Update Physics Engine
        if (this.spellSystem) {
            this.spellSystem.setType(type);
        }
        
        // 2. Update Sensor Engine (for cooldowns)
        if (this.sensorManager) {
            this.sensorManager.setSpellType(type);
        }
    }

    setupInputs() {
        // Keep existing Mouse/Touch inputs for Web Debugging
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
            const intersectPoint = new THREE.Vector3();
            const hit = raycaster.ray.intersectPlane(plane, intersectPoint);
            
            if (hit) {
                target.copy(intersectPoint);
                if (target.z > -2.0) target.z = -2.0; 
            }

            // If sensors are OFF (Web Mode), allow mouse to aim
            if (!this.sensorManager.enabled) {
                this.wizard.lookAt(target);
                this.spellSystem.updateTarget(target);
                if (isMove || isDown) this.networkManager.sendAim(target);
            }

            if (!isMove) {
                if (isDown) this.triggerCast(target);
                else {
                    this.triggerStop(target);
                }
            }
        };

        canvas.addEventListener('mousedown', (e) => { if(e.target.closest('button')) return; handlePointer(e.clientX, e.clientY, true, false); });
        window.addEventListener('mousemove', (e) => { handlePointer(e.clientX, e.clientY, e.buttons === 1, true); });
        window.addEventListener('mouseup', () => { handlePointer(0, 0, false, false); });
        
        canvas.addEventListener('touchstart', (e) => { if(e.target.closest('button')) return; e.preventDefault(); handlePointer(e.touches[0].clientX, e.touches[0].clientY, true, false); }, { passive: false });
        window.addEventListener('touchmove', (e) => { if(e.target.closest('button')) return; e.preventDefault(); if(e.touches.length > 0) handlePointer(e.touches[0].clientX, e.touches[0].clientY, true, true); }, { passive: false });
        window.addEventListener('touchend', () => { handlePointer(0, 0, false, false); });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        // 1. UPDATE SENSORS
        // This checks for flicks and tilts
        this.sensorManager.update();

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
        if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    }
}