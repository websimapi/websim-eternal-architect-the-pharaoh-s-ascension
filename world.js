import * as THREE from 'three';

export class World {
    constructor(container) {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050505, 0.015);
        this.scene.background = new THREE.Color(0x050505);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        this.entities = []; // { mesh, type, data }
        this.colliders = []; // Array of Box3 for static walls
        
        // Lights
        this.ambientLight = new THREE.AmbientLight(0x202020);
        this.scene.add(this.ambientLight);

        this.pulseLight = new THREE.PointLight(0xd4af37, 1, 40);
        this.pulseLight.position.set(0, 5, 0);
        this.scene.add(this.pulseLight);
        
        this.playerBox = new THREE.Box3();
        this.playerRadius = 0.5;

        // Materials
        this.setupMaterials();

        // Player setup
        this.camera.position.set(0, 1.7, 0);
        this.yaw = new THREE.Euler(0, 0, 0, 'YXZ');
        this.pitch = new THREE.Euler(0, 0, 0, 'YXZ');
        
        // Generate World
        this.buildWorld();

        // Resize handler
        window.addEventListener('resize', () => this.onResize());
    }

    setupMaterials() {
        const texLoader = new THREE.TextureLoader();
        const wallTex = texLoader.load('/pyramid_wall.png');
        wallTex.wrapS = THREE.RepeatWrapping;
        wallTex.wrapT = THREE.RepeatWrapping;
        
        const makeMat = (color, emissive, rough = 0.8) => {
            const mat = new THREE.MeshStandardMaterial({ 
                map: wallTex, 
                color: color, 
                roughness: rough,
                emissive: emissive || 0x000000,
                emissiveIntensity: 0.2
            });
            return mat;
        };

        this.materials = {
            'antechamber': makeMat(0xddaa88, 0x221100),
            'bio': makeMat(0x4caf50, 0x002200),
            'digi': makeMat(0x00bcd4, 0x001122),
            'music': makeMat(0xffc107, 0x221100),
            'dim': makeMat(0x663366, 0x110011),
            'floor': new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
            'wraith': new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x550000, transparent: true, opacity: 0.8 }),
            'collectible': new THREE.MeshBasicMaterial({ color: 0xffffff })
        };
    }

    buildWorld() {
        // Clear
        this.colliders = [];

        // Center: Antechamber (0, 0)
        this.createZone(0, 0, 'antechamber', 15, true);
        
        // North: Bio (0, -50)
        this.createZone(0, -50, 'bio', 20);
        this.createCorridor(0, -15, 0, -30, 'antechamber');
        
        // East: Digi (50, 0)
        this.createZone(50, 0, 'digi', 20);
        this.createCorridor(15, 0, 30, 0, 'antechamber');

        // South: Music (0, 50)
        this.createZone(0, 50, 'music', 20);
        this.createCorridor(0, 15, 0, 30, 'antechamber');

        // West: Dim (-50, 0)
        this.createZone(-50, 0, 'dim', 20);
        this.createCorridor(-15, 0, -30, 0, 'antechamber');
    }

    createZone(cx, cz, type, radius, isHub = false) {
        const mat = this.materials[type];
        
        // Floor
        const floorGeo = new THREE.CylinderGeometry(radius, radius, 1, 32);
        const floor = new THREE.Mesh(floorGeo, this.materials.floor);
        floor.position.set(cx, -0.5, cz);
        this.scene.add(floor);

        // Walls Ring (Partial to allow corridors)
        const wallHeight = 8;
        const count = 16;
        const boxGeo = new THREE.BoxGeometry(4, wallHeight, 2);
        
        for(let i=0; i<count; i++) {
            const angle = (i / count) * Math.PI * 2;
            
            // Leave gaps for corridors based on cardinal directions
            const deg = (angle * 180 / Math.PI + 360) % 360;
            // North (270 in standard trig? No, z is down. North is -Z -> 270 deg)
            // Let's just use distance check from cardinal axes
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Skip if near corridor entrances
            if ((Math.abs(x) < 4 && Math.abs(z) > radius - 2) || 
                (Math.abs(z) < 4 && Math.abs(x) > radius - 2)) {
                continue;
            }

            const mesh = new THREE.Mesh(boxGeo, mat);
            mesh.position.set(cx + x, wallHeight/2, cz + z);
            mesh.lookAt(cx, wallHeight/2, cz);
            this.scene.add(mesh);
            
            // Add collider
            const box = new THREE.Box3().setFromObject(mesh);
            this.colliders.push(box);
        }

        // Features
        if (isHub) {
            // Sarcophagus
            const sarc = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 4), new THREE.MeshStandardMaterial({color: 0xd4af37}));
            sarc.position.set(cx, 0.75, cz);
            this.scene.add(sarc);
            this.colliders.push(new THREE.Box3().setFromObject(sarc));
        } else {
            // Spawns
            for(let i=0; i<8; i++) {
                const rx = (Math.random()-0.5) * (radius*1.2);
                const rz = (Math.random()-0.5) * (radius*1.2);
                this.addEntity(type, cx+rx, 1, cz+rz, 'Collect');
            }
            // Enemies
            this.addEntity('wraith', cx, 2, cz, 'Attack');
            this.addEntity('wraith', cx + 5, 2, cz + 5, 'Attack');
        }

        // Add Pillars
        for(let i=0; i<5; i++) {
            const px = cx + (Math.random()-0.5) * (radius);
            const pz = cz + (Math.random()-0.5) * (radius);
            if (Math.abs(px-cx) < 3 && Math.abs(pz-cz) < 3) continue; // Don't block center
            
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8), mat);
            pillar.position.set(px, 3, pz);
            this.scene.add(pillar);
            this.colliders.push(new THREE.Box3().setFromObject(pillar));
        }
    }

    createCorridor(x1, z1, x2, z2, matType) {
        // Simple connecting bridge
        const dist = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
        const midX = (x1+x2)/2;
        const midZ = (z1+z2)/2;
        const angle = Math.atan2(z2-z1, x2-x1);

        const floor = new THREE.Mesh(new THREE.BoxGeometry(dist, 1, 6), this.materials.floor);
        floor.position.set(midX, -0.5, midZ);
        floor.rotation.y = -angle;
        this.scene.add(floor);

        // Walls for corridor?
        // Let's just keep it open air for style
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

    spawnEnemy() {
        // Helper for main.js to spawn random enemy
        // Find player position and spawn nearby but not too close
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 5;
        const x = this.camera.position.x + Math.cos(angle) * dist;
        const z = this.camera.position.z + Math.sin(angle) * dist;
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
        const speed = 6.0;
        const move = input.getMovement();
        const look = input.getLook();

        // Camera Rotation
        this.yaw.y -= look.x;
        this.pitch.x -= look.y;
        this.pitch.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch.x)); // Clamp vertical
        
        this.camera.quaternion.setFromEuler(this.yaw);
        this.camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(this.pitch));

        // Calculate Movement Candidate
        const direction = new THREE.Vector3(move.x, 0, move.z);
        direction.applyEuler(new THREE.Euler(0, this.yaw.y, 0));
        
        const velocity = direction.multiplyScalar(speed * dt);
        
        // Try X Movement
        this.camera.position.x += velocity.x;
        if (this.checkCollision()) {
            this.camera.position.x -= velocity.x; // Revert
        }

        // Try Z Movement
        this.camera.position.z += velocity.z;
        if (this.checkCollision()) {
            this.camera.position.z -= velocity.z; // Revert
        }

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
                
                // Keep wraiths above floor
                ent.mesh.position.y = 2;
            } 
        });
    }

    checkCollision() {
        this.playerBox.setFromCenterAndSize(this.camera.position, new THREE.Vector3(1, 2, 1));
        for (let box of this.colliders) {
            if (this.playerBox.intersectsBox(box)) return true;
        }
        return false;
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