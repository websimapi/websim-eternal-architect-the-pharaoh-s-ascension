import * as THREE from 'three';

export class World {
    constructor(container) {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.03);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        this.entities = []; // { mesh, type, data }
        this.walls = []; 
        this.roomType = 'antechamber'; // antechamber, bio, digi...

        // Lights
        this.ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(this.ambientLight);

        this.pulseLight = new THREE.PointLight(0xd4af37, 1, 20);
        this.pulseLight.position.set(0, 3, 0);
        this.scene.add(this.pulseLight);
        
        // Materials
        this.setupMaterials();

        // Player setup
        this.camera.position.set(0, 1.7, 0);
        this.playerVelocity = new THREE.Vector3();
        this.yaw = new THREE.Euler(0, 0, 0, 'YXZ');
        this.pitch = new THREE.Euler(0, 0, 0, 'YXZ');
        
        // Initial Generation
        this.generateRoom('antechamber');

        // Resize handler
        window.addEventListener('resize', () => this.onResize());
    }

    setupMaterials() {
        const loadTex = (col) => {
             // Create procedural noise texture
             const canvas = document.createElement('canvas');
             canvas.width = 128; canvas.height = 128;
             const ctx = canvas.getContext('2d');
             ctx.fillStyle = col;
             ctx.fillRect(0,0,128,128);
             // Add "runes"
             ctx.strokeStyle = "rgba(255,255,255,0.2)";
             ctx.lineWidth = 2;
             for(let i=0; i<5; i++) {
                 ctx.strokeRect(Math.random()*100, Math.random()*100, Math.random()*30, Math.random()*30);
             }
             const tex = new THREE.CanvasTexture(canvas);
             tex.magFilter = THREE.NearestFilter;
             return tex;
        };

        this.materials = {
            'antechamber': new THREE.MeshStandardMaterial({ map: loadTex('#553311'), roughness: 0.8 }),
            'bio': new THREE.MeshStandardMaterial({ map: loadTex('#113311'), color: 0x4caf50, emissive: 0x002200 }),
            'digi': new THREE.MeshStandardMaterial({ map: loadTex('#002233'), color: 0x00bcd4, wireframe: false }),
            'music': new THREE.MeshStandardMaterial({ map: loadTex('#332200'), color: 0xffc107 }),
            'dim': new THREE.MeshStandardMaterial({ map: loadTex('#220022'), color: 0x9c27b0 }),
            'wraith': new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x550000, transparent: true, opacity: 0.8 }),
            'collectible': new THREE.MeshBasicMaterial({ color: 0xffffff })
        };
    }

    generateRoom(type) {
        this.roomType = type;
        
        // Clear old geometry
        this.walls.forEach(w => this.scene.remove(w));
        this.entities.forEach(e => this.scene.remove(e.mesh));
        this.walls = [];
        this.entities = [];

        // Room Size
        const size = type === 'antechamber' ? 20 : 30;
        const mat = this.materials[type];

        // Floor
        const floorGeo = new THREE.PlaneGeometry(size, size);
        const floor = new THREE.Mesh(floorGeo, mat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        this.walls.push(floor);

        // Ceiling (if not dim)
        if (type !== 'dim') {
            const ceil = new THREE.Mesh(floorGeo, mat);
            ceil.rotation.x = Math.PI / 2;
            ceil.position.y = 8;
            this.scene.add(ceil);
            this.walls.push(ceil);
        }

        // Walls (Procedural blocks)
        const boxGeo = new THREE.BoxGeometry(2, 8, 2);
        const wallCount = 20;
        for(let i=0; i<wallCount; i++) {
            const mesh = new THREE.Mesh(boxGeo, mat);
            const angle = (i / wallCount) * Math.PI * 2;
            const radius = (size / 2) - 1;
            mesh.position.set(Math.cos(angle)*radius, 4, Math.sin(angle)*radius);
            mesh.lookAt(0,4,0);
            this.scene.add(mesh);
            this.walls.push(mesh);
        }

        // Features based on type
        if (type === 'antechamber') {
            // Central Sarcophagus
            const sarcGeo = new THREE.BoxGeometry(2, 1, 4);
            const sarc = new THREE.Mesh(sarcGeo, new THREE.MeshStandardMaterial({color: 0xd4af37}));
            sarc.position.y = 0.5;
            this.scene.add(sarc);
            this.walls.push(sarc);
            this.addEntity('portal', 0, 2, -9, 'Enter Chamber');
        } else {
            // Spawning Resources
            for(let i=0; i<5; i++) {
                this.spawnResource(type);
            }
            // Spawn Enemy Spawners
            this.spawnEnemy();
        }
    }

    addEntity(type, x, y, z, label) {
        let geo, mat;
        if (type === 'portal') {
            geo = new THREE.TorusGeometry(1.5, 0.1, 16, 32);
            mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        } else if (type === 'wraith') {
            geo = new THREE.SphereGeometry(0.5, 16, 16);
            mat = this.materials.wraith;
        } else {
            geo = new THREE.OctahedronGeometry(0.3);
            mat = this.materials.collectible.clone();
            if(type === 'bio') mat.color.setHex(0x4caf50);
            if(type === 'digi') mat.color.setHex(0x00bcd4);
            if(type === 'music') mat.color.setHex(0xffc107);
            if(type === 'dim') mat.color.setHex(0x9c27b0);
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        
        const entity = {
            id: Math.random().toString(36),
            mesh: mesh,
            type: type,
            active: true,
            created: Date.now()
        };
        this.entities.push(entity);
        return entity;
    }

    spawnResource(roomType) {
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        this.addEntity(roomType, x, 1 + Math.random(), z, 'Collect');
    }

    spawnEnemy() {
        const x = (Math.random() - 0.5) * 15;
        const z = (Math.random() - 0.5) * 15;
        this.addEntity('wraith', x, 2, z, 'Attack');
    }

    onBeat(beatCount) {
        // Pulse effects
        const intensity = beatCount % 2 === 0 ? 2 : 0.5;
        this.pulseLight.intensity = intensity;

        // Animate Entities
        this.entities.forEach(ent => {
            if (ent.type === 'wraith') {
                ent.mesh.scale.setScalar(1.2); // Pulse
            }
        });
    }

    update(dt, input, beatTime) {
        // Player Movement
        const speed = 5.0;
        const move = input.getMovement();
        const look = input.getLook();

        // Camera Rotation
        this.yaw.y -= look.x;
        this.pitch.x -= look.y;
        this.pitch.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch.x)); // Clamp vertical
        
        this.camera.quaternion.setFromEuler(this.yaw);
        this.camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(this.pitch));

        // Movement Vector relative to camera yaw
        const direction = new THREE.Vector3(move.x, 0, move.z);
        direction.applyEuler(new THREE.Euler(0, this.yaw.y, 0));
        
        this.camera.position.addScaledVector(direction, speed * dt);

        // Boundaries (Simple Box)
        const limit = this.roomType === 'antechamber' ? 9 : 14;
        this.camera.position.x = Math.max(-limit, Math.min(limit, this.camera.position.x));
        this.camera.position.z = Math.max(-limit, Math.min(limit, this.camera.position.z));

        // Reset look delta
        input.resetLook();

        // Entity Logic
        const time = Date.now() * 0.001;
        
        // Remove inactive
        this.entities = this.entities.filter(e => {
            if (!e.active) {
                this.scene.remove(e.mesh);
                return false;
            }
            return true;
        });

        this.entities.forEach(ent => {
            // Hover animation
            ent.mesh.position.y += Math.sin(time * 2 + ent.mesh.position.x) * 0.005;

            // Wraith Logic (Chase Player)
            if (ent.type === 'wraith') {
                const dir = new THREE.Vector3().subVectors(this.camera.position, ent.mesh.position);
                dir.y = 0;
                dir.normalize();
                ent.mesh.position.addScaledVector(dir, 1.5 * dt); // Slow move
                ent.mesh.scale.lerp(new THREE.Vector3(1,1,1), dt * 5); // Return to normal scale
                
                // Damage player if close
                if (ent.mesh.position.distanceTo(this.camera.position) < 1.0) {
                     // handled in main for state updates
                }
            } else if (ent.type === 'portal') {
                ent.mesh.rotation.y += dt;
                ent.mesh.rotation.x += dt * 0.5;
            }
        });
    }

    // Raycast for interaction
    raycast() {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        const intersects = raycaster.intersectObjects(this.entities.map(e => e.mesh));
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            return this.entities.find(e => e.mesh === obj);
        }
        return null;
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}