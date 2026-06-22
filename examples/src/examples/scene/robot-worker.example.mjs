import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

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

await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './assets/scene/robot-worker/echarts.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
});

const assets = {
    map: new pc.Asset('map', 'container', { url: './assets/scene/robot-worker/sketchMap.glb' }),
    robot: new pc.Asset('robot', 'container', { url: './assets/scene/robot-worker/animation3.glb' }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: './assets/scene/robot-worker/animations/idle.glb' }),
    walkAnim: new pc.Asset('walkAnim', 'container', { url: './assets/scene/robot-worker/animations/walk.glb' }),
    takeAnim: new pc.Asset('takeAnim', 'container', { url: './assets/scene/robot-worker/animations/take.glb' }),
    putAnim: new pc.Asset('putAnim', 'container', { url: './assets/scene/robot-worker/animations/put.glb' }),
    sky: new pc.Asset(
        'sky', 'texture',
        { url: './assets/scene/robot-worker/skybox/sky.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const canvas = document.getElementById('application-canvas');
window.focus();
const device = await pc.createGraphicsDevice(canvas, { deviceTypes: [deviceType] });

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.componentSystems = [
    pc.RenderComponentSystem, pc.ModelComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem,
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

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});
app.start();

app.scene.exposure = 1;
app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);
app.scene.gammaCorrection = pc.GAMMA_SRGB;
app.scene.skyboxMip = 0;
app.scene.skyboxIntensity = 1;
app.scene.envAtlas = assets.sky.resource;
app.systems.rigidbody?.gravity.set(0, -9.8, 0);

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

const mapEntity = assets.map.resource.instantiateRenderEntity();
mapEntity.setLocalPosition(0, 0, 0);
app.root.addChild(mapEntity);

const modelBounds = new pc.BoundingBox();
mapEntity.forEach((e) => {
    const r = e.render;
    if (r?.meshInstances) for (const mi of r.meshInstances) modelBounds.add(mi.aabb);
});
const hs = modelBounds.halfExtents;
const c = modelBounds.center;

const ground = new pc.Entity('GroundEntity');
ground.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(hs.x, 0.25, hs.z) });
ground.addComponent('rigidbody', { type: 'static' });
ground.setPosition(c.x, c.y - hs.y - 0.25, c.z);
app.root.addChild(ground);

let leftDoor = null;
let rightDoor = null;
mapEntity.forEach((e) => {
    if (e.name.indexOf('左侧门') !== -1) leftDoor = e;
    if (e.name.indexOf('右侧门') !== -1) rightDoor = e;
});

const doorInitZ = leftDoor ? leftDoor.getLocalPosition().z : -0.860;

const doorLight = new pc.Entity('doorLight');
doorLight.addComponent('light', {
    type: 'spot',
    color: new pc.Color(0.2, 0.6, 1),
    intensity: 2,
    range: 3,
    innerConeAngle: 20,
    outerConeAngle: 40
});
doorLight.setPosition(-0.226, 0.6, -0.86);
doorLight.setLocalEulerAngles(90, 0, 0);
app.root.addChild(doorLight);

let screenEntity = null;
mapEntity.forEach((e) => {
    if (e.name === '屏幕') screenEntity = e;
});

if (screenEntity) {
    const renderComp = screenEntity.render;
    const mi = renderComp?.meshInstances?.[0];
    if (!mi) {
        // Fallback: no mesh instance found
    } else {
        // Clone material to avoid affecting other meshes sharing it
        mi.material = mi.material.clone();

        const mesh = mi.mesh;
        const positions = [];
        mesh.getPositions(positions);

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i], y = positions[i + 1], z = positions[i + 2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        const scrW = maxX - minX;
        const scrH = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        // Create hidden canvas for ECharts
        const chartCanvas = document.createElement('canvas');
        chartCanvas.width = 512;
        chartCanvas.height = 256;
        chartCanvas.style.display = 'none';
        document.body.appendChild(chartCanvas);

        const myChart = window.echarts.init(chartCanvas, null, { renderer: 'canvas' });

        // Chart data
        const chartData = [];
        let lastVal = 50;
        for (let i = 9; i >= 0; i--) {
            lastVal += (Math.random() - 0.5) * 20;
            lastVal = Math.max(0, Math.min(100, lastVal));
            chartData.push({ time: Date.now() - i * 5000, value: lastVal });
        }

        // Create texture using setSource (direct canvas binding)
        const chartTex = new pc.Texture(device, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            autoMipmap: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
        chartTex.setSource(chartCanvas);

        // Create overlay plane as child of the screen node
        const overlay = new pc.Entity('ChartScreenOverlay');
        overlay.addComponent('model', {
            type: 'plane',
            castShadows: false,
            receiveShadows: false
        });
        mi.node.addChild(overlay);
        overlay.setLocalPosition(centerX, centerY, centerZ);
        overlay.setLocalEulerAngles(90, 0, 0);
        overlay.setLocalScale(scrW, 1, scrH);
        overlay.translateLocal(0, 0.01, 0);

        // Hide original mesh
        mi.visible = false;

        // Create material
        const overlayMat = new pc.StandardMaterial();
        overlayMat.name = 'ChartMaterial_ECharts';
        overlayMat.diffuseMap = chartTex;
        overlayMat.diffuse = new pc.Color(1, 1, 1);
        overlayMat.emissiveMap = chartTex;
        overlayMat.emissive = new pc.Color(1, 1, 1);
        overlayMat.useLighting = false;
        overlayMat.cull = pc.CULLFACE_NONE;
        overlayMat.update();

        overlay.model.material = overlayMat;

        // Update chart option
        const updateChartOption = (title) => {
            const fmt = chartData.map((item) => {
                const d = new Date(item.time);
                const h = d.getHours().toString().padStart(2, '0');
                const m = d.getMinutes().toString().padStart(2, '0');
                const s = d.getSeconds().toString().padStart(2, '0');
                return { time: `${h}:${m}:${s}`, value: Number(item.value).toFixed(2) };
            });
            myChart.setOption({
                title: {
                    text: title || '实时数据监控',
                    textStyle: { color: '#fff', fontSize: 14 },
                    left: '10%',
                    top: '20%'
                },
                tooltip: {
                    trigger: 'axis',
                    textStyle: { color: '#fff' },
                    backgroundColor: 'rgba(0,0,0,0.2)'
                },
                xAxis: {
                    type: 'category',
                    data: fmt.map(f => f.time),
                    axisLine: { lineStyle: { color: '#fff' } },
                    axisLabel: { color: '#fff', fontSize: 10, rotate: 45 }
                },
                yAxis: {
                    type: 'value',
                    axisLine: { lineStyle: { color: '#fff' } },
                    axisLabel: { color: '#fff' },
                    splitLine: { show: false }
                },
                series: [{
                    data: fmt.map(f => f.value),
                    type: 'line',
                    smooth: true,
                    lineStyle: { color: '#00ff00' },
                    itemStyle: { color: '#00ff00' }
                }],
                backgroundColor: 'rgba(0,0,0,0.8)',
                grid: { left: '12%', right: '10%', top: '30%', bottom: '35%' },
                animation: true,
                animationDuration: 1000
            }, true);

            chartTex.setSource(chartCanvas);
            chartTex.upload();
        };

        // First render after a short delay
        setTimeout(() => {
            updateChartOption();
        }, 100);

        // Update data every 5 seconds
        let chartTimer = 0;
        // Store reference for update loop
        app.on('update', (dt) => {
            chartTimer += dt;
            if (chartTimer >= 5) {
                chartTimer = 0;
                const last = chartData.length > 0 ? chartData[chartData.length - 1].value : 50;
                let newVal = last + (Math.random() - 0.5) * 20;
                newVal = Math.max(0, Math.min(100, newVal));
                chartData.push({ time: Date.now(), value: newVal });
                if (chartData.length > 10) chartData.shift();
                updateChartOption();
            }
            // Upload every frame for ECharts animation
            chartTex.setSource(chartCanvas);
            chartTex.upload();
        });
    }
}

const robotRenderEntity = assets.robot.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
robotRenderEntity.setLocalScale(0.01, 0.01, 0.01);
robotRenderEntity.setLocalEulerAngles(90, 0, 0);

const billboard = new pc.Entity('Billboard');
const labelPlane = new pc.Entity('labelPlane');
labelPlane.addComponent('render', { type: 'plane' });
labelPlane.setLocalPosition(0, 2.266, 0);
labelPlane.setLocalEulerAngles(90, 90, 0);
labelPlane.setLocalScale(0.5, 0.5, 0.5);
billboard.addChild(labelPlane);

const labelCanvas = document.createElement('canvas');
labelCanvas.width = 256;
labelCanvas.height = 64;
const lctx = labelCanvas.getContext('2d');
const drawLabel = (text) => {
    lctx.clearRect(0, 0, 256, 64);
    lctx.fillStyle = 'rgba(0,0,0,0.6)';
    lctx.roundRect(8, 8, 240, 48, 8);
    lctx.fill();
    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 28px sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText(text, 128, 32);
};
drawLabel('工作中');

const labelTex = new pc.Texture(device, { width: 256, height: 64, format: pc.PIXELFORMAT_RGBA8 });
const updateLabelTex = () => {
    const d = lctx.getImageData(0, 0, 256, 64).data;
    const px = labelTex.lock();
    px.set(d);
    labelTex.unlock();
};
updateLabelTex();

const labelMat = new pc.StandardMaterial();
labelMat.emissiveMap = labelTex;
labelMat.emissive = new pc.Color(1, 1, 1);
labelMat.emissiveIntensity = 1;
labelMat.useLighting = false;
labelMat.blendType = pc.BLEND_NORMAL;
labelMat.opacity = 0.9;
labelMat.update();

if (labelPlane.render?.meshInstances?.length) {
    labelPlane.render.meshInstances[0].material = labelMat;
}

const playerEntity = new pc.Entity('RobotWorker');
playerEntity.addChild(robotRenderEntity);
playerEntity.addChild(billboard);
playerEntity.setLocalPosition(1.5, 0.061, 0);
playerEntity.setLocalScale(1.5, 1.5, 1.5);
app.root.addChild(playerEntity);

playerEntity.addComponent('anim', { activate: true });

const animStateGraphData = {
    layers: [{
        name: 'base',
        states: [
            { name: 'START' },
            { name: 'Idle', speed: 1, loop: true },
            { name: 'Walk', speed: 1, loop: true },
            { name: 'Take', speed: 1, loop: false },
            { name: 'Put', speed: 1, loop: false }
        ],
        transitions: [
            { from: 'START', to: 'Idle', time: 0, priority: 0 },
            { from: 'Idle', to: 'Walk', time: 0.15, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 1 }] },
            { from: 'Idle', to: 'Take', time: 0.1, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 3 }] },
            { from: 'Idle', to: 'Put', time: 0.1, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 4 }] },
            { from: 'Walk', to: 'Idle', time: 0.15, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 2 }] },
            { from: 'Take', to: 'Idle', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 2 }] },
            { from: 'Put', to: 'Idle', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 2 }] }
        ]
    }],
    parameters: {
        playerStatus: { name: 'playerStatus', type: pc.ANIM_PARAMETER_INTEGER, value: 0 }
    }
};

playerEntity.anim.loadStateGraph(animStateGraphData);
const baseLayer = playerEntity.anim.baseLayer;
baseLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Take', assets.takeAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Put', assets.putAnim.resource.animations[0].resource);

const setStatus = v => playerEntity.anim.setInteger('playerStatus', v);

// Path data from original robotPathMove
const path = [
    { label: '去拿料', turn: '', x: 1.8, z: 4.5, lx: 1.8, lz: 5.2 },
    { label: '拿料中', turn: '', x: 1.8, z: 5.2, lx: 1.8, lz: 5.2 },
    { label: '拿料中', turn: '', x: 1.8, z: 5.2, lx: 1.0, lz: 5.2 },
    { label: '拿料中', turn: 'pause', x: 1.8, z: 5.2, lx: 1.0, lz: 5.2 },
    { label: '拿料中', turn: 'take', x: 1.8, z: 5.2, lx: 1.0, lz: 5.2 },
    { label: '去加工', turn: '', x: 1.8, z: -1.1, lx: 1.8, lz: -1.3 },
    { label: '去加工', turn: '', x: 1.8, z: -1, lx: 0.6, lz: -1.3 },
    { label: '加工中', turn: '', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'pause', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'openDoor', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'put', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'pause', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'closeDoor', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '去检测', turn: '', x: 0.6, z: -6.4, lx: 0.6, lz: -6.5 },
    { label: '检测中', turn: '', x: 0.4, z: -6.5, lx: -2, lz: -6.5 },
    { label: '检测中', turn: 'pause', x: 0.4, z: -6.5, lx: -2, lz: -6.5 },
    { label: '合格', turn: 'pause', x: 0.1, z: -6.5, lx: -2, lz: -6.5 },
    { label: '去放料', turn: '', x: 0.4, z: 2.7, lx: 0.4, lz: 2.7 },
    { label: '去放料', turn: '', x: 0.4, z: 2.7, lx: -1, lz: 2.7 },
    { label: '去放料', turn: '', x: -1, z: 2.7, lx: -1, lz: 2.7 },
    { label: '去放料', turn: '', x: -1, z: 2.7, lx: -1.2, lz: 4.5 },
    { label: '去放料', turn: '', x: -1.2, z: 4.5, lx: -1.2, lz: 4.5 },
    { label: '放料中', turn: 'pause', x: -1.2, z: 4.5, lx: -1.3, lz: 4.5 },
    { label: '放料中', turn: 'take', x: -1.2, z: 4.5, lx: -1.3, lz: 4.5 },
    { label: '放料中', turn: '', x: -1.2, z: 4.5, lx: -1.3, lz: 4.5 },
    { label: '去拿料', turn: '', x: -1, z: 2.7, lx: -1, lz: 2.7 },
    { label: '去拿料', turn: '', x: 1.8, z: 2.7, lx: 1.8, lz: 2.7 },
    { label: '去拿料', turn: '', x: 1.8, z: 4.5, lx: 1.8, lz: 4.5 }
];

const ROBOT_Y = 0.061;
const MOVE_SPEED = 0.8;
const ARRIVE_DIST = 0.15;
const PAUSE_TIME = 2;
const SLOW_DOWN_DIST = 0.8;
const TURN_SPEED = 240;
const ROTATE_SHARPNESS = 10;

let pathIdx = 0;
let currentSpeed = 0;
let pauseTimer = 0;
let targetAngle = 0;
let currentAngle = 0;
let doorProgress = 0;
let doorDir = 0;
let takeActionDone = false;

const updateLabelText = (text) => {
    drawLabel(text);
    updateLabelTex();
    if (labelPlane.render?.meshInstances?.length) {
        labelPlane.render.meshInstances[0].material = labelMat;
    }
};

const startCycle = () => {
    pathIdx = 0;
    currentSpeed = 0;
    pauseTimer = 0;
    doorProgress = 0;
    doorDir = 0;
    takeActionDone = false;
    currentAngle = 0;
};

const computeTargetAngle = (fromX, fromZ, toX, toZ) => {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    if (Math.abs(dx) < 0.0001 && Math.abs(dz) < 0.0001) return currentAngle;
    return Math.atan2(dx, dz) * 180 / Math.PI;
};

const applyRotation = (dt) => {
    let delta = targetAngle - currentAngle;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;

    const rotateLerp = 1 - Math.exp(-ROTATE_SHARPNESS * dt);
    const lerped = currentAngle + delta * rotateLerp;
    let limitedDelta = lerped - currentAngle;
    const maxStep = TURN_SPEED * dt;
    if (limitedDelta > maxStep) limitedDelta = maxStep;
    if (limitedDelta < -maxStep) limitedDelta = -maxStep;

    currentAngle += limitedDelta;

    // Apply rotation to the player entity (Y only, preserve X/Z for child model)
    playerEntity.setLocalEulerAngles(0, currentAngle, 0);
};

const updateDoors = (dt) => {
    if (doorDir === 0) return;
    doorProgress += doorDir * dt * 1.5;
    doorProgress = pc.math.clamp(doorProgress, 0, 1);

    if (leftDoor) {
        const p = leftDoor.getLocalPosition();
        leftDoor.setLocalPosition(p.x, p.y, doorInitZ + doorProgress * 0.8);
    }
    if (rightDoor) {
        const p = rightDoor.getLocalPosition();
        rightDoor.setLocalPosition(p.x, p.y, doorInitZ - doorProgress * 0.8);
    }

    doorLight.light.intensity = 2 + doorProgress * 3;
    if (doorProgress >= 1 && doorDir > 0) doorDir = 0;
};

app.on('update', (dt) => {
    updateDoors(dt);

    if (pathIdx >= path.length) {
        setStatus(0);
        updateLabelText('任务完成');
        return;
    }

    let node = path[pathIdx];
    updateLabelText(node.label);

    // Skip consecutive same-position empty turn nodes when already at position
    const pos = playerEntity.getPosition();
    while (node && node.turn === '' && pathIdx + 1 < path.length) {
        const samePoint = Math.abs(node.x - pos.x) <= ARRIVE_DIST && Math.abs(node.z - pos.z) <= ARRIVE_DIST;
        if (!samePoint) break;
        const nextNode = path[pathIdx + 1];
        const sameAsNext = nextNode &&
            Math.abs(node.x - nextNode.x) < 1e-4 &&
            Math.abs(node.z - nextNode.z) < 1e-4 &&
            nextNode.turn === node.turn &&
            nextNode.label === node.label &&
            Math.abs(node.lx - nextNode.lx) < 1e-4 &&
            Math.abs(node.lz - nextNode.lz) < 1e-4;
        if (!sameAsNext) break;
        pathIdx++;
        node = path[pathIdx];
    }

    // Update lookAt target
    targetAngle = computeTargetAngle(pos.x, pos.z, node.lx, node.lz);

    if (node.turn === 'pause') {
        currentSpeed = 0;
        setStatus(0);
        applyRotation(dt);
        pauseTimer += dt;
        if (pauseTimer >= PAUSE_TIME) {
            pauseTimer = 0;
            pathIdx++;
        }
        return;
    }

    if (node.turn === 'take') {
        currentSpeed = 0;
        setStatus(3);
        applyRotation(dt);
        pauseTimer += dt;

        if (!takeActionDone && pauseTimer >= 1.0) {
            takeActionDone = true;
        }

        if (pauseTimer >= 3.0) {
            pauseTimer = 0;
            takeActionDone = false;
            pathIdx++;
        }
        return;
    }

    if (node.turn === 'put') {
        currentSpeed = 0;
        setStatus(4);
        applyRotation(dt);
        pauseTimer += dt;
        if (pauseTimer >= PAUSE_TIME) {
            pauseTimer = 0;
            pathIdx++;
        }
        return;
    }

    if (node.turn === 'openDoor') {
        currentSpeed = 0;
        setStatus(0);
        applyRotation(dt);
        if (doorProgress >= 1 && doorDir === 0) {
            pathIdx++;
        } else {
            doorDir = 1;
        }
        return;
    }

    if (node.turn === 'closeDoor') {
        currentSpeed = 0;
        applyRotation(dt);
        doorDir = -1;
        pathIdx++;
        return;
    }

    // Regular movement
    const dx = node.x - pos.x;
    const dz = node.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= ARRIVE_DIST) {
        const nextNode = path[(pathIdx + 1) % path.length];
        if (!nextNode || nextNode.turn !== '') {
            currentSpeed = 0;
        }
        playerEntity.setPosition(node.x, ROBOT_Y, node.z);
        pathIdx++;
        return;
    }

    setStatus(1);
    const ndx = dx / dist;
    const ndz = dz / dist;

    // Speed with acceleration/deceleration
    const nextNode = path[(pathIdx + 1) % path.length];
    const needsFullStop = !nextNode || nextNode.turn !== '';
    const slowFactor = pc.math.clamp(dist / SLOW_DOWN_DIST, 0, 1);
    const minCornerSpeed = needsFullStop ? 0 : MOVE_SPEED * 0.35;
    const desiredSpeed = dist < SLOW_DOWN_DIST ?
        Math.max(minCornerSpeed, MOVE_SPEED * slowFactor) :
        MOVE_SPEED;

    const speedDiff = desiredSpeed - currentSpeed;
    const accel = speedDiff >= 0 ? 2.2 : 3.2;
    const speedStep = accel * dt;
    if (Math.abs(speedDiff) <= speedStep) {
        currentSpeed = desiredSpeed;
    } else {
        currentSpeed += speedStep * (speedDiff > 0 ? 1 : -1);
    }

    let step = currentSpeed * dt;
    if (step > dist) step = dist;

    playerEntity.setPosition(pos.x + ndx * step, ROBOT_Y, pos.z + ndz * step);
    applyRotation(dt);
});

startCycle();

const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    farClip: 200,
    fov: 45,
    clearColor: new pc.Color(0.118, 0.118, 0.118, 1)
});
camera.addComponent('script');
camera.setPosition(16.27, 12.33, -0.49);
camera.setLocalEulerAngles(-30, 90, 0);
app.root.addChild(camera);

const cc = camera.script.create(CameraControls);
Object.assign(cc, {
    focusPoint: new pc.Vec3(0, 0, 0),
    distance: 18,
    minDistance: 2,
    maxDistance: 30,
    orbitSensitivity: 0.3,
    zoomSensitivity: 0.15,
    enablePan: false,
    enableFly: false
});

app.on('destroy', () => {});
