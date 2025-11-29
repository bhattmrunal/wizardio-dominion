import * as THREE from 'three';
import { Config } from './Config.js';

export class SpellSystem {
    constructor(scene, wizard, particleSystem) {
        this.scene = scene;
        this.wizard = wizard;
        this.particleSystem = particleSystem;
        
        this.type = 'bolt';
        this.isCasting = false;
        this.projectiles = [];
        this.currentTarget = new THREE.Vector3();
        
        this.channelMesh = null;
        this.channelLights = [];
        
        this.remoteChannelType = null;
        this.remoteChannelMesh = null;
        this.remoteTarget = new THREE.Vector3(0, 2, 0); 
        this.remoteStart = new THREE.Vector3(); 

        this.armTargetRotX = 0; 
    }

    setType(type) {
        this.type = type;
        let color = 0xffffff;
        if(type === 'bolt') color = 0xff3333;
        if(type === 'lightning') color = 0x00ffff;
        if(type === 'fire') color = 0xff4400;
        if(type === 'water') color = 0x00aaff;
        if(type === 'beam') color = 0xffaa00;
        
        if(this.wizard.gem) {
            this.wizard.gem.material.color.setHex(color);
            this.wizard.gem.material.emissive.setHex(color);
        }
    }

    startCasting(target) {
        this.isCasting = true;
        this.currentTarget.copy(target);
        this.animState = 'WINDUP';
        this.animTimer = Date.now();
    }

    stopCasting() {
        this.isCasting = false;
        this.clearLocalChannel();
        this.armTargetRotX = 0; 
    }

    updateTarget(target) {
        this.currentTarget.copy(target);
    }

    // --- PROJECTILE CREATION ---
    createProjectile(type, start, target, isRemote) {
        const distance = start.distanceTo(target);
        let speed = 1.0;
        if (type === 'bolt') speed = Config.spells.boltSpeed;
        else if (type === 'fire') speed = Config.spells.fireballSpeed;
        else if (type === 'water') speed = Config.spells.waterSpeed;

        // Pure direction vector (Length 1)
        const direction = new THREE.Vector3().subVectors(target, start).normalize();

        let mesh, mat;
        if (type === 'bolt') {
            mat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 5 });
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4).rotateX(-Math.PI / 2), mat);
            mesh.add(new THREE.PointLight(0xff0000, 5, 20));
        } else if (type === 'fire') {
            mat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 8, roughness: 0.8 });
            mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), mat);
            mesh.add(new THREE.PointLight(0xff6600, 6, 20));
        } else {
            const waterGeo = new THREE.CylinderGeometry(0.15, 0.05, 1.2, 5).rotateX(-Math.PI / 2);
            const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x44aaff, transmission: 0.6, opacity: 0.8, transparent: true, metalness: 0, roughness: 0.2, ior: 1.33 });
            mesh = new THREE.Mesh(waterGeo, waterMat);
            if(!isRemote) direction.y += 0.2; 
        }

        mesh.position.copy(start);
        mesh.lookAt(target);
        this.scene.add(mesh);

        this.projectiles.push({ 
            mesh, 
            direction, 
            speed,
            type, 
            life: 0, 
            isRemote,
            // IMPORTANT: Ensure rot is always created
            rot: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
            startPos: start.clone(),
            targetPos: target.clone(),
            totalDist: distance, 
            traveled: 0
        });
    }

    fireBolt(s, t) { this.createProjectile('bolt', s, t, false); this.armTargetRotX = 1.5; setTimeout(() => { this.armTargetRotX = 0; }, 300); }
    fireFireball(s, t) { this.createProjectile('fire', s, t, false); this.armTargetRotX = 1.8; setTimeout(() => { this.armTargetRotX = 0; }, 400); }
    fireWater(s, t) { this.createProjectile('water', s, t, false); this.armTargetRotX = 1.2; }
    fireRemoteSpell(type, start, target) { this.createProjectile(type, start, target, true); }
    fireProjectileLocal(start, target) { 
        if (this.type === 'bolt') this.fireBolt(start, target);
        if (this.type === 'fire') this.fireFireball(start, target);
    }

    // --- REMOTE CHANNELING ---
    startRemoteChannel(type, startPos, targetPos) {
        this.stopRemoteChannel();
        this.remoteChannelType = type;
        this.remoteStart.copy(startPos);
        if(targetPos) this.remoteTarget.copy(targetPos);
    }

    updateRemoteTarget(x, y, z) {
        this.remoteTarget.lerp(new THREE.Vector3(x, y, z), 0.2); 
    }

    stopRemoteChannel() {
        this.remoteChannelType = null;
        if (this.remoteChannelMesh) {
            this.scene.remove(this.remoteChannelMesh);
            this.remoteChannelMesh.geometry.dispose();
            this.remoteChannelMesh.material.dispose();
            this.remoteChannelMesh = null;
        }
        this.channelLights.forEach(l => this.scene.remove(l));
        this.channelLights = [];
    }

    // --- UPDATE LOOP ---
    update(enemies, delta) {
        // 1. Remote Visuals
        if (this.remoteChannelType) {
            if (this.remoteChannelType.includes('lightning')) {
                this.createLightning(this.remoteStart, this.remoteTarget, false);
                this.checkSelfCollision(this.remoteTarget, 'lightning');
            } else if (this.remoteChannelType.includes('beam')) {
                this.createBeam(this.remoteStart, this.remoteTarget, false);
                this.checkSelfCollision(this.remoteTarget, 'beam');
            }
        }

        // 2. Local Animation
        if (this.wizard.armGroup) {
            const now = Date.now();
            if (this.animState === 'WINDUP') {
                this.wizard.armGroup.rotation.x = -0.5; 
                this.wizard.armGroup.rotation.z = 0; 
                if (now - this.animTimer > 100) {
                    this.animState = 'THRUST';
                    if(this.type === 'bolt' || this.type === 'fire') {
                        const s = this.wizard.getSpellOrigin();
                        this.fireProjectileLocal(s, this.currentTarget);
                    }
                }
            } 
            else if (this.animState === 'THRUST') {
                this.wizard.armGroup.rotation.x = 1.2; 
                this.wizard.armGroup.rotation.z = 0;
                if (this.isCasting && (this.type === 'water' || this.type === 'lightning' || this.type === 'beam')) { /* Stay */ } 
                else if (now - this.animTimer > 400) { this.animState = 'IDLE'; }
            }
            else {
                this.wizard.armGroup.rotation.x *= 0.9;
                this.wizard.armGroup.rotation.z *= 0.9;
            }
            this.wizard.armGroup.rotation.x += (this.armTargetRotX - this.wizard.armGroup.rotation.x) * 0.15;
            this.wizard.armGroup.updateWorldMatrix(true, true);
        }

        const start = this.wizard.getSpellOrigin();
        if (this.isCasting && this.animState === 'THRUST') {
            if (this.type === 'lightning') this.createLightning(start, this.currentTarget, true);
            else if (this.type === 'beam') this.createBeam(start, this.currentTarget, true);
            else if (this.type === 'water' && Date.now() % 3 === 0) this.fireWater(start, this.currentTarget);
        }

        if (this.wizard.model) {
            this.wizard.model.traverse((child) => { 
                if (child.isMesh && child.material && child.material.emissive && child.material.emissive.g > 0) {
                    child.material.emissive.multiplyScalar(0.85);
                }
            });
        }

        // 3. PROJECTILE PHYSICS
        const timeScale = delta * 60; 

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            
            // Move based on speed/direction
            const moveStep = p.direction.clone().multiplyScalar(p.speed * timeScale);
            p.mesh.position.add(moveStep);
            p.traveled += moveStep.length();
            p.life += timeScale;

            if (p.type === 'water') {
                p.direction.y -= Config.spells.waterGravity * 0.1 * timeScale;
                p.mesh.lookAt(p.mesh.position.clone().add(p.direction));
            }
            
            // SAFETY CHECK: Ensure p.rot exists before using it
            if (p.type === 'fire' && p.rot) {
                p.mesh.rotation.x += p.rot.x * timeScale;
                p.mesh.rotation.y += p.rot.y * timeScale;
            }

            if (p.traveled >= p.totalDist) {
                if(this.particleSystem) this.particleSystem.createExplosion(p.mesh.position, 0xaaaaaa, 5);
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                if (!p.isRemote) this.checkCollision(p.mesh.position, p.type, enemies);
                else this.checkSelfCollision(p.mesh.position, p.type);
                continue;
            }

            let hit = false;
            if (!p.isRemote) hit = this.checkCollision(p.mesh.position, p.type, enemies);
            else hit = this.checkSelfCollision(p.mesh.position, p.type);

            if (hit || p.life > 150 || p.mesh.position.y < 0) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    // ... (Keep clearLocalChannel, createLightning, createBeam, checkCollision, checkSelfCollision, flashSelf) ...
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
    checkCollision(pos, type, enemies) {
        let hit = false;
        enemies.forEach(e => {
            if (e.userData.hp > 0 && pos.distanceTo(e.position) < 3.0) {
                let damage = 1; if(type === 'bolt') damage = 20; if(type === 'fire') damage = 10;
                e.userData.hp -= damage;
                e.traverse((child) => { if(child.isMesh && child.material && child.material.emissive) child.material.emissive.setHex(0xffffff); });
                e.position.x += (Math.random() - 0.5) * 0.2;
                if (e.userData.hp <= 0) { e.scale.set(0.1, 0.1, 0.1); e.visible = false; if(this.particleSystem) this.particleSystem.createExplosion(e.position, 0xff0000, 20); }
                hit = true;
            }
        });
        return hit;
    }
    checkSelfCollision(pos, type) { const myPos = this.wizard.group.position; const center = new THREE.Vector3(myPos.x, myPos.y + 2.5, myPos.z); if (pos.distanceTo(center) < 2.5) { this.flashSelf(); return true; } return false; }
    flashSelf() { if (!this.wizard.model) return; this.wizard.model.traverse((child) => { if (child.isMesh && child.material && child.material.emissive) child.material.emissive.setHex(0xffffff); }); this.wizard.group.position.x += (Math.random()-0.5) * 0.5; }
}