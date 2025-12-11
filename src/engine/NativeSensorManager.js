import { Motion } from '@capacitor/motion';

export class NativeSensorManager {
    constructor() {
        this.enabled = true; 
        
        this.orientation = { beta: 0, gamma: 0 }; 
        this.cooldown = 0;
        
        // TUNING
        this.flickThreshold = 8.0;   // Very sensitive (easy flick)
        this.shieldAngle = 75;       // Shield cutoff
        this.rollThreshold = 12.0;   // Angle needed to register Left/Right

        this.currentSpell = 'bolt'; 

        // Live Aim Data
        this.liveRoll = 0; 

        // Callbacks
        this.onCast = null;
        this.onShield = null;
        this.onDebug = null;
    }

    setSpellType(type) { this.currentSpell = type; }

    async startListeners() {
        try {
            // Request 60fps updates if possible (depends on device)
            await Motion.addListener('orientation', (event) => this.handleOrientation(event));
            await Motion.addListener('accel', (event) => this.handleMotion(event));
            console.log("✅ Native Sensors: INSTANT MODE");
        } catch (e) { console.error(e); }
    }

    handleOrientation(event) {
        if (event.beta !== null) this.orientation.beta = event.beta;
        
        // SMOOTHING: Simple Low-Pass Filter to reduce jitter but keep speed
        if (event.gamma !== null) {
            // Blend 20% old value, 80% new value (Very fast response)
            this.liveRoll = (this.liveRoll * 0.2) + (event.gamma * 0.8);
            this.orientation.gamma = event.gamma;
        }

        const isShielding = this.orientation.beta > this.shieldAngle;
        if (this.onShield) this.onShield(isShielding);
    }

    handleMotion(event) {
        if (this.cooldown > 0) {
            this.cooldown--;
            // Even in cooldown, keep updating UI!
            this.updateDebug();
            return;
        }

        let acc = event.acceleration;
        let useGravity = false;
        if (!acc || (acc.x === 0 && acc.y === 0 && acc.z === 0)) {
            acc = event.accelerationIncludingGravity;
            useGravity = true;
        }
        if (!acc) return;

        const rawForce = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
        const adjustedForce = useGravity ? Math.abs(rawForce - 9.8) : rawForce;

        // INSTANT TRIGGER (No Timers)
        if (adjustedForce > this.flickThreshold) {
             if (this.orientation.beta < this.shieldAngle) {
                
                // Read the LIVE aim instantly
                this.triggerFlick(adjustedForce);
                
                // Set Cooldown based on spell
                let resetTime = 40; 
                if (this.currentSpell === 'bolt' || this.currentSpell === 'fire') resetTime = 10; // ~0.16s
                else if (this.currentSpell === 'water') resetTime = 15;
                
                this.cooldown = resetTime; 
            }
        }
        
        this.updateDebug(adjustedForce);
    }

    triggerFlick(force) {
        // Use the SMOOTHED live roll
        const roll = this.liveRoll;
        let direction = 'center';

        if (roll < -this.rollThreshold) direction = 'left';
        else if (roll > this.rollThreshold) direction = 'right';

        console.log(`📱 INSTANT FLICK: ${direction.toUpperCase()} (Roll: ${roll.toFixed(1)})`);
        if (this.onCast) this.onCast(direction);
    }

    updateDebug(force = 0) {
        if (this.onDebug) {
            this.onDebug({
                roll: this.liveRoll, // Send smoothed roll for smooth UI
                force: force,
                status: "Live"
            });
        }
    }

    update() {}
}

// import { Motion } from '@capacitor/motion';

// export class NativeSensorManager {
//     constructor() {
//         this.enabled = true; 
        
//         // SENSOR STATE
//         this.orientation = { beta: 0, gamma: 0, alpha: 0 }; 
//         this.initialAlpha = null;
        
//         this.cooldown = 0;
        
//         // --- TUNING ---
//         this.flickThreshold = 7.0;  
//         this.shieldAngle = 80;      
//         this.rollThreshold = 15.0;  
//         this.aimDelay = 30; // Follow-through wait time

//         // NEW: Dynamic Spell Handling
//         this.currentSpell = 'bolt'; // Default

//         // Debug Helpers
//         this.currentMaxForce = 0;
//         this.latchedData = null; 
//         this.latchTimer = 0;

//         this.onCast = null;
//         this.onShield = null;
//         this.onDebug = null;
//     }

//     // NEW METHOD: Called by GameEngine when you click buttons
//     setSpellType(type) {
//         this.currentSpell = type;
//         console.log(`📱 Sensor Manager: Switched to ${type} mode`);
//     }

//     async startListeners() {
//         try {
//             await Motion.addListener('orientation', (event) => this.handleOrientation(event));
//             await Motion.addListener('accel', (event) => this.handleMotion(event));
//             console.log("✅ Native Sensors Initialized (Dynamic Cooldowns)");
//         } catch (e) { console.error(e); }
//     }

//     handleOrientation(event) {
//         if (event.beta !== null) this.orientation.beta = event.beta;
//         if (event.gamma !== null) this.orientation.gamma = event.gamma;
//         if (event.alpha !== null) this.orientation.alpha = event.alpha;
//         if (this.initialAlpha === null && event.alpha !== null) this.initialAlpha = event.alpha;

//         const isShielding = this.orientation.beta > this.shieldAngle;
//         if (this.onShield) this.onShield(isShielding);
//     }

//     handleMotion(event) {
//         if (this.cooldown > 0) {
//             this.cooldown--;
//             return;
//         }
//         if (this.latchTimer > 0) this.latchTimer--;

//         // 1. GET FORCE
//         let acc = event.acceleration;
//         let useGravity = false;
//         if (!acc || (acc.x === 0 && acc.y === 0 && acc.z === 0)) {
//             acc = event.accelerationIncludingGravity;
//             useGravity = true;
//         }
//         if (!acc) return;

//         const rawForce = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
//         const adjustedForce = useGravity ? Math.abs(rawForce - 9.8) : rawForce;

//         // Debug Peak
//         if (adjustedForce > this.currentMaxForce) {
//             this.currentMaxForce = adjustedForce;
//             this.maxForceTimer = 60;
//         }
//         if (this.maxForceTimer > 0) this.maxForceTimer--; else this.currentMaxForce = 0;

//         // 2. TRIGGER LOGIC
//         if (adjustedForce > this.flickThreshold) {
//              if (this.orientation.beta < this.shieldAngle) {
//                 this.initiateFlick(adjustedForce);
                
//                 // --- DYNAMIC COOLDOWN LOGIC ---
//                 // Bolt/Fire = Fast (15 frames / 0.25s)
//                 // Lightning/Beam = Slow (50 frames / 0.8s)
//                 let resetTime = 40; 
                
//                 if (this.currentSpell === 'bolt' || this.currentSpell === 'fire') {
//                     resetTime = 15; // Responsive!
//                 } else if (this.currentSpell === 'water') {
//                     resetTime = 20;
//                 } else {
//                     resetTime = 50; // Heavy spells need time
//                 }
                
//                 this.cooldown = resetTime; 
//             }
//         }

//         // 3. DEBUG DATA
//         const displayData = (this.latchTimer > 0 && this.latchedData) ? this.latchedData : {
//             roll: this.orientation.gamma,
//             force: adjustedForce,
//             status: "Live"
//         };
//         if (this.onDebug) this.onDebug(displayData);
//     }

//     initiateFlick(force) {
//         console.log(`🚀 Flick detected (Force: ${force.toFixed(1)}). Waiting for aim...`);
//         setTimeout(() => { this.resolveAim(force); }, this.aimDelay);
//     }

//     resolveAim(force) {
//         const roll = this.orientation.gamma;
//         let direction = 'center';

//         if (roll < -this.rollThreshold) direction = 'left';
//         else if (roll > this.rollThreshold) direction = 'right';

//         this.latchedData = {
//             roll: roll,
//             force: force,
//             status: `FLICK ${direction.toUpperCase()}!`
//         };
//         this.latchTimer = 60; // Freeze HUD for 1 second (reduced from 2)

//         console.log(`📱 FLICK FIRED: ${direction.toUpperCase()} (Roll: ${roll.toFixed(1)}°)`);
//         if (this.onCast) this.onCast(direction);
//     }

//     update() {}
// }
// // import { Motion } from '@capacitor/motion';

// // export class NativeSensorManager {
// //     constructor() {
// //         this.enabled = true; 
        
// //         // RAW ANGLES
// //         this.orientation = { alpha: 0, beta: 0, gamma: 0 }; 
// //         this.initialAlpha = null; // Stores where "Forward" is
        
// //         this.cooldown = 0;
// //         this.flickThreshold = 10.0;  
// //         this.shieldAngle = 75;      

// //         // DEBUG HELPERS
// //         this.currentMaxForce = 0;
// //         this.latchedData = null; 
// //         this.latchTimer = 0;

// //         // Callbacks
// //         this.onCast = null;
// //         this.onShield = null;
// //         this.onDebug = null;
// //     }

// //     async startListeners() {
// //         try {
// //             await Motion.addListener('orientation', (event) => this.handleOrientation(event));
// //             await Motion.addListener('accel', (event) => this.handleMotion(event));
// //             console.log("✅ Native Sensors Initialized");
// //         } catch (e) { console.error(e); }
// //     }

// //     handleOrientation(event) {
// //         if (event.alpha !== null) this.orientation.alpha = event.alpha; 
// //         if (event.beta !== null) this.orientation.beta = event.beta;   
// //         if (event.gamma !== null) this.orientation.gamma = event.gamma; 

// //         // CALIBRATION: First reading is "Forward"
// //         if (this.initialAlpha === null && event.alpha !== null) {
// //             this.initialAlpha = event.alpha;
// //         }

// //         const isShielding = this.orientation.beta > this.shieldAngle;
// //         if (this.onShield) this.onShield(isShielding);
// //     }

// //     handleMotion(event) {
// //         // 1. GET FORCE
// //         let acc = event.acceleration;
// //         let useGravity = false;
// //         if (!acc || (acc.x === 0 && acc.y === 0 && acc.z === 0)) {
// //             acc = event.accelerationIncludingGravity;
// //             useGravity = true;
// //         }
// //         if (!acc) return;

// //         const rawForce = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
// //         const adjustedForce = useGravity ? Math.abs(rawForce - 9.8) : rawForce;

// //         // 2. TRIGGER LOGIC
// //         if (adjustedForce > this.flickThreshold && this.cooldown === 0) {
// //              if (this.orientation.beta < this.shieldAngle) {
// //                 this.triggerFlick(adjustedForce);
// //                 this.cooldown = 30; 
// //             }
// //         }

// //         // 3. DEBUG HUD UPDATES (Handle Latched Data)
// //         const displayData = (this.latchTimer > 0 && this.latchedData) ? this.latchedData : {
// //             alpha: this.orientation.alpha,
// //             beta: this.orientation.beta,
// //             gamma: this.orientation.gamma,
// //             relAlpha: this.getRelativeAlpha(), // Helper to show live relative dir
// //             force: adjustedForce,
// //             status: "Live"
// //         };

// //         if (this.onDebug) {
// //             this.onDebug(displayData);
// //         }
// //     }

// //     triggerFlick(force) {
// //         const relativeAlpha = this.getRelativeAlpha();

// //         // LATCH DATA FOR DEBUGGING
// //         this.latchedData = {
// //             alpha: this.orientation.alpha,
// //             beta: this.orientation.beta,
// //             gamma: this.orientation.gamma,
// //             relAlpha: relativeAlpha, 
// //             force: force,
// //             status: "FLICK DETECTED!"
// //         };
// //         this.latchTimer = 120; // Freeze HUD for 2 seconds

// //         console.log(`📱 FLICK! Alpha: ${relativeAlpha.toFixed(1)}, Gamma: ${this.orientation.gamma.toFixed(1)}`);
        
// //         // Placeholder Logic (We will tune this next)
// //         let direction = 'center';
// //         if (this.orientation.gamma < -15) direction = 'left'; 
// //         else if (this.orientation.gamma > 15) direction = 'right';

// //         if (this.onCast) this.onCast(direction);
// //     }

// //     getRelativeAlpha() {
// //         let relativeAlpha = this.orientation.alpha - (this.initialAlpha || 0);
// //         if (relativeAlpha > 180) relativeAlpha -= 360;
// //         if (relativeAlpha < -180) relativeAlpha += 360;
// //         return relativeAlpha;
// //     }

// //     // --- FIX: ADDED MISSING UPDATE METHOD ---
// //     update() {
// //         if (this.cooldown > 0) this.cooldown--;
// //         if (this.latchTimer > 0) this.latchTimer--;
// //     }
// // }