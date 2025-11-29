export const Config = {
    // ... (Existing atmosphere, trees, wind, wizard, enemies) ...
    atmosphere: {
        skyColor: 0x111122, 
        fogColor: 0x111122,
        fogNear: 20,
        fogFar: 150
    },
    trees: {
        leafColor: 0x112211, 
        barkColor: 0x221100, 
        roughness: 0.4,      
        count: 80            
    },
    wind: {
        speed: 1.0,          
        leavesCount: 15,     
        leafColor: 0x4a3c31  
    },
    wizard: {
        robeFlowIntensity: 0.1,
        hoverDuration: 3000,
        baseHeight: 0.8
    },
    enemies: {
        crystalColor: 0xff0055,
        crystalHP: 100,
        golemColor: 0x8899aa, 
        golemEyeColor: 0xff00ff,
        golemHP: 500
    },
    spells: {
        boltSpeed: 1.0,
        fireballSpeed: 0.4,
        waterSpeed: 0.7,
        waterGravity: 0.02
    },

    // --- NEW DEBUG FLAGS ---
    debug: {
        showNetworkTarget: false, // BLUE DOT (Opponent aim) - Set to false to hide
        showLocalTarget: false   // RED DOT (My aim)
    }
};