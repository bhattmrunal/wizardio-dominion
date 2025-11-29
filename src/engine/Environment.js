import * as THREE from 'three';
import { Config } from './Config.js'; // IMPORT CONFIG

let windSystem = null;

export function createEnvironment(scene) {
    // --- 1. ATMOSPHERE (From Config) ---
    scene.background = new THREE.Color(Config.atmosphere.skyColor);
    scene.fog = new THREE.Fog(
        Config.atmosphere.fogColor, 
        Config.atmosphere.fogNear, 
        Config.atmosphere.fogFar
    ); 

    // --- 2. LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0x4444ff, 0x111122, 0.3); 
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xaaccff, 1.0);
    dirLight.position.set(-30, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    const d = 60;
    dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // --- 3. TERRAIN ---
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a2f0b'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60000; i++) {
        ctx.fillStyle = ['#2a4c10', '#0f2d08', '#2e4c23'][Math.floor(Math.random() * 3)];
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 4);
    }
    const grassTex = new THREE.CanvasTexture(canvas);
    grassTex.wrapS = THREE.RepeatWrapping; grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(30, 30);

    const floorGeo = new THREE.PlaneGeometry(250, 250, 128, 128);
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = Math.sin(x * 0.1) * 0.7 + Math.cos(y * 0.08) * 0.5 + Math.random() * 0.1;
        pos.setZ(i, z);
    }
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- 4. TREES (From Config) ---
    // Use Config colors and roughness
    const treeMat = new THREE.MeshStandardMaterial({ 
        color: Config.trees.leafColor, 
        roughness: Config.trees.roughness 
    }); 
    const barkMat = new THREE.MeshStandardMaterial({ 
        color: Config.trees.barkColor, 
        roughness: 0.6 
    });
    
    function createTree(x, z) {
        const g = new THREE.Group();
        const y = Math.sin(x * 0.1) * 0.7 + Math.cos(z * 0.08) * 0.5;
        g.position.set(x, y, z);
        const h = 1.2 + Math.random(); 
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3 * h, 7), barkMat); t.position.y = (3 * h) / 2; t.castShadow = true; t.receiveShadow = true; g.add(t);
        const l1 = new THREE.Mesh(new THREE.ConeGeometry(3, 4 * h, 8), treeMat); l1.position.y = (3 * h) + 1; l1.castShadow = true; l1.receiveShadow = true; g.add(l1);
        const l2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3 * h, 8), treeMat); l2.position.y = (3 * h) + 3; l2.castShadow = true; l2.receiveShadow = true; g.add(l2);
        scene.add(g);
    }

    // Use Config count
    for (let i = 0; i < Config.trees.count; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const x = side * (15 + Math.random() * 60);
        const z = (Math.random() - 0.5) * 140;
        createTree(x, z);
    }

    // --- 5. WIND SYSTEM (From Config) ---
    windSystem = new WindSystem(scene);
    return windSystem;
}

class WindSystem {
    constructor(scene) {
        this.leaves = [];
        const leafMat = new THREE.MeshStandardMaterial({ color: Config.wind.leafColor, side: THREE.DoubleSide, roughness: 1 });
        const leafGeo = new THREE.PlaneGeometry(0.2, 0.4);

        // Use Config.wind.leavesCount
        for(let i=0; i < Config.wind.leavesCount; i++) {
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set((Math.random()-0.5) * 60, 2 + Math.random() * 10, (Math.random()-0.5) * 60);
            leaf.rotation.set(Math.random(), Math.random(), Math.random());
            leaf.userData = {
                speedX: 0.1 + Math.random() * 0.2,
                speedY: 0.05 + Math.random() * 0.05,
                rotSpeed: (Math.random()-0.5) * 0.1
            };
            scene.add(leaf);
            this.leaves.push(leaf);
        }
    }

    update(delta) {
        this.leaves.forEach(leaf => {
            // Apply Config.wind.speed multiplier
            leaf.position.x += leaf.userData.speedX * Config.wind.speed;
            leaf.position.y -= leaf.userData.speedY * Config.wind.speed;
            
            leaf.rotation.x += leaf.userData.rotSpeed * Config.wind.speed;
            leaf.rotation.z += leaf.userData.rotSpeed * Config.wind.speed;

            if(leaf.position.y < 0 || leaf.position.x > 30) {
                leaf.position.x = -30;
                leaf.position.y = 5 + Math.random() * 10;
            }
        });
    }
}
/*import * as THREE from 'three';

export function createEnvironment(scene) {
    // --- 1. EERIE ATMOSPHERE ---
    const fogColor = 0x111122; // Dark misty blue
    scene.background = new THREE.Color(fogColor);
    // Start fog close (20) and end relatively close (150) for that "Silent Hill" vibe
    scene.fog = new THREE.Fog(fogColor, 20, 150); 

    // --- 2. LIGHTING ---
    // Dim ambient light to make spells pop
    const hemiLight = new THREE.HemisphereLight(0x4444ff, 0x111122, 0.3); 
    scene.add(hemiLight);

    // Moonlight (Cool blue)
    const dirLight = new THREE.DirectionalLight(0xaaccff, 1.0);
    dirLight.position.set(-30, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    const d = 60;
    dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // --- 3. GRASS TEXTURE ---
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a2f0b'; // Darker grass base
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60000; i++) {
        // Darker, muted greens for eerie look
        ctx.fillStyle = ['#2a4c10', '#0f2d08', '#2e4c23'][Math.floor(Math.random() * 3)];
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 4);
    }
    const grassTex = new THREE.CanvasTexture(canvas);
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(30, 30);

    // --- 4. TERRAIN ---
    const floorGeo = new THREE.PlaneGeometry(250, 250, 128, 128);
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = Math.sin(x * 0.1) * 0.7 + Math.cos(y * 0.08) * 0.5 + Math.random() * 0.1;
        pos.setZ(i, z);
    }
    floorGeo.computeVertexNormals();

    const floor = new THREE.Mesh(
        floorGeo,
        new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- 5. TREES (REFLECTIVE) ---
    // Lower roughness = Shinier trees = Better lightning reflection
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x112211, roughness: 0.4 }); 
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x221100, roughness: 0.5 });

    function createTree(x, z) {
        const g = new THREE.Group();
        const y = Math.sin(x * 0.1) * 0.7 + Math.cos(z * 0.08) * 0.5;
        g.position.set(x, y, z);
        const h = 1.2 + Math.random(); 

        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3 * h, 7), barkMat);
        t.position.y = (3 * h) / 2;
        t.castShadow = true;
        t.receiveShadow = true;
        g.add(t);

        const l1 = new THREE.Mesh(new THREE.ConeGeometry(3, 4 * h, 8), treeMat);
        l1.position.y = (3 * h) + 1;
        l1.castShadow = true;
        l1.receiveShadow = true;
        g.add(l1);

        const l2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3 * h, 8), treeMat);
        l2.position.y = (3 * h) + 3;
        l2.castShadow = true;
        l2.receiveShadow = true;
        g.add(l2);

        scene.add(g);
    }

    // Dense forest walls
    for (let i = 0; i < 80; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        // Push trees further out (15+) to keep arena clear
        const x = side * (15 + Math.random() * 60);
        const z = (Math.random() - 0.5) * 140;
        createTree(x, z);
    }
}
    */
