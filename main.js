import { World } from './world.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';

class Game {
    constructor() {
        this.world = new World(document.getElementById('game-container'));
        this.audio = new AudioEngine();
        this.input = new InputManager(document.getElementById('game-container'));
        
        this.state = {
            started: false,
            health: 100,
            resources: { bio: 0, digi: 0, music: 0, dim: 0 },
            currentRoom: 'antechamber'
        };

        this.ui = {
            bio: document.getElementById('res-bio'),
            digi: document.getElementById('res-digi'),
            music: document.getElementById('res-music'),
            dim: document.getElementById('res-dim'),
            health: document.getElementById('health-bar'),
            prompt: document.getElementById('interaction-prompt'),
            startScreen: document.getElementById('start-screen'),
            synthMenu: document.getElementById('synthesis-menu'),
            narrative: document.getElementById('narrative-overlay')
        };

        this.bindEvents();
        this.loop();
    }

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.audio.init();
            this.ui.startScreen.classList.add('hidden');
            this.state.started = true;
        });

        // Click interaction (Desktop) & Touch Tap
        document.addEventListener('click', (e) => this.handleInteraction(e));
        document.addEventListener('touchstart', (e) => {
             // Basic tap detection
             if(e.touches.length === 1) this.handleInteraction(e);
        });

        // Synthesis Menu
        document.getElementById('synth-btn').addEventListener('click', () => {
            this.toggleSynthesis();
        });
        document.getElementById('close-synth').addEventListener('click', () => {
             this.ui.synthMenu.classList.add('hidden');
        });

        // Audio Pulse Listener
        this.audio.onBeat((count, time) => {
            this.world.onBeat(count);
            // Gameplay beat bonus could go here
        });
    }

    handleInteraction(e) {
        if (!this.state.started) return;
        
        // Don't raycast if clicking UI
        if (e.target.closest('button') || e.target.closest('#synthesis-menu')) return;

        const target = this.world.raycast();
        if (target) {
            if (target.type === 'wraith') {
                this.killWraith(target);
            } else if (target.type === 'portal') {
                this.travel();
            } else {
                this.collectResource(target);
            }
        }
    }

    collectResource(target) {
        target.active = false;
        this.state.resources[target.type] += 10;
        this.updateUI();
        this.audio.playSound('collect');
    }

    killWraith(target) {
        target.active = false;
        this.audio.playSound('hit');
        // Chance to drop generic resource
        this.state.resources.digi += 5;
        this.updateUI();
    }

    travel() {
        if (this.state.currentRoom === 'antechamber') {
            // Pick a random dimension
            const types = ['bio', 'digi', 'music', 'dim'];
            const next = types[Math.floor(Math.random() * types.length)];
            this.state.currentRoom = next;
            this.world.generateRoom(next);
            this.audio.setMood(next);
            
            // Show narrative snippet
            this.showNarrative(next);
        } else {
            // Return home
            this.state.currentRoom = 'antechamber';
            this.world.generateRoom('antechamber');
            this.audio.setMood('bio'); // Default
        }
    }

    showNarrative(type) {
        const texts = {
            bio: "The air smells of ozone and jasmine. The walls are breathing.",
            digi: "Static fills your ears. The hieroglyphs shift into binary streams.",
            music: "A low hum vibrates through the floor. The geometry sings.",
            dim: "Gravity feels wrong here. Directions are suggestions, not rules."
        };
        
        const overlay = this.ui.narrative;
        document.getElementById('narrative-title').innerText = "Entering Sector: " + type.toUpperCase();
        document.getElementById('narrative-text').innerText = texts[type];
        document.getElementById('choices').innerHTML = `<button onclick="document.getElementById('narrative-overlay').classList.add('hidden')">Proceed</button>`;
        
        overlay.classList.remove('hidden');
    }

    toggleSynthesis() {
        const menu = this.ui.synthMenu;
        if (!menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            return;
        }

        const list = document.getElementById('recipe-list');
        list.innerHTML = '';

        // Example Recipes
        const recipes = [
            { name: "Heal Structure", cost: { bio: 20 }, action: () => { this.state.health = Math.min(100, this.state.health + 20); } },
            { name: "Decrypt Log", cost: { digi: 30 }, action: () => { alert("Log 001: The Pharoah is not dead, only buffering."); } },
            { name: "Harmonic Tune", cost: { music: 20 }, action: () => { this.state.health += 5; this.audio.playSound('collect'); } },
            { name: "Fold Space", cost: { dim: 50 }, action: () => { alert("Unlocked New Dimension Layer (Placeholder)"); } }
        ];

        recipes.forEach(r => {
            const btn = document.createElement('button');
            btn.className = 'recipe-btn';
            
            let costStr = Object.entries(r.cost).map(([k,v]) => `${k}: ${v}`).join(', ');
            btn.innerText = `${r.name} (${costStr})`;
            
            btn.onclick = () => {
                // Check cost
                let canAfford = true;
                for (let k in r.cost) if (this.state.resources[k] < r.cost[k]) canAfford = false;

                if (canAfford) {
                    for (let k in r.cost) this.state.resources[k] -= r.cost[k];
                    r.action();
                    this.updateUI();
                    this.toggleSynthesis(); // Close menu
                } else {
                    btn.style.borderColor = "red";
                    setTimeout(() => btn.style.borderColor = "#555", 500);
                }
            };
            list.appendChild(btn);
        });

        menu.classList.remove('hidden');
    }

    updateUI() {
        this.ui.bio.innerText = this.state.resources.bio;
        this.ui.digi.innerText = this.state.resources.digi;
        this.ui.music.innerText = this.state.resources.music;
        this.ui.dim.innerText = this.state.resources.dim;
        this.ui.health.style.width = this.state.health + '%';
        
        // Target highlight
        const target = this.world.raycast();
        if (target) {
            this.ui.prompt.classList.remove('hidden');
            this.ui.prompt.innerText = target.active ? `Tap to ${target.type === 'wraith' ? 'Attack' : 'Interact'}` : '';
        } else {
            this.ui.prompt.classList.add('hidden');
        }
    }

    updateLogic(dt) {
        if (!this.state.started) return;
        
        // Spawn more wraiths if in combat rooms
        if (this.state.currentRoom !== 'antechamber' && Math.random() < 0.01) {
             this.world.spawnEnemy();
        }

        // Damage from wraiths
        this.world.entities.forEach(e => {
            if (e.type === 'wraith' && e.active) {
                if (e.mesh.position.distanceTo(this.world.camera.position) < 1.5) {
                    this.state.health -= 0.5;
                    this.ui.health.style.width = this.state.health + '%';
                    if (this.state.health <= 0) {
                        alert("The Pharaoh's dream has ended. Refresh to try again.");
                        this.state.started = false;
                    }
                }
            }
        });
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        
        const now = performance.now();
        const dt = (now - (this.lastTime || now)) / 1000;
        this.lastTime = now;

        this.updateLogic(dt);
        this.world.update(dt, this.input);
        this.world.renderer.render(this.world.scene, this.world.camera);
        this.updateUI(); // Keep raycast prompt updated
    }
}

new Game();