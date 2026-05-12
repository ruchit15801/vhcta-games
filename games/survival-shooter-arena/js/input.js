class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = {
            active: false,
            move: { active: false, id: null, startX: 0, startY: 0, currX: 0, currY: 0, vector: { x: 0, y: 0 } },
            aim: { active: false, id: null, startX: 0, startY: 0, currX: 0, currY: 0, vector: { x: 0, y: 0 } }
        };

        this.moveVector = { x: 0, y: 0 };
        this.aimVector = { x: 0, y: 0 };
        this.isFiring = false;
        this.isDashing = false;

        this.setupListeners();
    }

    setupListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Mouse
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouse.down = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.down = false;
        });

        // Touch
        const moveJoystick = document.getElementById('move-joystick');
        const fireJoystick = document.getElementById('fire-joystick');
        
        const handleTouch = (e, type) => {
            const isJoystick = e.target.closest('.joystick-base');
            if (isJoystick) e.preventDefault();
            
            this.touch.active = true;
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) mobileControls.style.display = 'block';

            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const rect = t.target.getBoundingClientRect();
                
                if (e.type === 'touchstart') {
                    if (t.target.closest('#move-joystick')) {
                        this.touch.move.active = true;
                        this.touch.move.id = t.identifier;
                        this.touch.move.startX = t.clientX;
                        this.touch.move.startY = t.clientY;
                    } else if (t.target.closest('#fire-joystick')) {
                        this.touch.aim.active = true;
                        this.touch.aim.id = t.identifier;
                        this.touch.aim.startX = t.clientX;
                        this.touch.aim.startY = t.clientY;
                    }
                }
            }
        };

        const handleMove = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (this.touch.move.active && t.identifier === this.touch.move.id) {
                    this.updateJoystick(this.touch.move, t, 'move-joystick');
                } else if (this.touch.aim.active && t.identifier === this.touch.aim.id) {
                    this.updateJoystick(this.touch.aim, t, 'fire-joystick');
                }
            }
        };

        const handleEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (this.touch.move.active && t.identifier === this.touch.move.id) {
                    this.resetJoystick(this.touch.move, 'move-joystick');
                } else if (this.touch.aim.active && t.identifier === this.touch.aim.id) {
                    this.resetJoystick(this.touch.aim, 'fire-joystick');
                }
            }
        };

        window.addEventListener('touchstart', handleTouch, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd, { passive: false });
        window.addEventListener('touchcancel', handleEnd, { passive: false });
    }

    updateJoystick(data, touch, elementId) {
        const dx = touch.clientX - data.startX;
        const dy = touch.clientY - data.startY;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 50);
        const angle = Math.atan2(dy, dx);
        
        data.vector.x = (Math.cos(angle) * distance) / 50;
        data.vector.y = (Math.sin(angle) * distance) / 50;

        const knob = document.querySelector(`#${elementId} .joystick-knob`);
        if (knob) {
            knob.style.transform = `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px))`;
        }
    }

    resetJoystick(data, elementId) {
        data.active = false;
        data.id = null;
        data.vector.x = 0;
        data.vector.y = 0;
        const knob = document.querySelector(`#${elementId} .joystick-knob`);
        if (knob) knob.style.transform = `translate(-50%, -50%)`;
    }

    update() {
        // Handle Movement
        if (this.touch.active && this.touch.move.active) {
            this.moveVector.x = this.touch.move.vector.x;
            this.moveVector.y = this.touch.move.vector.y;
        } else {
            this.moveVector.x = 0;
            this.moveVector.y = 0;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.moveVector.x -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) this.moveVector.x += 1;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) this.moveVector.y -= 1;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) this.moveVector.y += 1;

            // Normalize keyboard movement
            const mag = Math.sqrt(this.moveVector.x**2 + this.moveVector.y**2);
            if (mag > 0) {
                this.moveVector.x /= mag;
                this.moveVector.y /= mag;
            }
        }

        // Handle Aiming & Firing
        if (this.touch.active) {
            if (this.touch.aim.active) {
                this.aimVector.x = this.touch.aim.vector.x;
                this.aimVector.y = this.touch.aim.vector.y;
                this.isFiring = true;
            } else {
                this.isFiring = false;
            }
        } else {
            this.isFiring = this.mouse.down;
            // Aim vector is calculated in game loop relative to player position
        }

        this.isDashing = this.keys['Space'] || this.keys['ShiftLeft'];
    }
}

// Expose for GameManager
window.InputManager = InputManager;
