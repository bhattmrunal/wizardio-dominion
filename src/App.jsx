import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [activeSpell, setActiveSpell] = useState('bolt');

  useEffect(() => {
    // 1. Init
    if (canvasRef.current && !engineRef.current) {
      console.log("🚀 Mounting Game Engine...");
      engineRef.current = new GameEngine(canvasRef.current);
    }

    // 2. Cleanup Function (React calls this on refresh/unmount)
    return () => {
      console.log("🛑 Unmounting Game Engine...");
      if (engineRef.current) {
        engineRef.current.dispose(); // This kills the network connection
        engineRef.current = null;
      }
    };
  }, []);

  const handleSpellSelect = (type) => {
    setActiveSpell(type);
    if (engineRef.current && engineRef.current.spellSystem) {
      engineRef.current.spellSystem.setType(type);
    }
  };

  const handleHover = (e) => {
    if(e.cancelable) e.preventDefault();
    if (engineRef.current && engineRef.current.wizard) {
      engineRef.current.wizard.triggerHover();
      if(engineRef.current.networkManager) {
        engineRef.current.networkManager.sendCastSpell('hover', {x:0, y:0, z:0});
      }
    }
  };

  return (
    <div className="app-container">
      <canvas ref={canvasRef} className="game-canvas" />

      <div className="ui-layer">
        <div className="score-board">Wizardio Dominion</div>
        
        <div className="spell-bar">
          {['bolt', 'lightning', 'fire', 'water', 'beam'].map((spell) => (
            <button
              key={spell}
              className={`spell-btn ${activeSpell === spell ? 'active' : ''}`}
              onTouchStart={(e) => { e.preventDefault(); handleSpellSelect(spell); }}
              onClick={() => handleSpellSelect(spell)}
            >
              {spell}
            </button>
          ))}
          
          <button 
            className="spell-btn hover-btn"
            onTouchStart={handleHover}
            onClick={handleHover}
          >
            Levitate
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;