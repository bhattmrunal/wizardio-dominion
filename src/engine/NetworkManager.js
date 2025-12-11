import { io } from "socket.io-client"; 
import * as THREE from 'three';

export class NetworkManager {
    constructor(scene, spellSystem, enemyManager) {
        this.scene = scene;
        this.spellSystem = spellSystem;
        this.enemyManager = enemyManager;
        this.socket = null;
        this.myId = null;
        
        // Arena Sync Settings
        this.arenaLength = 50; 
        this.lastAimTime = 0;
        this.aimInterval = 50; 

        this.connect();
    }

    // --- 1. RESTORE SESSION ID ---
    getSessionId() {
        let id = sessionStorage.getItem("wizard_session_id");
        if (!id) {
            id = 'wiz_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem("wizard_session_id", id);
        }
        return id;
    }

    connect() {
        const sessionId = this.getSessionId();
        console.log("🔗 Connecting with Session ID:", sessionId);

        // --- 2. SEND ID TO SERVER ---
        this.socket = io("http://localhost:3005", {
            auth: {
                sessionId: sessionId // Server requires this!
            }
        });

        this.socket.on("connect", () => {
            console.log("✅ Connected to Server! ID:", this.socket.id);
            this.myId = this.socket.id;
        });

        this.socket.on("connect_error", (err) => {
            console.error("❌ Connection rejected:", err.message);
        });

        this.socket.on("spellCast", (data) => {
            // Ignore spells I sent myself
            if (data.sessionId !== sessionId) {
                this.handleIncomingSpell(data);
            }
        });
        this.socket.on("playerMove", (data) => {
            if (data.sessionId !== sessionId) {
                // Opponent moved!
                // Assuming we have reference to opponent wrapper, update it.
                // For now, we update the 'EnemyManager' target so spells aim correctly
                this.enemyManager.updateBossPosition(-data.x); // Mirror X
            }
        });

        this.socket.on("playerShield", (data) => {
            if (data.sessionId !== sessionId) {
                this.enemyManager.setBossShield(data.active);
            }
        });

        this.socket.on("playerAim", (data) => {
            // Ignore aim updates from myself
            if (data.sessionId !== sessionId) {
                const mirroredX = -data.x; 
                const mirroredY = data.y;  
                const mirroredZ = -(data.z + this.arenaLength); 
                this.spellSystem.updateRemoteTarget(mirroredX, mirroredY, mirroredZ);
            }
        });
    }

    sendCastSpell(type, targetVector) {
        if (!this.socket) return;
        this.socket.emit("castSpell", {
            type: type,
            targetX: targetVector.x,
            targetY: targetVector.y,
            targetZ: targetVector.z
        });
    }

    sendAim(targetVector) {
        if (!this.socket) return;
        const now = Date.now();
        if (now - this.lastAimTime > this.aimInterval) {
            this.socket.emit("updateAim", {
                x: targetVector.x,
                y: targetVector.y,
                z: targetVector.z
            });
            this.lastAimTime = now;
        }
    }
    sendMove(xPos) {
        if (!this.socket) return;
        this.socket.emit("move", { x: xPos });
    }

    sendShield(isActive) {
        if (!this.socket) return;
        this.socket.emit("shield", { active: isActive });
    }

    handleIncomingSpell(data) {
        if (data.type === 'stop_channel') {
            console.log("🛑 OPPONENT STOPPED CASTING");
            this.spellSystem.stopRemoteChannel();
            return;
        }

        if (data.type === 'hover') {
            this.enemyManager.triggerBossHover();
            return;
        }

        const boss = this.enemyManager.getBoss();
        let start = new THREE.Vector3(0, 5, -this.arenaLength); 

        if (boss) {
            start.copy(boss.position);
            start.y += 4; 
            start.z += 2; 
            if(boss.rotation) { boss.rotation.x = 0.2; setTimeout(() => boss.rotation.x = 0, 200); }
        }

        let tx = data.targetX || 0;
        let ty = data.targetY || 0;
        let tz = data.targetZ || -40;

        const finalTarget = new THREE.Vector3(
            -tx,           
            ty,            
            -(tz + this.arenaLength) 
        );

        if (data.type.includes('_start')) {
            this.spellSystem.startRemoteChannel(data.type, start, finalTarget);
        } else {
            this.spellSystem.fireRemoteSpell(data.type, start, finalTarget);
        }
    }
    
    disconnect() {
        if(this.socket) this.socket.disconnect();
    }
}