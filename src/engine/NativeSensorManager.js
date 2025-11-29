import { Motion } from '@capacitor/motion';
import * as THREE from 'three';

// vvv MAKE SURE 'export' IS HERE vvv
export class NativeSensorManager { 
    constructor() {
        this.enabled = false;
        this.target = new THREE.Vector3(0, 2, -20);
        this.orientation = { beta: 90, gamma: 0 };
        
        // Jerk Detection
        this.lastAccel = { x: 0, y: 0, z: 0 };
        this.jerkThreshold = 15.0; 
        this.onJerk = null;
        this.cooldown = 0;
    }

    async startListeners() {
        try {
            // Capacitor handles permissions natively
            await Motion.addListener('orientation', (event) => {
                this.handleOrientation(event);
            });

            await Motion.addListener('accel', (event) => {
                this.handleMotion(event);
            });

            this.enabled = true;
            console.log("✅ Native Sensors Active");
        } catch (e) {
            console.error("Sensor Error:", e);
        }
    }

    handleOrientation(event) {
        // --- FIX: DETECT DESKTOP ---
        // If the browser sends null data (common on Laptops/Desktops), 
        // disable the sensors so Mouse Control can take over.
        if (event.alpha === null || event.beta === null || event.gamma === null) {
            this.enabled = false;
            return;
        }

        // Only run math if we actually have data
        this.enabled = true;

        this.orientation.beta += (event.beta - this.orientation.beta) * 0.1;
        this.orientation.gamma += (event.gamma - this.orientation.gamma) * 0.1;

        let x = this.orientation.gamma * 0.4;
        let y = (event.beta - 45) * -0.2;

        x = Math.max(-15, Math.min(15, x));
        y = Math.max(0, Math.min(10, y));

        this.target.set(x, y, -20);
    }

    handleMotion(event) {
        if (this.cooldown > 0) return;
        const acc = event.accelerationIncludingGravity;
        const force = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);

        if (force > this.jerkThreshold) {
            console.log("Native Jerk Detected!");
            if (this.onJerk) {
                this.onJerk();
                this.cooldown = 20; 
            }
        }
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;
    }
}