import * as THREE from 'three';

export class SensorManager {
    constructor() {
        this.enabled = false;
        this.target = new THREE.Vector3(0, 2, -15); 
        this.orientation = { alpha: 0, beta: 90, gamma: 0 };
        
        // Calibration
        this.centerBeta = 60; 
        this.centerGamma = 0; 

        // Jerk Detection
        this.lastAccel = new THREE.Vector3();
        this.jerkThreshold = 15.0; 
        this.onJerk = null; 
        this.cooldown = 0;

        this.debugEl = document.getElementById('debug-console');
    }

    log(msg) {
        if(this.debugEl) this.debugEl.innerText = msg;
        console.log(msg);
    }

    async requestPermission() {
        this.log("Requesting sensors...");

        // 1. Check if HTTPS
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            alert("⚠️ SENSORS REQUIRE HTTPS! Deploy to GitHub Pages to test motion.");
            return false;
        }

        // 2. iOS 13+ Permission Flow
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.startListeners();
                    return true;
                } else {
                    alert("Permission denied. Reset permissions in Settings > Safari.");
                    return false;
                }
            } catch (e) {
                alert("Error requesting permission: " + e.message);
                return false;
            }
        } 
        // 3. Android / Non-iOS Flow
        else if ('DeviceMotionEvent' in window) {
            this.startListeners();
            return true;
        } else {
            alert("Device not supported.");
            return false;
        }
    }

    startListeners() {
        this.enabled = true;
        this.log("Sensors Active!");
        
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e));
        window.addEventListener('devicemotion', (e) => this.handleMotion(e));
    }

    handleOrientation(event) {
        if (!event.beta && !event.gamma) return;

        // Display Debug Info
        this.log(`TILT: B:${event.beta.toFixed(0)} G:${event.gamma.toFixed(0)}`);

        // Orientation Logic
        this.orientation.beta += (event.beta - this.orientation.beta) * 0.1;
        this.orientation.gamma += (event.gamma - this.orientation.gamma) * 0.1;

        const sensitivityX = 0.4;
        const sensitivityY = 0.3;

        let x = (this.orientation.gamma - this.centerGamma) * sensitivityX;
        let y = (this.orientation.beta - this.centerBeta) * -sensitivityY + 2; 

        // Clamp
        x = Math.max(-15, Math.min(15, x));
        y = Math.max(0, Math.min(10, y));

        this.target.set(x, y, -20); 
    }

    handleMotion(event) {
        if (this.cooldown > 0) return;
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        const force = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
        
        // Debug Jerk
        if(force > this.jerkThreshold) {
            this.log("!!! JERK DETECTED !!!");
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