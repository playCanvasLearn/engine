// @config
//
// 物理AI示例 · WASD + Space + Mouse · 点击底部按钮在脚下触发特效

import * as pc from 'playcanvas';
import { FirstPersonController } from 'playcanvas/scripts/esm/first-person-controller.mjs';

import { deviceType } from 'examples/context';

// --- WebAssembly Modules ---
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
pc.WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await Promise.all([
    new Promise((resolve) => {
        pc.WasmModule.getInstance('DracoDecoderModule', () => resolve());
    }),
    new Promise((resolve) => {
        pc.WasmModule.getInstance('Ammo', () => resolve(true));
    })
]);

// --- Assets ---
const assets = {
    map: new pc.Asset('map', 'container', { url: './assets/scene/models/sketchMap.glb' }),
    spark: new pc.Asset('spark', 'texture', { url: './assets/textures/spark.png' }, { srgb: true }),
    env: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

// --- Graphics Device ---
const canvas = document.getElementById('application-canvas');
window.focus();
const device = await pc.createGraphicsDevice(canvas, { deviceTypes: [deviceType] });

// --- Application ---
const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.componentSystems = [
    pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem,
    pc.ScriptComponentSystem, pc.CollisionComponentSystem, pc.RigidBodyComponentSystem,
    pc.ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

// --- Load Assets & Start ---
await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});
app.start();

// --- Scene ---
app.scene.exposure = 1;
app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);
app.scene.gammaCorrection = pc.GAMMA_SRGB;
app.scene.skyboxMip = 0;
app.scene.envAtlas = assets.env.resource;
app.systems.rigidbody?.gravity.set(0, -9.8, 0);

// Camera
const camera = new pc.Entity('camera');
camera.setLocalPosition(0, 10, 40);
camera.addComponent('camera', {
    farClip: 100,
    fov: 90,
    clearColor: new pc.Color(0.15, 0.15, 0.2)
});

// Post-processing
const cameraFrame = new pc.CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES2;
cameraFrame.bloom.enabled = true;
cameraFrame.bloom.intensity = 0.05;
cameraFrame.update();

// Directional light
const light = new pc.Entity('light');
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowDistance: 16,
    shadowIntensity: 1,
    shadowResolution: 1024,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
light.setPosition(2, 2, -2);
light.setLocalEulerAngles(45, -35, 0);
app.root.addChild(light);

// Map scene
const map = assets.map.resource.instantiateRenderEntity({ castShadows: true });
app.root.addChild(map);

// Compute model bounding box for camera containment
const modelBounds = new pc.BoundingBox();
map.forEach((e) => {
    const r = e.render;
    if (r?.meshInstances) for (const mi of r.meshInstances) modelBounds.add(mi.aabb);
});
const hs = modelBounds.halfExtents;
const c = modelBounds.center;

// First-person character controller
const characterController = new pc.Entity('cc');
characterController.setPosition(c.x, c.y - hs.y + 1.5, c.z);
characterController.addChild(camera);
characterController.addComponent('collision', {
    type: 'capsule',
    radius: 0.5,
    height: 2
});
characterController.addComponent('rigidbody', {
    type: 'dynamic',
    mass: 100,
    linearDamping: 0,
    angularDamping: 0,
    linearFactor: new pc.Vec3(1, 1, 1),
    angularFactor: new pc.Vec3(0, 0, 0),
    friction: 0.5,
    restitution: 0
});
characterController.addComponent('script');
const fpc = characterController.script.create(FirstPersonController, {
    properties: {
        camera,
        jumpForce: 850
    }
});
app.root.addChild(characterController);

// Ground and walls based on model bounds
const ground = new pc.Entity('ground');
ground.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(hs.x, 0.5, hs.z) });
ground.addComponent('rigidbody', { type: 'static' });
ground.setPosition(c.x, c.y - hs.y - 0.5, c.z);
app.root.addChild(ground);

const wallH = hs.y * 2;
const wallT = 0.3;
[
    [c.x, c.z + hs.z, hs.x, wallT],
    [c.x, c.z - hs.z, hs.x, wallT],
    [c.x + hs.x, c.z, wallT, hs.z],
    [c.x - hs.x, c.z, wallT, hs.z]
].forEach(([x, z, hx, hz]) => {
    const w = new pc.Entity('wall');
    w.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(hx, wallH, hz) });
    w.addComponent('rigidbody', { type: 'static' });
    w.setPosition(x, c.y, z);
    app.root.addChild(w);
});

// --- Helper: spawn a particle effect at the player's feet ---
const spawnEffect = (config) => {
    const pos = characterController.getPosition();
    const e = new pc.Entity(config.name);
    app.root.addChild(e);
    e.setPosition(pos.x, pos.y + 0.2, pos.z);

    e.addComponent('particlesystem', {
        numParticles: config.numParticles,
        lifetime: config.lifetime,
        rate: config.rate,
        scaleGraph: config.scaleGraph,
        colorGraph: config.colorGraph,
        colorMap: assets.spark.resource,
        localVelocityGraph: config.localVelocity,
        localVelocityGraph2: config.localVelocity2,
        emitterExtents: config.emitterExtents,
        emitterShape: config.emitterShape ?? pc.EMITTERSHAPE_BOX,
        emitterRadius: config.emitterRadius ?? 0,
        loop: false,
        autoPlay: true
    });

    setTimeout(() => {
        if (e?.destroy) e.destroy();
    }, config.destroyDelay);
};

// --- Spawn Fire Effect ---
const spawnFire = () => {
    spawnEffect({
        name: 'fire',
        numParticles: 80,
        lifetime: 2,
        rate: 0.02,
        scaleGraph: new pc.Curve([0, 0.1, 0.3, 0.4, 0.6, 0.5, 1, 0.3]),
        colorGraph: new pc.CurveSet([
            [0, 1, 0.2, 1, 0.4, 1, 0.6, 0.8, 0.8, 0.3, 1, 0],
            [0, 0.6, 0.2, 0.8, 0.4, 0.6, 0.6, 0.3, 0.8, 0.1, 1, 0],
            [0, 0, 0.2, 0, 0.4, 0, 0.6, 0, 0.8, 0, 1, 0]
        ]),
        localVelocity: new pc.CurveSet([
            [0, 0, 0.5, 0.5, 1, -0.5],
            [0, 2, 0.5, 4, 1, 6],
            [0, 0, 0.5, 0.5, 1, -0.5]
        ]),
        localVelocity2: new pc.CurveSet([
            [0, 0, 0.5, -0.5, 1, 0.5],
            [0, 2, 0.5, 4, 1, 6],
            [0, 0, 0.5, -0.5, 1, 0.5]
        ]),
        emitterExtents: new pc.Vec3(0.3, 0.1, 0.3),
        destroyDelay: 3000
    });
};

// --- Spawn Smoke Effect ---
const spawnSmoke = () => {
    spawnEffect({
        name: 'smoke',
        numParticles: 40,
        lifetime: 3,
        rate: 0.05,
        scaleGraph: new pc.Curve([0, 0.1, 0.3, 0.5, 0.6, 1, 1, 1.5]),
        colorGraph: new pc.CurveSet([
            [0, 0.5, 0.3, 0.5, 0.6, 0.4, 0.8, 0.2, 1, 0],
            [0, 0.5, 0.3, 0.5, 0.6, 0.4, 0.8, 0.2, 1, 0],
            [0, 0.5, 0.3, 0.5, 0.6, 0.4, 0.8, 0.2, 1, 0]
        ]),
        localVelocity: new pc.CurveSet([
            [0, 0, 1, 0.8],
            [0, 1, 1, 3],
            [0, 0, 1, 0.8]
        ]),
        localVelocity2: new pc.CurveSet([
            [0, 0, 1, -0.8],
            [0, 1, 1, 3],
            [0, 0, 1, -0.8]
        ]),
        emitterExtents: new pc.Vec3(0.5, 0.1, 0.5),
        destroyDelay: 5000
    });
};

// --- Spawn Alarm Effect ---
const spawnAlarm = () => {
    const charPos = characterController.getPosition();
    const e = new pc.Entity('alarm');
    app.root.addChild(e);
    e.setPosition(charPos.x, charPos.y + 0.5, charPos.z);

    // Red particle burst in all directions
    e.addComponent('particlesystem', {
        numParticles: 150,
        lifetime: 1.2,
        rate: 0.006,
        scaleGraph: new pc.Curve([0, 0.1, 0.5, 0.4, 1, 0.1]),
        colorGraph: new pc.CurveSet([
            [0, 1, 0.3, 1, 1, 0],
            [0, 0, 0.3, 0.3, 1, 0],
            [0, 0, 0.3, 0, 1, 0]
        ]),
        colorMap: assets.spark.resource,
        localVelocityGraph: new pc.CurveSet([
            [0, 0, 1, 6],
            [0, 4, 1, -4],
            [0, 0, 1, 6]
        ]),
        localVelocityGraph2: new pc.CurveSet([
            [0, 0, 1, -6],
            [0, 4, 1, -4],
            [0, 0, 1, -6]
        ]),
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.1,
        loop: false,
        autoPlay: true
    });

    // Flash a red point light at the alarm position
    const lightEntity = new pc.Entity('alarm-light');
    lightEntity.addComponent('light', {
        type: 'point',
        color: new pc.Color(1, 0, 0),
        intensity: 8,
        range: 8,
        castShadows: false
    });
    lightEntity.setPosition(charPos.x, charPos.y + 1, charPos.z);
    app.root.addChild(lightEntity);

    // Animate the flashing light via update
    let elapsed = 0;
    const onUpdate = (dt) => {
        elapsed += dt;
        const flash = Math.sin(elapsed * 20) * 0.5 + 0.5;
        lightEntity.light.intensity = flash * 8;
        if (elapsed > 2) {
            app.off('update', onUpdate);
            if (lightEntity?.destroy) lightEntity.destroy();
            if (e?.destroy) e.destroy();
        }
    };
    app.on('update', onUpdate);
};

// --- UI ---
const style = document.createElement('style');
style.textContent = `
    #fx-overlay { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); display: flex; gap: 16px; pointer-events: none; z-index: 10; }
    #fx-overlay button { pointer-events: auto; background: rgba(40,40,50,0.85); color: #fff; border: none; border-radius: 50%; width: 64px; height: 64px; font-size: 22px; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.15s; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    #fx-overlay button:hover { transform: scale(1.1); background: rgba(60,60,80,0.9); }
    #fx-overlay button .label { font-size: 10px; opacity: 0.6; }
    #fx-overlay button.fire-btn:hover { background: rgba(200,80,30,0.85); box-shadow: 0 0 20px rgba(255,100,0,0.4); }
    #fx-overlay button.smoke-btn:hover { background: rgba(120,120,130,0.85); box-shadow: 0 0 20px rgba(180,180,180,0.3); }
    #fx-overlay button.alarm-btn:hover { background: rgba(200,30,30,0.85); box-shadow: 0 0 20px rgba(255,0,0,0.4); }
    @media (max-width: 600px) {
        #fx-overlay button { width: 52px; height: 52px; font-size: 18px; }
    }
`;
document.head.appendChild(style);

const overlay = document.createElement('div');
overlay.id = 'fx-overlay';
overlay.innerHTML = `
    <button class="fire-btn" id="btn-fire">🔥<span class="label">火</span></button>
    <button class="smoke-btn" id="btn-smoke">💨<span class="label">烟</span></button>
    <button class="alarm-btn" id="btn-alarm">🚨<span class="label">报警器</span></button>
`;
document.body.appendChild(overlay);

document.getElementById('btn-fire').addEventListener('click', spawnFire);
document.getElementById('btn-smoke').addEventListener('click', spawnSmoke);
document.getElementById('btn-alarm').addEventListener('click', spawnAlarm);

// --- Mobile joystick ---
/**
 * @param {string} side - The side ('left' | 'right').
 * @param {number} baseSize - The base size in px.
 * @param {number} stickSize - The stick size in px.
 */
const createJoystickUI = (side, baseSize = 100, stickSize = 60) => {
    const base = document.createElement('div');
    Object.assign(base.style, {
        display: 'none',
        position: 'absolute',
        width: `${baseSize}px`,
        height: `${baseSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(50, 50, 50, 0.5)',
        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
    });

    const stick = document.createElement('div');
    Object.assign(stick.style, {
        display: 'none',
        position: 'absolute',
        width: `${stickSize}px`,
        height: `${stickSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.5)'
    });

    const show = (el, size, x, y) => {
        el.style.display = 'block';
        el.style.left = `${x - size * 0.5}px`;
        el.style.top = `${y - size * 0.5}px`;
    };

    const hide = (el) => {
        el.style.display = 'none';
    };

    if (fpc) {
        app.on(`${fpc.joystickEventName}:${side}`, (bx, by, sx, sy) => {
            if (bx < 0 || by < 0 || sx < 0 || sy < 0) {
                hide(base);
                hide(stick);
                return;
            }
            show(base, baseSize, bx, by);
            show(stick, stickSize, sx, sy);
        });
    }

    document.body.append(base, stick);
};

createJoystickUI('left');
createJoystickUI('right');

// Cleanup
app.on('destroy', () => {
    overlay.remove();
    style.remove();
});
