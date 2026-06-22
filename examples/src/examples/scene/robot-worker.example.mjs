// @config
//
// 机器人工作场景仿真 · 鼠标拖拽旋转/滚轮缩放 · 机器人自动完成取放料任务

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

// --- WebAssembly ---
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
    map: new pc.Asset('map', 'container', { url: './assets/scene/robot-worker/sketchMap.glb' }),
    robot: new pc.Asset('robot', 'container', { url: './assets/scene/robot-worker/animation3.glb' }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: './assets/scene/robot-worker/animations/idle.glb' }),
    walkAnim: new pc.Asset('walkAnim', 'container', { url: './assets/scene/robot-worker/animations/walk.glb' }),
    takeAnim: new pc.Asset('takeAnim', 'container', { url: './assets/scene/robot-worker/animations/take.glb' }),
    putAnim: new pc.Asset('putAnim', 'container', { url: './assets/scene/robot-worker/animations/put.glb' }),
    sky: new pc.Asset(
        'sky',
        'texture',
        { url: './assets/scene/robot-worker/skybox/sky.png' },
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
    pc.ScriptComponentSystem, pc.AnimComponentSystem,
    pc.CollisionComponentSystem, pc.RigidBodyComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler,
    pc.AnimClipHandler, pc.AnimStateGraphHandler
];

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

// --- Scene Settings ---
app.scene.exposure = 1;
app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);
app.scene.gammaCorrection = pc.GAMMA_SRGB;
app.scene.skyboxMip = 0;
app.scene.skyboxIntensity = 1;
app.scene.envAtlas = assets.sky.resource;
app.systems.rigidbody?.gravity.set(0, -9.8, 0);

// --- Directional Light ---
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

// --- Factory Scene ---
const mapEntity = assets.map.resource.instantiateRenderEntity({ castShadows: true });
mapEntity.setLocalPosition(0, 0, 0);
app.root.addChild(mapEntity);

// --- Compute Model Bounds ---
const modelBounds = new pc.BoundingBox();
mapEntity.forEach((e) => {
    const r = e.render;
    if (r?.meshInstances) for (const mi of r.meshInstances) modelBounds.add(mi.aabb);
});
const hs = modelBounds.halfExtents;
const c = modelBounds.center;

// --- Static Collision Entities ---
const ground = new pc.Entity('GroundEntity');
ground.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(hs.x, 0.25, hs.z) });
ground.addComponent('rigidbody', { type: 'static' });
ground.setPosition(c.x, c.y - hs.y - 0.25, c.z);
app.root.addChild(ground);

// MachineEntity
const machine = new pc.Entity('MachineEntity');
machine.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(2.3, 1.8, 2.4) });
machine.addComponent('rigidbody', { type: 'static' });
machine.setPosition(-2.35, 1.9, -0.78);
app.root.addChild(machine);

// Cabinet 1
const cabinet1 = new pc.Entity('cabinetEntity1');
cabinet1.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(0.7, 2, 1.4) });
cabinet1.addComponent('rigidbody', { type: 'static' });
cabinet1.setPosition(0.42, 2.01, 4.95);
app.root.addChild(cabinet1);

// Cabinet 2
const cabinet2 = new pc.Entity('cabinetEntity2');
cabinet2.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(0.7, 2, 1.4) });
cabinet2.addComponent('rigidbody', { type: 'static' });
cabinet2.setPosition(-2.74, 1.85, 4.95);
app.root.addChild(cabinet2);

// DetectionEntity
const detection = new pc.Entity('DetectionEntity');
detection.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(0.5, 0.9, 1) });
detection.addComponent('rigidbody', { type: 'static' });
detection.setPosition(-0.84, 0.91, -6.32);
app.root.addChild(detection);

// --- Robot Setup ---
const robotRenderEntity = assets.robot.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });

const robotEntity = new pc.Entity('RobotWorker');
robotEntity.addChild(robotRenderEntity);
robotEntity.setLocalPosition(1.5, 0.06, 0);
robotEntity.setLocalScale(1.5, 1.5, 1.5);
app.root.addChild(robotEntity);

// Anim component
robotEntity.addComponent('anim', { activate: true });

// Create state graph
const animStateGraphData = {
    layers: [
        {
            name: 'base',
            states: [
                { name: 'START' },
                { name: 'Idle', speed: 1 },
                { name: 'Walk', speed: 1 },
                { name: 'Take', speed: 1 },
                { name: 'Put', speed: 1 }
            ],
            transitions: [
                { from: 'START', to: 'Idle', time: 0, priority: 0 },
                { from: 'Idle', to: 'Walk', time: 0.15, priority: 0, conditions: [{ parameterName: 'state', predicate: pc.ANIM_EQUAL_TO, value: 1 }] },
                { from: 'Idle', to: 'Take', time: 0.1, priority: 0, conditions: [{ parameterName: 'state', predicate: pc.ANIM_EQUAL_TO, value: 2 }] },
                { from: 'Idle', to: 'Put', time: 0.1, priority: 0, conditions: [{ parameterName: 'state', predicate: pc.ANIM_EQUAL_TO, value: 3 }] },
                { from: 'Walk', to: 'Idle', time: 0.15, priority: 0, conditions: [{ parameterName: 'state', predicate: pc.ANIM_LESS_THAN_EQUAL_TO, value: 0 }] },
                { from: 'Take', to: 'Idle', time: 0.2, priority: 0, exitTime: 1 },
                { from: 'Put', to: 'Idle', time: 0.2, priority: 0, exitTime: 1 }
            ]
        }
    ],
    parameters: {
        state: { name: 'state', type: pc.ANIM_PARAMETER_INTEGER, value: 0 }
    }
};

robotEntity.anim.loadStateGraph(animStateGraphData);
const baseLayer = robotEntity.anim.baseLayer;
baseLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Take', assets.takeAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Put', assets.putAnim.resource.animations[0].resource);

// --- Robot Path Movement ---
const waypoints = [
    { pos: new pc.Vec3(1.5, 0.06, 0), action: 'idle' },
    { pos: new pc.Vec3(-2.35, 0.06, -0.78), action: 'take' },
    { pos: new pc.Vec3(0.42, 0.06, 4.95), action: 'put' },
    { pos: new pc.Vec3(-2.35, 0.06, -0.78), action: 'take' },
    { pos: new pc.Vec3(-2.74, 0.06, 4.95), action: 'put' },
    { pos: new pc.Vec3(1.5, 0.06, 0), action: 'idle' }
];

let currentWaypoint = 0;
let actionTimer = 0;
const moveSpeed = 0.8;
const arriveDistance = 0.15;
const pauseTime = 2;

const setAnimState = (stateValue) => {
    robotEntity.anim.setInteger('state', stateValue);
};

const moveToNextWaypoint = () => {
    if (currentWaypoint >= waypoints.length) currentWaypoint = 0;
    const wp = waypoints[currentWaypoint];
    const currentPos = robotEntity.getPosition();
    const dx = wp.pos.x - currentPos.x;
    const dz = wp.pos.z - currentPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < arriveDistance) {
        robotEntity.setPosition(wp.pos.x, robotEntity.getPosition().y, wp.pos.z);

        // perform action
        switch (wp.action) {
            case 'take':
                setAnimState(2);
                break;
            case 'put':
                setAnimState(3);
                break;
            case 'idle':
            default:
                setAnimState(0);
                break;
        }
        actionTimer = pauseTime;
        currentWaypoint++;
        return;
    }

    const dir = new pc.Vec3(dx, 0, dz).normalize();
    robotEntity.lookAt(robotEntity.getPosition().clone().add(dir));
    robotEntity.translate(dir.x * moveSpeed * 0.016, 0, dir.z * moveSpeed * 0.016);
    setAnimState(1);
};

// --- Orbit Camera ---
const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    farClip: 200,
    fov: 45,
    clearColor: new pc.Color(0.118, 0.118, 0.118, 1)
});
camera.addComponent('script');
camera.setPosition(16, 12, -0.5);
camera.setLocalEulerAngles(-30, 90, 0);
app.root.addChild(camera);

const cc = camera.script.create(CameraControls);
Object.assign(cc, {
    focusPoint: new pc.Vec3(0, 2, 0),
    distance: 18,
    minDistance: 2,
    maxDistance: 30,
    orbitSensitivity: 0.3,
    zoomSensitivity: 0.15,
    enablePan: false,
    enableFly: false
});

// --- Update Loop ---
app.on('update', (dt) => {
    if (actionTimer > 0) {
        actionTimer -= dt;
        if (actionTimer <= 0) {
            setAnimState(0);
        }
        return;
    }
    moveToNextWaypoint();
});

// Cleanup
app.on('destroy', () => {});
