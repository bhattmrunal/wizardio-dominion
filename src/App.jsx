import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import './App.css';

// Abbreviated labels
const SPELL_LABELS = {
    'bolt': 'BLT',
    'lightning': 'LGT',
    'fire': 'FIR',
    'water': 'H2O',
    'beam': 'LAS'
};

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [activeSpell, setActiveSpell] = useState('bolt');
  const [isMobileApp, setIsMobileApp] = useState(false);
  
  // Aim Indicator State
  const [aimRoll, setAimRoll] = useState(0); 

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setIsMobileApp(isNative);

    if (isNative) {
        try { ScreenOrientation.lock({ orientation: 'portrait' }); } catch(e){}
    }

    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasRef.current);
      
      // Listen for roll data for the UI
      if (engineRef.current.sensorManager) {
          engineRef.current.sensorManager.onDebug = (data) => {
              setAimRoll(data.roll || 0);
          };
      }
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  const handleSpellSelect = (type) => {
    setActiveSpell(type);
    if (engineRef.current) engineRef.current.setSpellType(type);
  };

  const handleHover = (e) => {
    if(e.cancelable) e.preventDefault();
    if (engineRef.current?.wizard) {
      engineRef.current.wizard.triggerHover();
      engineRef.current.networkManager?.sendCastSpell('hover', {x:0, y:0, z:0});
    }
  };

  return (
    <div className="app-container">
      <canvas ref={canvasRef} className="game-canvas" />

      <div className="ui-layer">
        
        {/* --- PRODUCTION AIM INDICATOR --- */}
        {isMobileApp && (
            <div style={{
                position: 'absolute', 
                bottom: '250px', // Floating below character
                left: '50%', transform: 'translateX(-50%)',
                width: '140px', height: '4px', 
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '2px',
                pointerEvents: 'none'
            }}>
                {/* Center Tick */}
                <div style={{
                    position:'absolute', left:'50%', top:'-4px', 
                    width:'2px', height:'12px', background:'rgba(255,255,255,0.3)',
                    transform:'translateX(-50%)'
                }} />
                
                {/* Moving Aim Dot */}
                <div style={{
                    position: 'absolute',
                    top: '-5px', left: '50%',
                    width: '14px', height: '14px',
                    background: '#ffaa00',
                    borderRadius: '50%',
                    boxShadow: '0 0 8px #ffaa00',
                    // Map Tilt (-20 to +20) to pixels (-70px to +70px)
                    transform: `translateX(calc(-50% + ${Math.max(-70, Math.min(70, aimRoll * 3.5))}px))`
                }} />
            </div>
        )}

        <div className="score-board">Wizardio Dominion</div>
        
        {/* --- PRETTY DODGE BUTTONS --- */}
        {isMobileApp && (
            <div className="dodge-controls">
                <button className="dodge-btn left" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.movePlayer('left'); }}>
                    ‹
                </button>
                <button className="dodge-btn right" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.movePlayer('right'); }}>
                    ›
                </button>
            </div>
        )}

        {/* --- COMPACT SPELL BAR --- */}
        <div className="spell-bar">
          {['bolt', 'lightning', 'fire', 'water', 'beam'].map((spell) => (
            <button
              key={spell}
              className={`spell-btn ${activeSpell === spell ? 'active' : ''}`}
              onTouchStart={(e) => { e.preventDefault(); handleSpellSelect(spell); }}
              onClick={() => handleSpellSelect(spell)}
            >
              {SPELL_LABELS[spell]}
            </button>
          ))}
          
          <button 
            className="spell-btn hover-btn"
            onTouchStart={handleHover}
            onClick={handleHover}
          >
            FLY
          </button>
        </div>

      </div>
    </div>
  );
}

export default App;