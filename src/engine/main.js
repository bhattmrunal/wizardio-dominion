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
import { SensorManager } from './SensorManager.js'; // NEW IMPORT

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 12, 16); 
        this.camera.lookAt(0, 2, -5);

        this.initRenderer();
        this.initPostProcessing();
        
        this.windSystem = createEnvironment(this.scene);
        this.particleSystem = new ParticleSystem(this.scene);
        this.wizard = new Wizard(this.scene);
        this.enemyManager = new EnemyManager(this.scene);
        this.spellSystem = new SpellSystem(this.scene, this.wizard, this.particleSystem);
        this.networkManager = new NetworkManager(this.scene, this.spellSystem, this.enemyManager);
        
        // NEW: SENSORS
        this.sensorManager = new SensorManager();

        this.setupInputs();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.2, 0.85));
        this.composer.addPass(new OutputPass());
    }

    setupInputs() {
        // --- 1. SENSOR PERMISSION BUTTON ---
        const startBtn = document.getElementById('btn-enable-sensors');
        const overlay = document.getElementById('start-overlay');
        
        startBtn.addEventListener('click', async () => {
            const granted = await this.sensorManager.requestPermission();
            if(granted) {
                overlay.style.display = 'none'; // Hide overlay
            } else {
                alert("Sensors denied. Touch controls only.");
                overlay.style.display = 'none';
            }
        });

        // --- 2. SENSOR CASTING LOGIC ---
        this.sensorManager.onJerk = () => {
            // This runs when you jerk the phone!
            const target = this.sensorManager.target;
            
            // Trigger Spell
            if (!this.spellSystem.isCasting) {
                this.spellSystem.startCasting(target);
                
                // Network
                const type = this.spellSystem.type;
                if (type === 'beam' || type === 'lightning') {
                    this.networkManager.sendCastSpell(type + '_start', target);
                    // For continuous spells via shake, we stop after a short burst
                    setTimeout(() => {
                        this.spellSystem.stopCasting();
                        this.networkManager.sendCastSpell('stop_channel', target);
                    }, 500); 
                } else {
                    this.networkManager.sendCastSpell(type, target);
                    // Instant spells stop immediately
                    setTimeout(() => this.spellSystem.stopCasting(), 100);
                }
            }
        };

        // --- 3. TOUCH/MOUSE INPUTS (Hybrid Support) ---
        const buttons = document.querySelectorAll('.spell-btn');
        const hoverBtn = document.getElementById('btn-hover');

        const selectSpell = (e, type) => {
            if (e.cancelable) e.preventDefault();
            this.spellSystem.setType(type);
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        };

        buttons.forEach(btn => {
            btn.addEventListener('touchstart', (e) => selectSpell(e, btn.dataset.type), { passive: false });
            btn.addEventListener('click', (e) => selectSpell(e, btn.dataset.type));
        });

        if(hoverBtn) {
            const triggerHover = (e) => {
                if(e.cancelable) e.preventDefault();
                this.wizard.triggerHover();
                this.networkManager.sendCastSpell('hover', new THREE.Vector3());
            };
            hoverBtn.addEventListener('touchstart', triggerHover, { passive: false });
            hoverBtn.addEventListener('click', triggerHover);
        }

        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();

        // Mouse/Touch still works for selecting targets if you aren't using sensors
        window.addEventListener('mousemove', (e) => {
            if (this.sensorManager.enabled) return; // Ignore mouse if sensors active

            const mouse = new THREE.Vector2((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1);
            raycaster.setFromCamera(mouse, this.camera);
            
            let foundHit = false;
            if (this.enemyManager && this.enemyManager.enemies.length > 0) {
                const intersects = raycaster.intersectObjects(this.enemyManager.enemies, true);
                if (intersects.length > 0) {
                    target.copy(intersects[0].point);
                    foundHit = true;
                }
            }
            if (!foundHit) {
                raycaster.ray.intersectPlane(plane, target);
                if (target.z > -2.0) target.z = -2.0;
            }
            
            this.wizard.lookAt(target);
        });
        
        // Click to cast (Fallback)
        window.addEventListener('mousedown', (e) => {
            if(e.target.closest('button')) return;
            if (this.sensorManager.enabled) return; 
            
            // Re-calculate target just in case
            const mouse = new THREE.Vector2((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1);
            raycaster.setFromCamera(mouse, this.camera);
            raycaster.ray.intersectPlane(plane, target);
            if (target.z > -2.0) target.z = -2.0;

            this.spellSystem.startCasting(target);
            this.networkManager.sendCastSpell(this.spellSystem.type, target);
        });

        window.addEventListener('mouseup', () => {
            if (this.sensorManager.enabled) return;
            this.spellSystem.stopCasting();
            if(this.spellSystem.type === 'beam' || this.spellSystem.type === 'lightning') {
                this.networkManager.sendCastSpell('stop_channel', target);
            }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        // 1. UPDATE SENSORS
        this.sensorManager.update();

        // 2. OVERRIDE AIM IF SENSORS ACTIVE
        if (this.sensorManager.enabled) {
            const sensorTarget = this.sensorManager.target;
            this.wizard.lookAt(sensorTarget);
            
            // Sync aim to network
            this.networkManager.sendAim(sensorTarget);
            
            // Update spell system target
            if (this.spellSystem.isCasting) {
                this.spellSystem.updateTarget(sensorTarget);
            }
        }

        if(this.windSystem) this.windSystem.update(delta);
        this.particleSystem.update();
        this.wizard.update(delta);
        this.spellSystem.update(this.enemyManager.enemies, delta);
        this.enemyManager.update(delta);

        this.composer.render();
    }
}

new Game();