class UIManager {
    constructor() {
        console.log("Initializing UI Elements...");
        this.elements = {
            health: document.getElementById('health-fill'),
            xp: document.getElementById('xp-fill'),
            ammo: document.getElementById('ammo-val'),
            wave: document.getElementById('wave-num'),
            overlays: {
                start: document.getElementById('start-overlay'),
                skill: document.getElementById('skill-overlay'),
                death: document.getElementById('death-overlay')
            },
            skillList: document.getElementById('skill-list'),
            finalWave: document.getElementById('final-wave'),
            finalKills: document.getElementById('final-kills'),
            mapCanvas: document.getElementById('minimapCanvas')
        };

        if (this.elements.mapCanvas) {
            this.mapCtx = this.elements.mapCanvas.getContext('2d');
            this.elements.mapCanvas.width = 150;
            this.elements.mapCanvas.height = 150;
        } else {
            console.error("Critical Error: Minimap canvas NOT found!");
        }
    }

    updateHUD(player, waveNum, enemies = []) {
        this.elements.health.style.width = `${(player.hp / player.maxHp) * 100}%`;
        this.elements.xp.style.width = `${(player.xp / player.xpToNext) * 100}%`;
        this.elements.ammo.innerText = player.weapon.ammo === Infinity ? '∞' : `${player.weapon.ammo}/${player.weapon.maxAmmo}`;
        this.elements.wave.innerText = waveNum;

        this.drawMinimap(player, enemies);
    }

    drawMinimap(player, enemies) {
        const ctx = this.mapCtx;
        const w = this.elements.mapCanvas.width;
        const h = this.elements.mapCanvas.height;
        ctx.clearRect(0, 0, w, h);

        const scale = 0.05;
        const centerX = w / 2;
        const centerY = h / 2;

        // Player dot
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Enemy dots
        ctx.fillStyle = '#ff00ea';
        enemies.forEach(e => {
            const dx = (e.x - player.x) * scale;
            const dy = (e.y - player.y) * scale;
            if (Math.abs(dx) < centerX && Math.abs(dy) < centerY) {
                ctx.beginPath();
                ctx.arc(centerX + dx, centerY + dy, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    showOverlay(name) {
        Object.values(this.elements.overlays).forEach(o => o.classList.add('hidden'));
        if (this.elements.overlays[name]) {
            this.elements.overlays[name].classList.remove('hidden');
        }
    }

    hideOverlays() {
        Object.values(this.elements.overlays).forEach(o => o.classList.add('hidden'));
    }

    showLevelUp(options, onSelect) {
        this.elements.skillList.innerHTML = '';
        options.forEach(opt => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            card.innerHTML = `
                <div class="skill-icon">${opt.icon}</div>
                <div class="skill-info">
                    <div class="name">${opt.name}</div>
                    <div class="desc">${opt.desc}</div>
                </div>
            `;
            card.onclick = () => {
                onSelect(opt);
                this.hideOverlays();
            };
            this.elements.skillList.appendChild(card);
        });
        this.showOverlay('skill');
    }

    generateBranding() {
        console.log("Generating Procedural Branding...");
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');

        // Cinematic Background
        const grad = ctx.createRadialGradient(600, 315, 0, 600, 315, 800);
        grad.addColorStop(0, '#151530');
        grad.addColorStop(1, '#050510');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1200, 630);

        // Neon Grid Floor
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 1200; i += 40) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 630); ctx.stroke();
        }
        for (let j = 0; j < 630; j += 40) {
            ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(1200, j); ctx.stroke();
        }

        // Hero Text Styling
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 120px Orbitron';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#00f2ff';
        ctx.fillStyle = '#fff';
        ctx.fillText('SURVIVAL', 600, 280);
        
        ctx.font = '900 80px Orbitron';
        ctx.shadowColor = '#ff00ea';
        ctx.fillStyle = '#ff00ea';
        ctx.fillText('ARENA', 600, 380);

        // Visual Accents
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0, 242, 255, 0.5)';
        ctx.fillRect(400, 420, 400, 4);

        // Apply as Banner Background
        const banner = document.querySelector('.game-banner');
        if (banner) {
            banner.style.backgroundImage = `url(${canvas.toDataURL()})`;
            banner.style.backgroundSize = 'cover';
        }
        
        console.log("Branding Ready.");
    }

    showGameOver(wave, kills) {
        this.elements.finalWave.innerText = wave;
        this.elements.finalKills.innerText = kills;
        this.showOverlay('death');
    }
}

class SoundManager {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("AudioContext initialization failed:", e);
            this.ctx = { state: 'suspended', resume: () => Promise.resolve() };
        }
    }

    playShoot() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playExplosion() {
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }
    
    playHit() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }
}

// Managers will be initialized by GameManager
window.UIManager = UIManager;
window.SoundManager = SoundManager;
