/**
 * NEON VELOCITY - UI and Entry Point
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Engines
    const engine = new GameEngine('gameCanvas');
    AudioEngine.init();

    // 2. UI Elements
    const startScreen = document.getElementById('start-screen');
    const howScreen = document.getElementById('how-screen');
    const hud = document.getElementById('hud');
    const btnStart = document.getElementById('btn-start');
    const btnHow = document.getElementById('btn-how');
    const btnBack = document.getElementById('btn-back');
    const btnNext = document.getElementById('btn-next');
    const btnRestart = document.getElementById('btn-restart');
    const audioToggle = document.getElementById('audio-toggle');
    const audioIcon = document.getElementById('audio-icon');

    // 3. Load Assets
    console.log('Loading high-performance assets...');
    await Assets.loadAll();
    console.log('Assets ready.');

    // 4. Input Listeners for UI
    btnStart.addEventListener('click', () => {
        AudioEngine.playClick();
        AudioEngine.resume();
        startScreen.classList.remove('active');
        hud.classList.remove('hidden');
        engine.init();
        engine.start();
    });

    btnHow.addEventListener('click', () => {
        AudioEngine.playClick();
        startScreen.classList.remove('active');
        howScreen.classList.add('active');
    });

    btnBack.addEventListener('click', () => {
        AudioEngine.playClick();
        howScreen.classList.remove('active');
        startScreen.classList.add('active');
    });

    btnNext.addEventListener('click', () => {
        AudioEngine.playClick();
        engine.resumeFromLevelUp();
    });

    btnRestart.addEventListener('click', () => {
        AudioEngine.playClick();
        document.getElementById('gameover-screen').classList.remove('active');
        hud.classList.remove('hidden');
        engine.reset();
        engine.start();
    });

    audioToggle.addEventListener('click', () => {
        const isMuted = AudioEngine.toggleMute();
        audioIcon.textContent = isMuted ? '🔇' : '🔊';
        audioToggle.style.opacity = isMuted ? '0.5' : '1';
    });

    // 5. Check for touch device to show mobile controls
    if ('ontouchstart' in window) {
        document.getElementById('mobile-controls').classList.remove('hidden');
    }

    // 6. Handle Blur
    window.addEventListener('blur', () => {
        if (engine.state === 'PLAYING') {
            engine.isRunning = false;
            document.getElementById('pause-screen').classList.add('active');
        }
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
        AudioEngine.playClick();
        document.getElementById('pause-screen').classList.remove('active');
        engine.isRunning = true;
        engine.lastTime = performance.now();
        requestAnimationFrame((t) => engine.loop(t));
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
        location.reload();
    });
});
