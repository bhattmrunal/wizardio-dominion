import * as THREE from 'three';

// Hardcoded Config fallback to prevent "NaN" errors
const SAFE_SPEEDS = {
    bolt: 0.8,      // Units per frame
    fire: 0.6,
    water: 0.5,
    lightning: 0,   // Instant
    beam: 0
};

export class SpellSystem {
    constructor(scene, wizard, particleSystem) {
        this.scene = scene;
        this.wizard = wizard;
        this.particleSystem = particleSystem;
        this.type = 'bolt';
        this.isCasting = false;
        this.projectiles = [];
        this.currentTarget = new THREE.Vector3();
        
        // Remote & Visuals
        this.channelMesh = null;
        this.channelLights = [];
        this.remoteChannelType = null;
        this.remoteChannelMesh = null;
        this.remoteTarget = new THREE.Vector3(0, 2, 0); 
        this.remoteStart = new THREE.Vector3(); 
        this.armTargetRotX = 0; 

        // Debug Marker
        const geo = new THREE.SphereGeometry(0.1, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.debugTargetMarker = new THREE.Mesh(geo, mat);
        this.scene.add(this.debugTargetMarker);
        this.debugTargetMarker.visible = false;
    }

    setType(type) { this.type = type; }

    startCasting(target) {
        this.isCasting = true;
        this.currentTarget.copy(target);
        
        // Debug Visuals
        this.debugTargetMarker.position.copy(target);
        this.debugTargetMarker.visible = true;
        
        console.log(`🕒 SpellSystem: CASTING ${this.type} at`, target);

        this.animState = 'THRUST'; 
        this.animTimer = Date.now();
        
        const start = this.wizard.getSpellOrigin();

        // --- INSTANT FIRE LOGIC ---
        if(this.type === 'bolt' || this.type === 'fire') {
            this.fireProjectileLocal(start, this.currentTarget);
        }
        else if (this.type === 'lightning') {
            this.createLightning(start, this.currentTarget, true);
        }
        else if (this.type === 'beam') {
            this.createBeam(start, this.currentTarget, true);
        }
        else if (this.type === 'water') {
            this.fireProjectileLocal(start, this.currentTarget);
        }
    }

    stopCasting() {
        this.isCasting = false;
        this.clearLocalChannel();
        this.armTargetRotX = 0; 
        this.debugTargetMarker.visible = false;
    }

    updateTarget(target) {
        this.currentTarget.copy(target);
        this.debugTargetMarker.position.copy(target);
    }

    // --- PROJECTILE CREATION ---
    createProjectile(type, start, target, isRemote) {
        try {
            // 1. FLATTEN TRAJECTORY (Critical for Bolts)
            const flatTarget = target.clone();
            // Force target Y to be same as start Y for bolts/fire so they fly straight level
            if (type !== 'water') {
                flatTarget.y = start.y; 
            }

            const distance = start.distanceTo(flatTarget);
            
            // 2. SPEED SETUP (Use Safe Defaults)
            const speed = SAFE_SPEEDS[type] || 0.5;

            // 3. DIRECTION
            const velocity = new THREE.Vector3().subVectors(flatTarget, start).normalize();

            // 4. VISUALS
            let mesh, mat;
            let rotationSpeed = null; 

            if (type === 'bolt') {
                mat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 8 }); // High intensity
                // Rotate Cylinder to point forward (-Z)
                const geo = new THREE.CylinderGeometry(0.15, 0.15, 5).rotateX(-Math.PI / 2); // Longer, thicker bolt
                mesh = new THREE.Mesh(geo, mat);
                mesh.add(new THREE.PointLight(0xff0000, 4, 15));
                
                // Bolts don't spin
                rotationSpeed = new THREE.Vector3(0, 0, 0); 
            } else if (type === 'fire') {
                mat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 10, roughness: 0.4 });
                mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 1), mat); // Bigger fireball
                mesh.add(new THREE.PointLight(0xff6600, 6, 20));
                rotationSpeed = new THREE.Vector3(Math.random(), Math.random(), Math.random());
            } else {
                const waterGeo = new THREE.CylinderGeometry(0.2, 0.1, 1.5, 5).rotateX(-Math.PI / 2);
                const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x44aaff, transmission: 0.6, opacity: 0.9, transparent: true });
                mesh = new THREE.Mesh(waterGeo, waterMat);
                if(!isRemote) velocity.y += 0.2; 
            }

            mesh.position.copy(start);
            mesh.lookAt(flatTarget); 
            this.scene.add(mesh);

            this.projectiles.push({ 
                mesh, 
                direction: velocity, 
                speed: speed, 
                type, 
                life: 0, 
                isRemote,
                rot: rotationSpeed, 
                startPos: start.clone(), 
                targetPos: flatTarget.clone(), 
                totalDist: distance, 
                traveled: 0
            });
            
            console.log(`✨ SPAWNED ${type} at ${start.z.toFixed(1)} aiming to ${flatTarget.z.toFixed(1)}`);
            
        } catch (error) {
            console.error("❌ ERROR creating projectile:", error);
        }
    }

    fireProjectileLocal(start, target) { 
        this.createProjectile(this.type, start, target, false);
        this.armTargetRotX = 1.5; 
        setTimeout(() => { this.armTargetRotX = 0; }, 300); 
    }

    // --- MAIN UPDATE LOOP ---
    update(enemies, delta) {
        // ... (Remote Visuals - Keep existing logic here if needed) ...
        if (this.remoteChannelType) {
            if (this.remoteChannelType.includes('lightning')) {
                this.createLightning(this.remoteStart, this.remoteTarget, false);
                this.checkSelfCollision(this.remoteTarget, 'lightning');
            } else if (this.remoteChannelType.includes('beam')) {
                this.createBeam(this.remoteStart, this.remoteTarget, false);
                this.checkSelfCollision(this.remoteTarget, 'beam');
            }
        }

        // 2. LOCAL ANIMATION
        if (this.wizard.armGroup) {
            const now = Date.now();
            if (this.animState === 'THRUST') {
                this.wizard.armGroup.rotation.x = 1.2; 
                if (now - this.animTimer > 400) this.animState = 'IDLE';
            } else {
                this.wizard.armGroup.rotation.x *= 0.9;
            }
            this.wizard.armGroup.rotation.x += (this.armTargetRotX - this.wizard.armGroup.rotation.x) * 0.15;
            this.wizard.armGroup.updateWorldMatrix(true, true);
        }

        // 3. CONTINUOUS SPELLS
        const start = this.wizard.getSpellOrigin();
        if (this.isCasting && this.animState === 'THRUST') {
            if (this.type === 'lightning') this.createLightning(start, this.currentTarget, true);
            else if (this.type === 'beam') this.createBeam(start, this.currentTarget, true);
            else if (this.type === 'water' && Date.now() % 5 === 0) this.fireProjectileLocal(start, this.currentTarget);
        }

        // 4. PHYSICS UPDATE (FIXED)
        // We use a fixed time step logic here to prevent huge jumps
        const frameSpeed = 1.0; // Multiplier

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            
            // Move based on speed (Units per Frame)
            // Note: We ignored 'delta' for position to prevent lag-spikes teleporting the bullet
            const moveStep = p.direction.clone().multiplyScalar(p.speed * frameSpeed);
            p.mesh.position.add(moveStep);
            
            p.traveled += moveStep.length();
            p.life += 1;

            if (p.rot) {
                p.mesh.rotation.x += p.rot.x * 0.1;
                p.mesh.rotation.y += p.rot.y * 0.1;
            }

            if (p.type === 'water') {
                p.direction.y -= 0.01; // Gravity
            }

            // Kill Logic
            if (p.traveled >= p.totalDist || p.life > 300) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                
                // Explode visual
                if(this.particleSystem) this.particleSystem.createExplosion(p.mesh.position, 0xaaaaaa, 5);
                
                // Collision
                if (!p.isRemote) this.checkCollision(p.mesh.position, p.type, enemies);
                else this.checkSelfCollision(p.mesh.position, p.type);
            }
        }
    }
    
    // --- HELPER FUNCTIONS (Condensed) ---
    clearLocalChannel() { if(this.channelMesh) { this.scene.remove(this.channelMesh); this.channelMesh = null; } this.channelLights.forEach(l => this.scene.remove(l)); this.channelLights = []; }
    createLightning(start, target, isLocal) {
        if (isLocal) this.clearLocalChannel(); else if(this.remoteChannelMesh) { this.scene.remove(this.remoteChannelMesh); this.remoteChannelMesh.geometry.dispose(); }
        const points = []; const segments = 15;
        for (let i = 0; i <= segments; i++) { const pos = new THREE.Vector3().lerpVectors(start, target, i / segments); if (i > 0 && i < segments) pos.add(new THREE.Vector3((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5)); points.push(pos); }
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 5 });
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, 0.1, 8, false), mat);
        this.scene.add(mesh);
        if (isLocal) { this.channelMesh = mesh; for(let i=1; i<4; i++) { const l = new THREE.PointLight(0x00ffff, 15, 30); l.position.copy(points[Math.floor(i*4)]); l.position.y += 2.0; this.scene.add(l); this.channelLights.push(l); } this.checkCollision(target, 'lightning', this.wizard.scene.children.filter(x=>x.userData.hp)); } else { this.remoteChannelMesh = mesh; }
    }
    createBeam(start, target, isLocal) {
        if (isLocal) this.clearLocalChannel(); else if(this.remoteChannelMesh) this.scene.remove(this.remoteChannelMesh);
        const dist = start.distanceTo(target);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, dist).rotateX(-Math.PI / 2).translate(0, 0, dist / 2), mat);
        mesh.position.copy(start); mesh.lookAt(target); this.scene.add(mesh);
        if (isLocal) { this.channelMesh = mesh; const l = new THREE.PointLight(0xffaa00, 6, 15); l.position.copy(target); l.position.y += 1; this.scene.add(l); this.channelLights.push(l); this.checkCollision(target, 'beam', this.wizard.scene.children.filter(x=>x.userData.hp)); } else { this.remoteChannelMesh = mesh; }
    }
    checkCollision(pos, type, enemies) { let hit = false; enemies.forEach(e => { if (e.userData.hp > 0 && pos.distanceTo(e.position) < 3.0) { let damage = 1; if(type === 'bolt') damage = 20; if(type === 'fire') damage = 10; e.userData.hp -= damage; e.traverse((child) => { if(child.isMesh && child.material && child.material.emissive) child.material.emissive.setHex(0xffffff); }); e.position.x += (Math.random() - 0.5) * 0.2; if (e.userData.hp <= 0) { e.scale.set(0.1, 0.1, 0.1); e.visible = false; if(this.particleSystem) this.particleSystem.createExplosion(e.position, 0xff0000, 20); } hit = true; } }); return hit; }
    checkSelfCollision(pos, type) { const myPos = this.wizard.group.position; const center = new THREE.Vector3(myPos.x, myPos.y + 2.5, myPos.z); if (pos.distanceTo(center) < 2.5) { this.flashSelf(); return true; } return false; }
    flashSelf() { if (!this.wizard.model) return; this.wizard.model.traverse((child) => { if (child.isMesh && child.material && child.material.emissive) child.material.emissive.setHex(0xffffff); }); this.wizard.group.position.x += (Math.random()-0.5) * 0.5; }
}