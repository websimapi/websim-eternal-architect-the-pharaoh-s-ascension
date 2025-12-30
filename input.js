import nipplejs from 'nipplejs';

export class InputManager {
    constructor(element) {
        this.moveVector = { x: 0, y: 0 };
        this.lookVector = { x: 0, y: 0 };
        this.keys = {};
        this.touchId = null;
        this.container = element;

        this.initKeyboard();
        this.initTouch();
    }

    initKeyboard() {
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    initTouch() {
        // Joystick for movement (Bottom Left)
        const joystickZone = document.createElement('div');
        joystickZone.style.cssText = `
            position: absolute; bottom: 50px; left: 50px; width: 100px; height: 100px; z-index: 20;
        `;
        document.body.appendChild(joystickZone);

        const manager = nipplejs.create({
            zone: joystickZone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        manager.on('move', (evt, data) => {
            if (data && data.vector) {
                this.moveVector.x = data.vector.x;
                this.moveVector.y = -data.vector.y; // Invert Y for forward
            }
        });

        manager.on('end', () => {
            this.moveVector = { x: 0, y: 0 };
        });

        // Touch drag for look (Right side of screen)
        this.container.addEventListener('touchstart', (e) => {
            for (let i=0; i<e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.clientX > window.innerWidth / 2) {
                    this.touchId = t.identifier;
                    this.lastTouchX = t.clientX;
                    this.lastTouchY = t.clientY;
                }
            }
        }, {passive: false});

        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i=0; i<e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === this.touchId) {
                    const deltaX = t.clientX - this.lastTouchX;
                    const deltaY = t.clientY - this.lastTouchY;
                    
                    this.lookVector.x = deltaX * 0.005;
                    this.lookVector.y = deltaY * 0.005;

                    this.lastTouchX = t.clientX;
                    this.lastTouchY = t.clientY;
                }
            }
        }, {passive: false});

        this.container.addEventListener('touchend', (e) => {
            for (let i=0; i<e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.touchId) {
                    this.touchId = null;
                    this.lookVector = {x: 0, y: 0};
                }
            }
        });
    }

    getMovement() {
        // Combine Keyboard and Joystick
        let dx = 0;
        let dz = 0;

        if (this.keys['KeyW']) dz -= 1;
        if (this.keys['KeyS']) dz += 1;
        if (this.keys['KeyA']) dx -= 1;
        if (this.keys['KeyD']) dx += 1;

        // Apply joystick
        dx += this.moveVector.x;
        dz += this.moveVector.y;

        // Normalize
        const len = Math.sqrt(dx*dx + dz*dz);
        if (len > 1) {
            dx /= len;
            dz /= len;
        }

        return { x: dx, z: dz };
    }

    getLook() {
        return this.lookVector;
    }

    resetLook() {
        if (!this.touchId) {
             this.lookVector = {x:0, y:0};
        }
    }
}