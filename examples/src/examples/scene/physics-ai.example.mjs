// @config
//
// 物理AI示例 点击底部按钮在脚下触发特效

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
    idleAnim: new pc.Asset('idleAnim', 'container', { url: './assets/scene/robot-worker/animations/stop.glb' }),
    walkAnim: new pc.Asset('walkAnim', 'container', { url: './assets/scene/robot-worker/animations/walk.glb' }),
    takeAnim: new pc.Asset('takeAnim', 'container', { url: './assets/scene/robot-worker/animations/take.glb' }),
    putAnim: new pc.Asset('putAnim', 'container', { url: './assets/scene/robot-worker/animations/put.glb' }),
    sky: new pc.Asset(
        'sky', 'texture',
        { url: './assets/scene/robot-worker/skybox/sky.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    spark: new pc.Asset('spark', 'texture', { url: './assets/textures/spark.png' }, { srgb: true }),
    snowflake: new pc.Asset('snowflake', 'texture', { url: './assets/textures/snowflake.png' }, { srgb: true }),
    flameAtlas: new pc.Asset('flameAtlas', 'texture', { url: './assets/scene/robot-worker/firefx/explode3.png' }, { srgb: true }),
    waterParticle: new pc.Asset('waterParticle', 'texture', { url: './assets/scene/robot-worker/waterfx/water.png' }, { srgb: true }),
    waterTiles: new pc.Asset('waterTiles', 'texture', { url: './assets/scene/robot-worker/waterfx/tiles.jpg' }, { srgb: true })
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
    pc.CollisionComponentSystem, pc.RigidBodyComponentSystem,
    pc.ParticleSystemComponentSystem
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

const sceneRoot = new pc.Entity('SceneRoot');
app.root.addChild(sceneRoot);

const light = new pc.Entity('Light');
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
sceneRoot.addChild(light);

const mapEntity = assets.map.resource.instantiateRenderEntity();
mapEntity.name = 'sketchMap';
sceneRoot.addChild(mapEntity);

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
sceneRoot.addChild(ground);

let leftDoor = null;
let rightDoor = null;
mapEntity.forEach((e) => {
    if (e.name.indexOf('左侧门') !== -1) leftDoor = e;
    if (e.name.indexOf('右侧门') !== -1) rightDoor = e;
});

const leftDoorInitZ = leftDoor ? leftDoor.getLocalPosition().z : -0.860;
const rightDoorInitZ = rightDoor ? rightDoor.getLocalPosition().z : -0.860;

let screenEntity = null;
mapEntity.forEach((e) => {
    if (e.name === '屏幕') screenEntity = e;
});

let updateChartTitle = null;

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
        updateChartTitle = updateChartOption;

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

const _labelBaseEuler = new pc.Vec3();

const labelPlane = new pc.Entity('labelPlane');
labelPlane.addComponent('render', { type: 'plane' });
labelPlane.setLocalEulerAngles(90, 90, 0);
labelPlane.setLocalScale(0.5, 0.5, 0.5);
_labelBaseEuler.copy(labelPlane.getLocalEulerAngles());
sceneRoot.addChild(labelPlane);

const labelCanvas = document.createElement('canvas');
labelCanvas.width = 256;
labelCanvas.height = 256;
const lctx = labelCanvas.getContext('2d');

const getBgColor = (text) => {
    if (text === '不合格') return 'rgba(220,60,60,0.85)';
    if (text === '合格') return 'rgba(60,180,90,0.85)';
    if (text.indexOf('中') !== -1) return 'rgba(70,130,220,0.85)';
    return 'rgba(0,0,0,0.65)';
};

const drawLabel = (text) => {
    const w = labelCanvas.width;
    const h = labelCanvas.height;
    lctx.clearRect(0, 0, w, h);

    const r = 28;
    lctx.fillStyle = getBgColor(text);
    lctx.beginPath();
    lctx.moveTo(r, 0);
    lctx.arcTo(w, 0, w, h, r);
    lctx.arcTo(w, h, 0, h, r);
    lctx.arcTo(0, h, 0, 0, r);
    lctx.arcTo(0, 0, w, 0, r);
    lctx.closePath();
    lctx.fill();

    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 80px "Microsoft YaHei", Arial';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText(text, w / 2, h / 2);
};

const labelTex = new pc.Texture(device, {
    format: pc.PIXELFORMAT_R8_G8_B8_A8,
    autoMipmap: true
});
labelTex.setSource(labelCanvas);

const labelMat = new pc.StandardMaterial();
labelMat.emissiveMap = labelTex;
labelMat.emissive.set(1, 1, 1);
labelMat.emissiveIntensity = 1;
labelMat.opacityMap = labelTex;
labelMat.opacity = 1;
labelMat.blendType = pc.BLEND_NORMAL;
labelMat.depthWrite = false;
labelMat.cull = pc.CULLFACE_NONE;
labelMat.update();

const labelModel = labelPlane.render || labelPlane.model;
if (labelModel) labelModel.material = labelMat;

const updateLabelText = (text) => {
    drawLabel(text);
    labelTex.setSource(labelCanvas);
    labelTex.upload();
};

updateLabelText('工作中');

const player = new pc.Entity('player');
player.setLocalPosition(1.5, 0.061, 0);
player.setLocalScale(1.5, 1.5, 1.5);
player.addChild(robotRenderEntity);
robotRenderEntity.addComponent('anim', { activate: true });
sceneRoot.addChild(player);

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
            { from: 'Walk', to: 'Take', time: 0.1, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 3 }] },
            { from: 'Walk', to: 'Put', time: 0.1, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 4 }] },
            { from: 'Take', to: 'Idle', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 2 }] },
            { from: 'Take', to: 'Walk', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 1 }] },
            { from: 'Put', to: 'Idle', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 2 }] },
            { from: 'Put', to: 'Walk', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 1 }] }
        ]
    }],
    parameters: {
        playerStatus: { name: 'playerStatus', type: pc.ANIM_PARAMETER_INTEGER, value: 0 }
    }
};

robotRenderEntity.anim.loadStateGraph(animStateGraphData);
const baseLayer = robotRenderEntity.anim.baseLayer;
baseLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Take', assets.takeAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Put', assets.putAnim.resource.animations[0].resource);

let _playerStatus = 0;
const setStatus = (v) => {
    if (_playerStatus === v) return;
    _playerStatus = v;
    robotRenderEntity.anim.setInteger('playerStatus', v);
};

const pickupMaterial = new pc.StandardMaterial();
pickupMaterial.diffuse.set(0.65, 0.65, 0.65);
pickupMaterial.metalness = 0.1;
pickupMaterial.gloss = 0.35;
pickupMaterial.opacity = 1;
pickupMaterial.blendType = pc.BLEND_NORMAL;
pickupMaterial.update();

const pickupItem = new pc.Entity('AutoPickupCylinder');
pickupItem.addComponent('model', { type: 'cylinder', castShadows: true, receiveShadows: true });
pickupItem.model.material = pickupMaterial;
pickupItem.setLocalScale(0.08, 0.12, 0.08);
sceneRoot.addChild(pickupItem);

const PICKUP_HOME_POS = new pc.Vec3();
const PICKUP_DROP_POS = new pc.Vec3();
const pickupLocalScale = pickupItem.getLocalScale().clone();
const pickupLocalPos = new pc.Vec3(0.08, 0.08, 0.02);
const pickupLocalEuler = new pc.Vec3(0, 0, 90);
const grabSocketWorldPos = new pc.Vec3();
const grabSocketWorldRot = new pc.Quat();
const putItemStartPos = new pc.Vec3();
const putItemMidPos = new pc.Vec3();
const putItemEndPos = new pc.Vec3();
const putItemEuler = new pc.Vec3(90, 0, 0);
const PUT_ITEM_RISE_HEIGHT = 0.45;
const PUT_ITEM_MOVE_DISTANCE = 0.9;
const PUT_ITEM_DURATION = 1.8;
const PUT_ITEM_ROTATE_TURNS = 2;

let heldItem = null;
let handBoneNode = null;
let grabSocket = null;
let pickupGlowShell = null;
let pickupGlowMaterial = null;
let pickupGlowTime = 0;
let putItemActive = false;
let putItemTime = 0;

// Exit door FX
let exitDoorTargets = [];
let exitDoorMaterials = [];
const exitDoorCenter = new pc.Vec3();
let exitDoorTime = 0;
let exitDoorMoveAxis = 'x';
let exitSignEntity = null;
let exitSignMaterial = null;
let exitSignTexture = null;
let exitSignCanvas = null;
const exitSignBasePos = new pc.Vec3();
let exitSignHalfWidth = 0.5;
let exitSignHalfHeight = 0.15;
let exitSignPulseTime = 0;
let exitSignClickTime = 0;
let exitDoorClickTime = 0;
let isExitDoorHovered = false;
let exitDoorHoverLerp = 0;
let exitPopupRoot = null;

const collectMeshInstances = (root, out) => {
    if (!root) return;

    const comp = root.render || root.model;
    if (comp?.meshInstances?.length) {
        for (let i = 0; i < comp.meshInstances.length; i++) out.push(comp.meshInstances[i]);
    }

    const children = root.children || [];
    for (let i = 0; i < children.length; i++) collectMeshInstances(children[i], out);
};

const findBoneNodeFromMeshInstances = (meshInstances, keywords) => {
    for (let i = 0; i < meshInstances.length; i++) {
        const bones = meshInstances[i]?.skinInstance?.bones;
        if (!bones?.length) continue;

        for (let j = 0; j < bones.length; j++) {
            const bone = bones[j];
            const name = (bone?.name || '').toLowerCase();
            for (let k = 0; k < keywords.length; k++) {
                if (name.indexOf(keywords[k]) !== -1) return bone;
            }
        }
    }

    return null;
};

const findDescendantByKeywords = (root, keywords) => {
    if (!root) return null;

    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        const name = (node.name || '').toLowerCase();
        for (let i = 0; i < keywords.length; i++) {
            if (name.indexOf(keywords[i]) !== -1) return node;
        }

        const children = node.children || [];
        for (let i = 0; i < children.length; i++) stack.push(children[i]);
    }

    return null;
};

const findHandBoneNode = () => {
    if (handBoneNode) return handBoneNode;

    const meshInstances = [];
    collectMeshInstances(player, meshInstances);

    const leftHandKeywords = ['lefthand', 'left_hand', 'hand_l', 'l hand', 'mixamorig:lefthand', 'bip001 l hand'];
    const rightHandKeywords = ['righthand', 'right_hand', 'hand_r', 'r hand', 'mixamorig:righthand', 'bip001 r hand'];

    handBoneNode =
        findBoneNodeFromMeshInstances(meshInstances, leftHandKeywords) ||
        findBoneNodeFromMeshInstances(meshInstances, rightHandKeywords) ||
        findDescendantByKeywords(player, leftHandKeywords) ||
        findDescendantByKeywords(player, rightHandKeywords) ||
        null;

    return handBoneNode;
};

const updateGrabSocketPose = () => {
    if (!grabSocket) return;

    const handNode = findHandBoneNode();
    if (handNode?.getPosition && handNode?.getRotation) {
        grabSocketWorldPos.copy(handNode.getPosition());
        grabSocketWorldRot.copy(handNode.getRotation());
    } else {
        grabSocketWorldPos.copy(player.getPosition());
        grabSocketWorldRot.copy(player.getRotation());
    }

    grabSocket.setPosition(grabSocketWorldPos);
    grabSocket.setRotation(grabSocketWorldRot);
};

const syncHeldItemPose = () => {
    if (!heldItem) return;

    heldItem.setLocalPosition(pickupLocalPos);
    heldItem.setLocalEulerAngles(pickupLocalEuler);
    heldItem.setLocalScale(pickupLocalScale);
};

const ensurePickupSelectionFx = () => {
    pickupGlowShell = pickupItem.findByName('PickupGlowShell');
    if (!pickupGlowShell) {
        pickupGlowShell = new pc.Entity('PickupGlowShell');
        pickupGlowShell.addComponent('model', { type: 'cylinder', castShadows: false, receiveShadows: false });
        pickupGlowShell.setLocalPosition(0, 0, 0);
        pickupItem.addChild(pickupGlowShell);
    }

    pickupGlowMaterial = pickupGlowShell.model.material;
    if (!pickupGlowMaterial || pickupGlowMaterial.name !== 'PickupGlowMaterial') {
        pickupGlowMaterial = new pc.StandardMaterial();
        pickupGlowMaterial.name = 'PickupGlowMaterial';
        pickupGlowMaterial.diffuse.set(0.15, 0.75, 1);
        pickupGlowMaterial.emissive.set(0.2, 0.85, 1);
        pickupGlowMaterial.emissiveIntensity = 1.6;
        pickupGlowMaterial.opacity = 0.28;
        pickupGlowMaterial.blendType = pc.BLEND_ADDITIVEALPHA;
        pickupGlowMaterial.useLighting = false;
        pickupGlowMaterial.depthWrite = false;
        pickupGlowMaterial.cull = pc.CULLFACE_NONE;
        pickupGlowMaterial.update();
        pickupGlowShell.model.material = pickupGlowMaterial;
    }
};

const setPickupSelectionFxMode = (mode) => {
    if (!pickupGlowMaterial) return;

    if (mode === 'putItem') {
        pickupGlowMaterial.diffuse.set(1, 0.18, 0.12);
        pickupGlowMaterial.emissive.set(1, 0.12, 0.08);
    } else {
        pickupGlowMaterial.diffuse.set(0.15, 0.75, 1);
        pickupGlowMaterial.emissive.set(0.2, 0.85, 1);
    }

    pickupGlowMaterial.update();
};

const setPickupSelectionFxEnabled = (enabled) => {
    if (pickupGlowShell) pickupGlowShell.enabled = !!enabled;
};

const updatePickupSelectionFx = (dt) => {
    if (!pickupGlowShell || !pickupGlowMaterial || !pickupGlowShell.enabled) return;

    pickupGlowTime += dt;
    const pulse = 0.5 + 0.5 * Math.sin(pickupGlowTime * 4.2);
    const scale = 1.35 + pulse * 0.18;
    pickupGlowShell.setLocalScale(scale, 1.08 + pulse * 0.2, scale);
    pickupGlowMaterial.opacity = 0.14 + pulse * 0.14;
    pickupGlowMaterial.emissiveIntensity = 1.2 + pulse * 1.3;
    pickupGlowMaterial.update();
};

const initPickupSystem = () => {
    let pickupNode = null;
    let dropNode = null;

    for (let i = 0; i < path.length; i++) {
        const node = path[i];
        if (!pickupNode && node.turn === 'take' && node.label === '拿料中') pickupNode = node;
        if (!dropNode && node.turn === 'take' && node.label === '放料中') dropNode = node;
    }

    if (pickupNode) {
        PICKUP_HOME_POS.set(pickupNode.lx + 0.1, 0.18, pickupNode.lz + 0.22);
    } else {
        PICKUP_HOME_POS.set(1.1, 0.18, 5.22);
    }

    if (dropNode) {
        PICKUP_DROP_POS.set(dropNode.x - 0.7, PICKUP_HOME_POS.y, dropNode.z + 0.58);
    } else {
        PICKUP_DROP_POS.set(-2.5, PICKUP_HOME_POS.y, 5.08);
    }

    grabSocket = app.root.findByName('GrabSocket_L');
    if (!grabSocket) {
        grabSocket = new pc.Entity('GrabSocket_L');
        sceneRoot.addChild(grabSocket);
    }

    updateGrabSocketPose();
    if (grabSocket) {
        const handRaisedItemY = grabSocket.getPosition().y + pickupLocalPos.y + 0.45;
        PICKUP_HOME_POS.y = handRaisedItemY;
        PICKUP_DROP_POS.y = handRaisedItemY;
    }

    ensurePickupSelectionFx();
    setPickupSelectionFxMode('default');
    setPickupSelectionFxEnabled(true);
};

const resetPickupToHomeState = () => {
    sceneRoot.addChild(pickupItem);
    pickupItem.setPosition(PICKUP_HOME_POS);
    pickupItem.setEulerAngles(90, 0, 0);
    pickupItem.setLocalScale(pickupLocalScale);
    heldItem = null;
    putItemActive = false;
    putItemTime = 0;
    takeActionDone = false;
    pickupGlowTime = 0;
    setPickupSelectionFxMode('default');
    setPickupSelectionFxEnabled(true);
};

const attachPickupItemToRobot = () => {
    if (!grabSocket) return;

    putItemActive = false;
    putItemTime = 0;
    updateGrabSocketPose();
    grabSocket.addChild(pickupItem);
    heldItem = pickupItem;
    setPickupSelectionFxMode('default');
    setPickupSelectionFxEnabled(false);
    syncHeldItemPose();
};

const detachPickupItemToDropZone = () => {
    sceneRoot.addChild(pickupItem);
    pickupItem.setPosition(PICKUP_DROP_POS);
    pickupItem.setEulerAngles(90, 0, 0);
    pickupItem.setLocalScale(pickupLocalScale);
    heldItem = null;
    setPickupSelectionFxMode('default');
    setPickupSelectionFxEnabled(true);
};

const handleTakeAction = (node) => {
    if (node.label === '拿料中' && !heldItem) {
        attachPickupItemToRobot();
    } else if (node.label === '放料中' && heldItem) {
        detachPickupItemToDropZone();
    }
};

const startPutItemAction = () => {
    sceneRoot.addChild(pickupItem);
    putItemStartPos.set(-0.4, 1.8, -0.6);
    putItemMidPos.copy(putItemStartPos);
    putItemMidPos.y += PUT_ITEM_RISE_HEIGHT;
    putItemEndPos.copy(putItemMidPos);
    putItemEndPos.x -= PUT_ITEM_MOVE_DISTANCE;
    pickupItem.setPosition(putItemStartPos);
    pickupItem.setEulerAngles(putItemEuler);
    pickupItem.setLocalScale(pickupLocalScale);
    heldItem = null;
    putItemActive = true;
    putItemTime = 0;
    pickupGlowTime = 0;
    setPickupSelectionFxMode('putItem');
    setPickupSelectionFxEnabled(true);
};

const updatePutItemAction = (dt) => {
    if (!putItemActive) return;

    putItemTime += dt;
    const progress = pc.math.clamp(putItemTime / PUT_ITEM_DURATION, 0, 1);
    const riseRatio = 0.4;
    let eased;
    let x;
    let y;
    let z;

    if (progress < riseRatio) {
        eased = progress / riseRatio;
        eased = eased * eased * (3 - 2 * eased);
        x = pc.math.lerp(putItemStartPos.x, putItemMidPos.x, eased);
        y = pc.math.lerp(putItemStartPos.y, putItemMidPos.y, eased);
        z = pc.math.lerp(putItemStartPos.z, putItemMidPos.z, eased);
    } else {
        eased = (progress - riseRatio) / (1 - riseRatio);
        eased = eased * eased * (3 - 2 * eased);
        x = pc.math.lerp(putItemMidPos.x, putItemEndPos.x, eased);
        y = pc.math.lerp(putItemMidPos.y, putItemEndPos.y, eased);
        z = pc.math.lerp(putItemMidPos.z, putItemEndPos.z, eased);
    }

    pickupItem.setPosition(x, y, z);
    pickupItem.setEulerAngles(
        putItemEuler.x,
        putItemEuler.y + 360 * PUT_ITEM_ROTATE_TURNS * progress,
        putItemEuler.z
    );

    if (progress >= 1) {
        putItemActive = false;
        pickupGlowTime = 0;
        setPickupSelectionFxEnabled(false);
        attachPickupItemToRobot();
    }
};

// ===== Exit Door FX =====
const EXIT_DOOR_OPEN_DIST = 0.18;
const EXIT_DOOR_SPEED = 1.4;

const initExitDoorFx = () => {
    const nameSet = { Mesh_153: true, Mesh_154: true, Mesh_155: true, Mesh_156: true };
    const nodes = [];
    const mis = [];

    app.root.forEach((node) => {
        const comp = node.render || node.model;
        if (!comp?.meshInstances?.length) return;
        for (let i = 0; i < comp.meshInstances.length; i++) {
            const mi = comp.meshInstances[i];
            const nodeName = mi?.node?.name || '';
            const meshName = mi?.mesh?.name || '';
            if (!nameSet[nodeName] && !nameSet[meshName]) continue;
            mis.push(mi);
            if (mi.node && nodes.indexOf(mi.node) === -1) nodes.push(mi.node);
        }
    });

    if (!nodes.length) return;

    exitDoorTargets = [];
    exitDoorMaterials = [];
    exitDoorCenter.set(0, 0, 0);

    let minX = Infinity, maxX = -Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < nodes.length; i++) {
        const wp = nodes[i].getPosition().clone();
        exitDoorCenter.add(wp);
        if (wp.x < minX) minX = wp.x;
        if (wp.x > maxX) maxX = wp.x;
        if (wp.y > maxY) maxY = wp.y;
        if (wp.z < minZ) minZ = wp.z;
        if (wp.z > maxZ) maxZ = wp.z;
    }

    exitDoorCenter.scale(1 / nodes.length);
    exitDoorMoveAxis = (maxX - minX) >= (maxZ - minZ) ? 'x' : 'z';

    for (let i = 0; i < nodes.length; i++) {
        const dn = nodes[i];
        const base = dn.getPosition().clone();
        const delta = exitDoorMoveAxis === 'x' ? base.x - exitDoorCenter.x : base.z - exitDoorCenter.z;
        const sign = delta >= 0 ? 1 : -1;
        exitDoorTargets.push({ node: dn, baseWorldPos: base, sign: sign });
    }

    for (let i = 0; i < mis.length; i++) {
        const mi = mis[i];
        if (!mi?.material?.clone) continue;
        const cloned = mi.material.clone();
        cloned.emissive?.set(0, 1, 0.35);
        if (cloned.emissiveIntensity !== undefined) cloned.emissiveIntensity = 1.2;
        cloned.update?.();
        mi.material = cloned;
        exitDoorMaterials.push(cloned);
    }

    ensureExitSign(maxY, minX, maxX, minZ, maxZ);
    ensureExitPopupUi();
};

const updateExitDoorFx = (dt) => {
    if (!exitDoorTargets.length) return;

    exitDoorTime += dt * EXIT_DOOR_SPEED;
    exitDoorClickTime = Math.max(0, exitDoorClickTime - dt);
    exitDoorHoverLerp += ((isExitDoorHovered ? 1 : 0) - exitDoorHoverLerp) * Math.min(1, dt * 10);

    const pulse = 0.5 + 0.5 * Math.sin(exitDoorTime);
    const openOffset = EXIT_DOOR_OPEN_DIST * pulse;
    const clickBoost = exitDoorClickTime > 0 ? exitDoorClickTime / 0.25 : 0;
    const hoverBoost = exitDoorHoverLerp;
    const emissiveIntensity = 0.55 + pulse * 0.85 + hoverBoost * 2.4 + clickBoost * 0.55;
    const emissiveR = 0 + hoverBoost * 0.30;
    const emissiveG = 0.55 + hoverBoost * 0.45;
    const emissiveB = 0.18 + hoverBoost * 0.50;

    for (let i = 0; i < exitDoorTargets.length; i++) {
        const t = exitDoorTargets[i];
        const b = t.baseWorldPos;
        const x = b.x + (exitDoorMoveAxis === 'x' ? t.sign * openOffset : 0);
        const y = b.y;
        const z = b.z + (exitDoorMoveAxis === 'z' ? t.sign * openOffset : 0);
        t.node.setPosition(x, y, z);
    }

    for (let i = 0; i < exitDoorMaterials.length; i++) {
        exitDoorMaterials[i].emissive.set(emissiveR, emissiveG, emissiveB);
        exitDoorMaterials[i].emissiveIntensity = emissiveIntensity;
        exitDoorMaterials[i].update();
    }

    updateExitSignFx(dt);
};

// ===== EXIT Sign =====
const drawExitSignCanvas = (ctx, width, height) => {
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(4, 22, 10, 0.70)';
    ctx.strokeStyle = 'rgba(53, 255, 148, 0.95)';
    ctx.lineWidth = 12;

    const x = 28, y = 28, w = width - 56, h = height - 56, r = 24;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'rgba(53,255,148,0.85)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(230, 255, 240, 1)';
    ctx.font = 'bold 118px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', width * 0.5, height * 0.54);
    ctx.shadowBlur = 0;
};

const ensureExitSign = (maxY, minX, maxX, minZ, maxZ) => {
    if (exitSignEntity) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    exitSignCanvas = canvas;

    const ctx = canvas.getContext('2d');
    drawExitSignCanvas(ctx, canvas.width, canvas.height);

    const tex = new pc.Texture(device, {
        format: pc.PIXELFORMAT_R8_G8_B8_A8,
        autoMipmap: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    tex.setSource(canvas);
    exitSignTexture = tex;

    const mat = new pc.StandardMaterial();
    mat.name = 'ExitSignMaterial';
    mat.diffuseMap = tex;
    mat.emissiveMap = tex;
    mat.opacityMap = tex;
    mat.opacityMapChannel = 'a';
    mat.diffuse.set(1, 1, 1);
    mat.emissive.set(0.1, 1.0, 0.4);
    mat.emissiveIntensity = 1.3;
    mat.opacity = 1;
    mat.blendType = pc.BLEND_NORMAL;
    mat.useLighting = false;
    mat.depthWrite = false;
    mat.cull = pc.CULLFACE_NONE;
    mat.update();
    exitSignMaterial = mat;

    const sign = new pc.Entity('ExitSign');
    sign.addComponent('model', {
        type: 'plane',
        castShadows: false,
        receiveShadows: false
    });
    sign.model.material = mat;

    const span = exitDoorMoveAxis === 'x' ? (maxX - minX) : (maxZ - minZ);
    const signWidth = Math.max(0.75, span * 0.75);
    const signHeight = 0.24;
    exitSignHalfWidth = signWidth * 0.5;
    exitSignHalfHeight = signHeight * 0.5;

    exitSignBasePos.set(exitDoorCenter.x, maxY + 0.42, exitDoorCenter.z);
    sign.setPosition(exitSignBasePos);
    sign.setEulerAngles(90, 90, 0);
    sign.setLocalScale(signWidth, 1, signHeight);

    sceneRoot.addChild(sign);
    exitSignEntity = sign;
};

const updateExitSignFx = (dt) => {
    if (!exitSignEntity || !exitSignMaterial) return;

    exitSignPulseTime += dt;
    exitSignClickTime = Math.max(0, exitSignClickTime - dt);

    const basePulse = 0.5 + 0.5 * Math.sin(exitSignPulseTime * 2.8);
    const clickBoost = exitSignClickTime > 0 ? exitSignClickTime / 0.25 : 0;
    const scaleBoost = 1 + basePulse * 0.04 + clickBoost * 0.08;

    exitSignEntity.setPosition(exitSignBasePos);
    exitSignEntity.setLocalScale(
        exitSignHalfWidth * 2 * scaleBoost,
        1,
        exitSignHalfHeight * 2 * scaleBoost
    );

    exitSignMaterial.emissiveIntensity = 1.3 + basePulse * 0.8 + clickBoost * 1.6;
    exitSignMaterial.update();

    if (exitSignTexture && exitSignCanvas) {
        exitSignTexture.upload();
    }
};

// ===== Exit Popup UI =====
const ensureExitPopupUi = () => {
    if (exitPopupRoot) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(2, 6, 12, 0.58)';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.zIndex = '10020';

    const panel = document.createElement('div');
    panel.style.cssText = 'width:min(520px,calc(100vw - 32px));border-radius:22px;border:1px solid rgba(58,255,154,0.24);background:linear-gradient(180deg,rgba(13,24,21,0.97),rgba(8,14,17,0.98));box-shadow:0 24px 60px rgba(0,0,0,0.42);padding:22px 22px 18px 22px;color:rgba(235,245,240,0.96);font-family:Arial,sans-serif;backdrop-filter:blur(10px)';

    const title = document.createElement('div');
    title.textContent = '上海机床厂';
    title.style.cssText = 'font-size:22px;font-weight:700;letter-spacing:0.6px;color:rgba(95,255,174,0.98)';

    const desc = document.createElement('div');
    desc.textContent = '上海机床厂始建于 1946 年，是中国大型精密磨床制造企业，在国内磨床行业长期处于领先地位。';
    desc.style.cssText = 'margin-top:14px;font-size:14px;line-height:1.65;color:rgba(235,245,240,0.86)';

    const sectionTitle = document.createElement('div');
    sectionTitle.textContent = '核心产品：';
    sectionTitle.style.cssText = 'margin-top:16px;font-size:15px;font-weight:700;color:rgba(235,245,240,0.96)';

    const productList = document.createElement('div');
    productList.style.cssText = 'margin-top:10px;display:grid;gap:10px';

    const products = ['成型机床', '数控磨床', '重型机床'];
    for (let i = 0; i < products.length; i++) {
        const item = document.createElement('div');
        item.textContent = products[i];
        item.style.cssText = 'padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(235,245,240,0.92);font-size:14px';
        productList.appendChild(item);
    }

    const contact = document.createElement('div');
    contact.style.cssText = 'margin-top:18px;padding:14px 14px;border-radius:14px;background:rgba(58,255,154,0.08);border:1px solid rgba(58,255,154,0.12);line-height:1.75;font-size:14px;color:rgba(235,245,240,0.9)';
    contact.innerHTML =
        '<div style="font-weight:700;color:rgba(95,255,174,0.98);margin-bottom:6px;">总部地址</div>' +
        '<div>上海市杨浦区军工路1146号</div>' +
        '<div>服务热线：021-65494608</div>';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:20px';

    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.textContent = '去购买';
    buyBtn.style.cssText = 'height:40px;min-width:92px;padding:0 16px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;transition:transform 120ms ease,opacity 120ms ease;border:1px solid rgba(58,255,154,0.30);background:linear-gradient(180deg,rgba(58,255,154,0.26),rgba(58,255,154,0.12));color:rgba(228,255,240,0.98)';

    const visitBtn = document.createElement('button');
    visitBtn.type = 'button';
    visitBtn.textContent = '去参观';
    visitBtn.style.cssText = 'height:40px;min-width:92px;padding:0 16px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;transition:transform 120ms ease,opacity 120ms ease;border:1px solid rgba(84,170,255,0.30);background:linear-gradient(180deg,rgba(84,170,255,0.24),rgba(84,170,255,0.10));color:rgba(233,244,255,0.98)';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'height:40px;min-width:92px;padding:0 16px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;transition:transform 120ms ease,opacity 120ms ease;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:rgba(228,255,240,0.88)';

    actions.appendChild(buyBtn);
    actions.appendChild(visitBtn);
    actions.appendChild(cancelBtn);
    panel.appendChild(title);
    panel.appendChild(desc);
    panel.appendChild(sectionTitle);
    panel.appendChild(productList);
    panel.appendChild(contact);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    cancelBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
    buyBtn.addEventListener('click', () => { window.open('https://www.shanghai-electric.com/group/', '_blank'); });
    visitBtn.addEventListener('click', () => { window.open('https://www.shanghai-electric.com/listed/cply/gyzb/znzzzb/index.shtml', '_blank'); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });

    exitPopupRoot = overlay;
};

const showExitPopup = () => {
    if (exitPopupRoot) exitPopupRoot.style.display = 'flex';
};

const isPointerOnExitSign = (camera, screenX, screenY) => {
    if (!exitSignEntity || !camera) return false;
    const center = camera.worldToScreen(exitSignBasePos);
    const rightWorld = exitSignEntity.right.clone().scale(exitSignHalfWidth);
    const upWorld = exitSignEntity.up.clone().scale(exitSignHalfHeight);
    const rightPoint = exitSignBasePos.clone().add(rightWorld);
    const upPoint = exitSignBasePos.clone().add(upWorld);
    const rightScreen = camera.worldToScreen(rightPoint);
    const upScreen = camera.worldToScreen(upPoint);
    const halfWidthPx = Math.max(28, Math.abs(rightScreen.x - center.x) + 12);
    const halfHeightPx = Math.max(16, Math.abs(upScreen.y - center.y) + 10);
    return Math.abs(screenX - center.x) <= halfWidthPx && Math.abs(screenY - center.y) <= halfHeightPx;
};

const isPointerOnExitDoor = (camera, screenX, screenY) => {
    if (!camera || !exitDoorTargets.length) return false;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < exitDoorTargets.length; i++) {
        const screen = camera.worldToScreen(exitDoorTargets[i].node.getPosition());
        if (screen.x < minX) minX = screen.x;
        if (screen.x > maxX) maxX = screen.x;
        if (screen.y < minY) minY = screen.y;
        if (screen.y > maxY) maxY = screen.y;
    }
    const padX = 70, padY = 120;
    return screenX >= minX - padX && screenX <= maxX + padX && screenY >= minY - padY && screenY <= maxY + padY;
};

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
    { label: '加工中', turn: 'putItem', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'pause', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'closeDoor', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '去检测', turn: '', x: 0.6, z: -6.4, lx: 0.6, lz: -6.5 },
    { label: '检测中', turn: '', x: 0.4, z: -6.5, lx: -2, lz: -6.5 },
    { label: '检测中', turn: 'pause', x: 0.4, z: -6.5, lx: -2, lz: -6.5 },
    { label: '不合格', turn: 'pause', x: -0.4, z: -6.5, lx: -2, lz: -6.5 },
    { label: '去加工', turn: '', x: 0.4, z: -0.9, lx: 0.4, lz: -0.9 },
    { label: '加工中', turn: '', x: 0.6, z: -0.9, lx: -2, lz: -0.9 },
    { label: '加工中', turn: 'pause', x: 0.6, z: -0.9, lx: -2, lz: -0.9 },
    { label: '加工中', turn: 'openDoor', x: 0.6, z: -0.9, lx: -2, lz: -0.9 },
    { label: '加工中', turn: 'put', x: 0.6, z: -0.9, lx: -2, lz: -0.9 },
    { label: '加工中', turn: 'putItem', x: 0.6, z: -0.9, lx: 0.2, lz: -0.9 },
    { label: '加工中', turn: 'pause', x: 0.6, z: -0.9, lx: -2, lz: -0.9 },
    { label: '加工中', turn: 'closeDoor', x: 0.6, z: -0.9, lx: -2, lz: -0.9 },
    { label: '去检测', turn: '', x: 0.4, z: -6.4, lx: 0.4, lz: -6.5 },
    { label: '检测中', turn: '', x: 0.4, z: -6.5, lx: -2, lz: -6.5 },
    { label: '检测中', turn: 'pause', x: 0.4, z: -6.5, lx: -2, lz: -6.5 },
    { label: '合格', turn: 'pause', x: 0.1, z: -6.5, lx: -2, lz: -6.5 },
    { label: '去放料', turn: '', x: 0.4, z: 2.7, lx: 0.4, lz: 2.7 },
    { label: '去放料', turn: '', x: 0.4, z: 2.7, lx: -1, lz: 2.7 },
    { label: '去放料', turn: '', x: -1, z: 2.7, lx: -1, lz: 2.7 },
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
let activeActionKey = '';
let lastLabel = '';

const startCycle = () => {
    pathIdx = 0;
    currentSpeed = 0;
    pauseTimer = 0;
    doorProgress = 0;
    doorDir = 0;
    takeActionDone = false;
    activeActionKey = '';
    lastLabel = '';
    currentAngle = 0;
    resetPickupToHomeState();
};

const beginSpecialAction = (node) => {
    const actionKey = `${pathIdx}:${node.turn}`;
    if (activeActionKey === actionKey) return false;

    activeActionKey = actionKey;
    pauseTimer = 0;
    takeActionDone = false;
    return true;
};

const finishSpecialAction = () => {
    pauseTimer = 0;
    takeActionDone = false;
    activeActionKey = '';
    pathIdx++;
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
    player.setLocalEulerAngles(0, currentAngle, 0);
};

const updateDoors = (dt) => {
    if (doorDir === 0) return;
    doorProgress += doorDir * dt * 1.5;
    doorProgress = pc.math.clamp(doorProgress, 0, 1);

    if (leftDoor) {
        const p = leftDoor.getLocalPosition();
        leftDoor.setLocalPosition(p.x, p.y, leftDoorInitZ + doorProgress * 0.8);
    }
    if (rightDoor) {
        const p = rightDoor.getLocalPosition();
        rightDoor.setLocalPosition(p.x, p.y, rightDoorInitZ - doorProgress * 0.8);
    }

    if (doorProgress >= 1 && doorDir > 0) doorDir = 0;
    if (doorProgress <= 0 && doorDir < 0) doorDir = 0;
};

let cameraEntity = null;

// Camera follow temp vectors
const _camForward = new pc.Vec3();
const _camRight = new pc.Vec3();
const _camPos = new pc.Vec3();
const _lookPos = new pc.Vec3();
const _eyePos = new pc.Vec3();
const _tmpOffset = new pc.Vec3();
const _moveDir = new pc.Vec3();

let viewMode = 'fixed';
window.__robotViewMode = viewMode;

const getFacingForwardXZ = () => {
    const facingEntity = player;
    const lookDir = (lookDirCache && lookDirCache.lengthSq && lookDirCache.lengthSq() > 1e-6)
        ? lookDirCache
        : facingEntity.forward;
    _camForward.set(lookDir.x, 0, lookDir.z);
    if (_camForward.lengthSq() < 1e-6) {
        const fb = player.forward;
        _camForward.set(fb.x, 0, fb.z);
    }
    _camForward.normalize();
    return facingEntity;
};

let lookDirCache = new pc.Vec3();

const updateThirdPersonCamera = (p) => {
    _camRight.cross(pc.Vec3.UP, _camForward).normalize();
    const followBack = 6.75;
    const followUp = 4.4;
    const followRight = 0.55;
    const lookAhead = 38.0;
    const lookUp = -3.2;
    _camPos.set(
        p.x - _camForward.x * followBack + _camRight.x * followRight,
        p.y + followUp,
        p.z - _camForward.z * followBack + _camRight.z * followRight
    );
    _lookPos.set(
        p.x + _camForward.x * lookAhead,
        p.y + lookUp,
        p.z + _camForward.z * lookAhead
    );
    cameraEntity.setPosition(_camPos);
    cameraEntity.lookAt(_lookPos);
};

const updateFirstPersonCamera = (p) => {
    _eyePos.set(p.x, p.y + 2.2, p.z);
    _tmpOffset.copy(_camForward).scale(0.25);
    _camPos.copy(_eyePos).add(_tmpOffset);
    _moveDir.set(
        (lookDirCache && lookDirCache.lengthSq && lookDirCache.lengthSq() > 1e-6) ? lookDirCache.x : _camForward.x,
        0,
        (lookDirCache && lookDirCache.lengthSq && lookDirCache.lengthSq() > 1e-6) ? lookDirCache.z : _camForward.z
    ).normalize();
    _tmpOffset.copy(_moveDir).scale(0.2);
    _camPos.add(_tmpOffset);
    _tmpOffset.copy(_camForward).scale(20.0);
    _lookPos.copy(_camPos).add(_tmpOffset);
    _lookPos.y += -1.2;
    cameraEntity.setPosition(_camPos);
    cameraEntity.lookAt(_lookPos);
};

const setViewMode = (mode) => {
    if (mode === viewMode) return;
    viewMode = mode;
    window.__robotViewMode = mode;
    if (cc) cc.enabled = (mode === 'fixed');
    if (mode !== 'first') {
        if (document.pointerLockElement) document.exitPointerLock();
    }
};

const _labelWorldPos = new pc.Vec3();
const _labelCameraPos = new pc.Vec3();
let _labelYaw = 0;

const updateLabelFacing = () => {
    if (!labelPlane || !cameraEntity) return;

    const ppos = player.getPosition();
    labelPlane.setPosition(ppos.x, ppos.y + 3.4, ppos.z);

    if (window.__robotViewMode !== 'third' || !cameraEntity) {
        labelPlane.setLocalEulerAngles(_labelBaseEuler);
        return;
    }

    _labelWorldPos.copy(labelPlane.getPosition());
    _labelCameraPos.copy(cameraEntity.getPosition());
    _labelCameraPos.y = _labelWorldPos.y;

    const dx = _labelCameraPos.x - _labelWorldPos.x;
    const dz = _labelCameraPos.z - _labelWorldPos.z;
    if (Math.abs(dx) <= 1e-4 && Math.abs(dz) <= 1e-4) return;

    _labelYaw = Math.atan2(dx, dz) * 180 / Math.PI;
    labelPlane.setLocalEulerAngles(90, _labelYaw, 0);
};

app.on('update', (dt) => {
    // Always-run systems
    updateDoors(dt);
    updateExitDoorFx(dt);
    updatePutItemAction(dt);
    updatePickupSelectionFx(dt);
    updateGrabSocketPose();
    syncHeldItemPose();

    // Camera follow (third/first person)
    if (viewMode === 'third' || viewMode === 'first') {
        const p = player.getPosition();
        const facingEntity = getFacingForwardXZ();
        if (viewMode === 'third') {
            updateThirdPersonCamera(p);
        } else {
            updateFirstPersonCamera(p);
        }
    }

    // Billboard: make label face camera
    updateLabelFacing();

    if (pathIdx >= path.length) {
        pathIdx = 0;
        startCycle();
    }

    let node = path[pathIdx];
    if (node.label !== lastLabel) {
        lastLabel = node.label;
        updateLabelText(node.label);
        if (updateChartTitle) updateChartTitle(node.label);
    }

    // Skip consecutive same-position empty turn nodes when already at position
    const pos = player.getPosition();
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

    // Cache lookDir for camera follow
    const lookDx = node.lx - pos.x;
    const lookDz = node.lz - pos.z;
    if (Math.abs(lookDx) > 0.0001 || Math.abs(lookDz) > 0.0001) {
        lookDirCache.set(lookDx, 0, lookDz).normalize();
    }

    if (node.turn === 'pause') {
        currentSpeed = 0;
        if (beginSpecialAction(node)) {
            setStatus(2);
        }
        applyRotation(dt);
        pauseTimer += dt;
        if (pauseTimer >= PAUSE_TIME) {
            finishSpecialAction();
        }
        return;
    }

    if (node.turn === 'take') {
        currentSpeed = 0;
        if (beginSpecialAction(node)) {
            setStatus(3);
        }
        applyRotation(dt);
        pauseTimer += dt;

        if (!takeActionDone && pauseTimer >= 2.8) {
            handleTakeAction(node);
            takeActionDone = true;
        }

        if (pauseTimer >= 3.0) {
            finishSpecialAction();
        }
        return;
    }

    if (node.turn === 'put') {
        currentSpeed = 0;
        if (beginSpecialAction(node)) {
            setStatus(4);
        }
        applyRotation(dt);
        pauseTimer += dt;
        if (pauseTimer >= PAUSE_TIME) {
            finishSpecialAction();
        }
        return;
    }

    if (node.turn === 'putItem') {
        currentSpeed = 0;
        setStatus(2);
        applyRotation(dt);
        if (beginSpecialAction(node)) {
            startPutItemAction();
        }
        finishSpecialAction();
        return;
    }

    if (node.turn === 'openDoor') {
        currentSpeed = 0;
        setStatus(2);
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
        setStatus(2);
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
        player.setPosition(node.x, ROBOT_Y, node.z);
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

    player.setPosition(pos.x + ndx * step, ROBOT_Y, pos.z + ndz * step);
    applyRotation(dt);
});

initPickupSystem();
startCycle();
initExitDoorFx();

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
cameraEntity = camera;

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

// Mouse events for exit door/sign interaction
const exitMouseMove = (event) => {
    if (!cameraEntity?.camera) return;
    const cam = cameraEntity.camera;
    const isDoor = isPointerOnExitDoor(cam, event.x, event.y);
    const isSign = isPointerOnExitSign(cam, event.x, event.y);
    isExitDoorHovered = isDoor;
    const canvas = device.canvas;
    if (canvas) canvas.style.cursor = (isDoor || isSign) ? 'pointer' : 'default';
};

const exitMouseDown = (event) => {
    if (!cameraEntity?.camera) return;
    const cam = cameraEntity.camera;
    if (isPointerOnExitSign(cam, event.x, event.y)) {
        exitSignClickTime = 0.25;
        showExitPopup();
        return;
    }
    if (isPointerOnExitDoor(cam, event.x, event.y)) {
        exitDoorClickTime = 0.25;
        showExitPopup();
        return;
    }
};

const debugClickWorldPosition = (event) => {
    if (!cameraEntity?.camera) return;

    const rayStart = cameraEntity.getPosition().clone();
    const rayEnd = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip);
    const hit = app.systems.rigidbody?.raycastFirst(rayStart, rayEnd);

    let worldPoint = null;
    let hitName = 'none';

    if (hit?.point) {
        worldPoint = hit.point;
        hitName = hit.entity?.name || 'unnamed';
    } else {
        const nearPoint = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.nearClip);
        const planeY = ground?.getPosition?.().y ?? 0;
        const dy = rayEnd.y - nearPoint.y;
        if (Math.abs(dy) > 1e-5) {
            const t = (planeY - nearPoint.y) / dy;
            if (t >= 0) {
                worldPoint = nearPoint.lerp(nearPoint, rayEnd, t);
                hitName = 'ground-plane';
            }
        }
    }

    if (!worldPoint) return;

    console.log(
        `[ClickWorld] screen=(${event.x}, ${event.y}) world=(${worldPoint.x.toFixed(3)}, ${worldPoint.y.toFixed(3)}, ${worldPoint.z.toFixed(3)}) hit=${hitName}`
    );
};

app.mouse.on(pc.EVENT_MOUSEMOVE, exitMouseMove);
app.mouse.on(pc.EVENT_MOUSEDOWN, exitMouseDown);
app.mouse.on(pc.EVENT_MOUSEDOWN, debugClickWorldPosition);
// ====== Fire / Smoke / Alarm Effects ======
/**
 * - 左边  z轴 正方向
 * - 里面  x轴 负方向
 * - 上方  Y轴 正方向
 */
const FIRE_AUDIO_URL = './assets/scene/robot-worker/firefx/fire.mp3';
const FIRE_PILE_POSITIONS = [
    new pc.Vec3(1.35, ROBOT_Y + 0.03, 1.28),
    new pc.Vec3(1.35, ROBOT_Y + 0.03, -1.92)
];
const ALARM_BEACON_POSITION = new pc.Vec3(4.35, -1.9, -2.15);
const WATER_LEAK_POSITIONS = [
    new pc.Vec3(-0.35, ROBOT_Y + 0.03, 1.65)
];

const incidentFx = {
    firePiles: [],
    smokePiles: [],
    alarmRoot: null,
    alarmHousing: null,
    beacon: null,
    beaconMaterial: null,
    beaconLight: null,
    alarmAudio: null,
    fireEnabled: false,
    smokeEnabled: false,
    alarmEnabled: false,
    time: 0
};

const waterFx = {
    roots: [],
    leaks: [],
    enabled: false,
    time: 0,
    sprinklerMaterial: null,
    sprinklerAccentMaterial: null,
    sim: {
        supported: false,
        res: 256,
        delta: [1 / 256, 1 / 256],
        clearShader: null,
        dropShader: null,
        updateShader: null,
        normalShader: null,
        normalMapShader: null
    }
};

const createParticleLayer = (parent, name, localPosition, options) => {
    const entity = new pc.Entity(name);
    parent.addChild(entity);
    entity.setLocalPosition(localPosition);
    entity.addComponent('particlesystem', Object.assign({
        autoPlay: true,
        loop: true,
        lighting: false,
        depthWrite: false,
        alignToMotion: false,
        blendType: pc.BLEND_ADDITIVEALPHA
    }, options));
    return entity;
};

const createWindState = (strength, lift = 0) => {
    const state = {
        strength,
        gustStrength: strength * 2.35,
        lift,
        current: new pc.Vec3(),
        from: new pc.Vec3(),
        target: new pc.Vec3(),
        elapsed: 0,
        duration: 0,
        isGusting: false
    };
    return state;
};

const resetWindTarget = (state) => {
    const shouldGust = state.isGusting ? false : Math.random() < 0.32;
    const angle = Math.random() * Math.PI * 2;
    const strength = shouldGust ? state.gustStrength : state.strength;
    const magnitude = shouldGust
        ? strength * (0.85 + Math.random() * 0.75)
        : strength * (0.12 + Math.random() * 0.32);

    state.from.copy(state.current);
    state.target.set(
        Math.cos(angle) * magnitude,
        shouldGust
            ? state.lift * (0.65 + Math.random() * 0.9)
            : state.lift * (0.08 + Math.random() * 0.2),
        Math.sin(angle) * magnitude
    );
    state.elapsed = 0;
    state.duration = shouldGust
        ? 0.45 + Math.random() * 0.95
        : 1.8 + Math.random() * 2.9;
    state.isGusting = shouldGust;
};

const updateWindState = (state, dt) => {
    if (state.duration <= 0) resetWindTarget(state);
    state.elapsed += dt;
    if (state.elapsed >= state.duration) resetWindTarget(state);

    const t = pc.math.clamp(state.elapsed / state.duration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    state.current.set(
        pc.math.lerp(state.from.x, state.target.x, eased),
        pc.math.lerp(state.from.y, state.target.y, eased),
        pc.math.lerp(state.from.z, state.target.z, eased)
    );
    return state.current;
};

const stopAlarmAudio = () => {
    if (!incidentFx.alarmAudio) return;
    incidentFx.alarmAudio.pause();
    incidentFx.alarmAudio.currentTime = 0;
};

const playAlarmAudio = () => {
    if (!incidentFx.alarmAudio) {
        const audio = new Audio(FIRE_AUDIO_URL);
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0.45;
        incidentFx.alarmAudio = audio;
    }

    const playPromise = incidentFx.alarmAudio.play();
    if (playPromise?.catch) {
        playPromise.catch(() => {
            // Ignore autoplay gating until the next user interaction.
        });
    }
};

const updateFxButtons = () => {
    const fireBtn = document.getElementById('btn-fire');
    const smokeBtn = document.getElementById('btn-smoke');
    const alarmBtn = document.getElementById('btn-alarm');
    const waterBtn = document.getElementById('btn-water');
    if (fireBtn) fireBtn.classList.toggle('active', incidentFx.fireEnabled);
    if (smokeBtn) smokeBtn.classList.toggle('active', incidentFx.smokeEnabled);
    if (alarmBtn) alarmBtn.classList.toggle('active', incidentFx.alarmEnabled);
    if (waterBtn) waterBtn.classList.toggle('active', waterFx.enabled);
};

const destroyIncidentRootIfIdle = () => {
    if (incidentFx.fireEnabled || incidentFx.smokeEnabled || incidentFx.alarmEnabled) return;
    stopAlarmAudio();
    for (let i = 0; i < incidentFx.firePiles.length; i++) {
        incidentFx.firePiles[i].root?.destroy?.();
    }
    incidentFx.firePiles.length = 0;
    incidentFx.smokePiles.length = 0;
    incidentFx.time = 0;
};

const createClassicFlamePile = (root) => {
    const flame = createParticleLayer(root, 'ClassicFlame', new pc.Vec3(0, 0.02, 0), {
        numParticles: 90,
        lifetime: 0.55,
        rate: 0.018,
        rate2: 0.024,
        colorMap: assets.spark.resource,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.08,
        emitterRadiusInner: 0.02,
        alignToMotion: true,
        scaleGraph: new pc.Curve([0, 0.16, 0.35, 0.36, 0.8, 0.8, 1, 0.3]),
        alphaGraph: new pc.Curve([0, 0.82, 0.72, 0.38, 1, 0.12]),
        colorGraph: new pc.CurveSet([
            [0, 1, 0.5, 1, 1, 0.05],
            [0, 0.54, 0.5, 0.34, 1, 0],
            [0, 0, 1, 0]
        ]),
        localVelocityGraph: new pc.CurveSet([
            [0, 0.08, 1, 0.08],
            [0, 2.8, 1, 4.9],
            [0, 0.08, 1, 0.08]
        ]),
        localVelocityGraph2: new pc.CurveSet([
            [0, -0.08, 1, -0.08],
            [0, 2.8, 1, 4.9],
            [0, -0.08, 1, -0.08]
        ]),
        radialSpeedGraph: new pc.Curve([0, -4.2]),
        radialSpeedGraph2: new pc.Curve([0, 0.1]),
        depthSoftening: 0.06
    });

    const light = new pc.Entity('ClassicFlameLight');
    light.addComponent('light', {
        type: 'point',
        color: new pc.Color(1, 0.5, 0.18),
        intensity: 5.2,
        range: 5.6,
        castShadows: false
    });
    light.setLocalPosition(0, 0.65, 0);
    light.enabled = false;
    root.addChild(light);

    flame.enabled = false;
    return {
        root,
        type: 'classic',
        primary: flame,
        primaryBasePos: new pc.Vec3(0, 0.02, 0),
        secondary: null,
        embers: null,
        fireLight: light,
        windState: createWindState(0.22, 0.02)
    };
};

const createFireballFlamePile = (root) => {
    const fireCore = createParticleLayer(root, 'FlameCore', new pc.Vec3(0, 0.05, 0), {
        numParticles: 160,
        lifetime: 0.9,
        rate: 0.012,
        rate2: 0.016,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.12,
        emitterRadiusInner: 0.02,
        colorMap: assets.flameAtlas.resource,
        animLoop: true,
        animTilesX: 8,
        animTilesY: 8,
        animNumFrames: 64,
        animSpeed: 1.5,
        scaleGraph: new pc.Curve([0, 0.08, 0.22, 0.34, 0.6, 0.52, 1, 0.08]),
        alphaGraph: new pc.Curve([0, 0, 0.08, 0.85, 0.42, 1, 1, 0]),
        colorGraph: new pc.CurveSet([
            [0, 1, 0.22, 1, 0.55, 0.95, 0.82, 0.5, 1, 0.15],
            [0, 0.95, 0.22, 0.74, 0.55, 0.4, 0.82, 0.18, 1, 0.05],
            [0, 0.55, 0.22, 0.12, 0.55, 0.04, 0.82, 0, 1, 0]
        ]),
        velocityGraph: new pc.CurveSet([
            [0, 0, 0.35, 0.1, 0.7, 0.16, 1, 0.05],
            [0, 0.3, 0.18, 1.4, 0.5, 2.6, 1, 3.8],
            [0, 0, 0.35, -0.1, 0.7, -0.16, 1, -0.05]
        ]),
        velocityGraph2: new pc.CurveSet([
            [0, 0, 0.35, -0.1, 0.7, -0.16, 1, -0.05],
            [0, 0.45, 0.18, 1.8, 0.5, 3.1, 1, 4.3],
            [0, 0, 0.35, 0.1, 0.7, 0.16, 1, 0.05]
        ]),
        depthSoftening: 0.08
    });

    const fireBurst = createParticleLayer(root, 'FlameBurst', new pc.Vec3(0, 0.18, 0), {
        numParticles: 120,
        lifetime: 1.05,
        rate: 0.024,
        rate2: 0.028,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.2,
        emitterRadiusInner: 0.04,
        colorMap: assets.flameAtlas.resource,
        animLoop: true,
        animTilesX: 8,
        animTilesY: 8,
        animNumFrames: 64,
        animSpeed: 1,
        scaleGraph: new pc.Curve([0, 0.04, 0.2, 0.18, 0.55, 0.52, 0.92, 0.1, 1, 0]),
        alphaGraph: new pc.Curve([0, 0, 0.12, 0.5, 0.35, 0.85, 0.72, 0.35, 1, 0]),
        colorGraph: new pc.CurveSet([
            [0, 1, 0.35, 1, 0.72, 0.62, 1, 0.12],
            [0, 0.82, 0.35, 0.45, 0.72, 0.18, 1, 0.04],
            [0, 0.25, 0.35, 0.06, 0.72, 0, 1, 0]
        ]),
        velocityGraph: new pc.CurveSet([
            [0, 0, 0.5, 0.18, 1, 0],
            [0, 0.2, 0.2, 1.2, 0.55, 2.2, 1, 3.2],
            [0, 0, 0.5, -0.18, 1, 0]
        ]),
        velocityGraph2: new pc.CurveSet([
            [0, 0, 0.5, -0.18, 1, 0],
            [0, 0.35, 0.2, 1.7, 0.55, 2.7, 1, 3.6],
            [0, 0, 0.5, 0.18, 1, 0]
        ]),
        depthSoftening: 0.08
    });

    const embers = createParticleLayer(root, 'FireEmbers', new pc.Vec3(0, 0.1, 0), {
        numParticles: 48,
        lifetime: 1.1,
        rate: 0.07,
        rate2: 0.09,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.15,
        colorMap: assets.spark.resource,
        scaleGraph: new pc.Curve([0, 0.03, 0.55, 0.05, 1, 0]),
        alphaGraph: new pc.Curve([0, 0, 0.15, 1, 1, 0]),
        colorGraph: new pc.CurveSet([
            [0, 1, 0.45, 1, 1, 0.3],
            [0, 0.65, 0.45, 0.35, 1, 0.06],
            [0, 0.1, 0.45, 0.02, 1, 0]
        ]),
        localVelocityGraph: new pc.CurveSet([
            [0, -0.35, 1, 0.35],
            [0, 1.6, 0.5, 2.8, 1, 1.2],
            [0, -0.35, 1, 0.35]
        ]),
        localVelocityGraph2: new pc.CurveSet([
            [0, -0.55, 1, 0.55],
            [0, 2.0, 0.5, 3.4, 1, 1.5],
            [0, -0.55, 1, 0.55]
        ]),
        depthSoftening: 0.05
    });

    const light = new pc.Entity('FireballFlameLight');
    light.addComponent('light', {
        type: 'point',
        color: new pc.Color(1, 0.48, 0.16),
        intensity: 6,
        range: 7.5,
        castShadows: false
    });
    light.setLocalPosition(0, 0.7, 0);
    light.enabled = false;
    root.addChild(light);

    fireCore.enabled = false;
    fireBurst.enabled = false;
    embers.enabled = false;
    return {
        root,
        type: 'fireball',
        primary: fireCore,
        primaryBasePos: new pc.Vec3(0, 0.05, 0),
        secondary: fireBurst,
        secondaryBasePos: new pc.Vec3(0, 0.18, 0),
        embers,
        embersBasePos: new pc.Vec3(0, 0.1, 0),
        fireLight: light,
        windState: createWindState(0.28, 0.04)
    };
};

const createSmokePile = (root, heightScale = 1) => {
    const smokeBase = createParticleLayer(root, 'SmokeBase', new pc.Vec3(0, 0.26 * heightScale, 0), {
        numParticles: 120,
        lifetime: 4.2,
        rate: 0.04,
        rate2: 0.045,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.16,
        emitterRadiusInner: 0.04,
        colorMap: assets.snowflake.resource,
        blendType: pc.BLEND_NORMAL,
        scaleGraph: new pc.Curve([0, 0.18, 0.24, 0.55, 0.7, 1.25, 1, 1.8]),
        alphaGraph: new pc.Curve([0, 0, 0.08, 0.1, 0.3, 0.35, 0.7, 0.2, 1, 0]),
        colorGraph: new pc.CurveSet([
            [0, 0.16, 0.3, 0.21, 0.7, 0.42, 1, 0.6],
            [0, 0.16, 0.3, 0.21, 0.7, 0.42, 1, 0.6],
            [0, 0.16, 0.3, 0.21, 0.7, 0.42, 1, 0.6]
        ]),
        localVelocityGraph: new pc.CurveSet([
            [0, -0.2, 0.5, 0.25, 1, 0.45],
            [0, 0.55, 0.45, 1.65, 1, 2.35],
            [0, -0.2, 0.5, 0.25, 1, 0.45]
        ]),
        localVelocityGraph2: new pc.CurveSet([
            [0, -0.45, 0.5, -0.1, 1, 0.2],
            [0, 0.85, 0.45, 2.1, 1, 2.9],
            [0, -0.45, 0.5, -0.1, 1, 0.2]
        ]),
        depthSoftening: 0.12
    });

    const smokePlume = createParticleLayer(root, 'SmokePlume', new pc.Vec3(0, 0.55 * heightScale, 0), {
        numParticles: 90,
        lifetime: 5.6,
        rate: 0.07,
        rate2: 0.08,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: 0.3,
        colorMap: assets.snowflake.resource,
        blendType: pc.BLEND_NORMAL,
        scaleGraph: new pc.Curve([0, 0.35, 0.35, 0.95, 0.75, 2.2, 1, 2.9]),
        alphaGraph: new pc.Curve([0, 0, 0.12, 0.08, 0.35, 0.24, 0.82, 0.12, 1, 0]),
        colorGraph: new pc.CurveSet([
            [0, 0.3, 0.25, 0.36, 0.7, 0.58, 1, 0.72],
            [0, 0.3, 0.25, 0.36, 0.7, 0.58, 1, 0.72],
            [0, 0.3, 0.25, 0.36, 0.7, 0.58, 1, 0.72]
        ]),
        localVelocityGraph: new pc.CurveSet([
            [0, -0.32, 0.5, 0.12, 1, 0.58],
            [0, 0.7, 0.45, 1.7, 1, 2.6],
            [0, -0.32, 0.5, 0.12, 1, 0.58]
        ]),
        localVelocityGraph2: new pc.CurveSet([
            [0, -0.6, 0.5, -0.12, 1, 0.32],
            [0, 1.0, 0.45, 2.25, 1, 3.05],
            [0, -0.6, 0.5, -0.12, 1, 0.32]
        ]),
        depthSoftening: 0.16
    });

    smokeBase.enabled = false;
    smokePlume.enabled = false;
    return {
        smokeBase,
        smokeBasePos: new pc.Vec3(0, 0.26 * heightScale, 0),
        smokePlume,
        smokePlumePos: new pc.Vec3(0, 0.55 * heightScale, 0),
        windState: createWindState(0.45 * heightScale, 0.08 * heightScale)
    };
};

const initWaterSimIfNeeded = () => {
    if (waterFx.sim.clearShader) return;

    waterFx.sim.supported = !device.isWebGPU;
    if (!waterFx.sim.supported) return;

    const glslHeader = 'precision highp float;\\n';

    waterFx.sim.clearShader = pc.ShaderUtils.createShader(device, {
        uniqueName: 'WaterSimClear',
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexChunk: 'quadVS',
        fragmentGLSL: `${glslHeader}varying vec2 uv0;\\nvoid main() { gl_FragColor = vec4(0.0); }`
    });

    waterFx.sim.updateShader = pc.ShaderUtils.createShader(device, {
        uniqueName: 'WaterSimUpdate',
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexChunk: 'quadVS',
        fragmentGLSL: /* glsl */ `
            precision highp float;
            uniform sampler2D sourceTexture;
            uniform vec2 delta;
            varying vec2 uv0;

            void main() {
                vec4 info = texture2D(sourceTexture, uv0);
                vec2 dx = vec2(delta.x, 0.0);
                vec2 dy = vec2(0.0, delta.y);
                float average = (
                    texture2D(sourceTexture, uv0 - dx).r +
                    texture2D(sourceTexture, uv0 - dy).r +
                    texture2D(sourceTexture, uv0 + dx).r +
                    texture2D(sourceTexture, uv0 + dy).r
                ) * 0.25;
                info.g += (average - info.r) * 2.0;
                info.g *= 0.995;
                info.r += info.g;
                gl_FragColor = info;
            }
        `
    });

    waterFx.sim.dropShader = pc.ShaderUtils.createShader(device, {
        uniqueName: 'WaterSimDrop',
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexChunk: 'quadVS',
        fragmentGLSL: /* glsl */ `
            precision highp float;
            const float PI = 3.141592653589793;
            uniform sampler2D sourceTexture;
            uniform vec2 centerUv;
            uniform float radius;
            uniform float strength;
            varying vec2 uv0;

            void main() {
                vec4 info = texture2D(sourceTexture, uv0);
                float drop = max(0.0, 1.0 - length(centerUv - uv0) / radius);
                drop = 0.5 - cos(drop * PI) * 0.5;
                info.r += drop * strength;
                gl_FragColor = info;
            }
        `
    });

    waterFx.sim.normalShader = pc.ShaderUtils.createShader(device, {
        uniqueName: 'WaterSimNormals',
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexChunk: 'quadVS',
        fragmentGLSL: /* glsl */ `
            precision highp float;
            uniform sampler2D sourceTexture;
            uniform vec2 delta;
            varying vec2 uv0;

            void main() {
                vec4 info = texture2D(sourceTexture, uv0);
                vec3 dx = vec3(delta.x, texture2D(sourceTexture, vec2(uv0.x + delta.x, uv0.y)).r - info.r, 0.0);
                vec3 dy = vec3(0.0, texture2D(sourceTexture, vec2(uv0.x, uv0.y + delta.y)).r - info.r, delta.y);
                info.ba = normalize(cross(dy, dx)).xz;
                gl_FragColor = info;
            }
        `
    });

    waterFx.sim.normalMapShader = pc.ShaderUtils.createShader(device, {
        uniqueName: 'WaterSimNormalMap',
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexChunk: 'quadVS',
        fragmentGLSL: /* glsl */ `
            precision highp float;
            uniform sampler2D sourceTexture;
            varying vec2 uv0;

            void main() {
                vec4 info = texture2D(sourceTexture, uv0);
                vec3 n = normalize(vec3(info.b, sqrt(max(0.0001, 1.0 - info.b * info.b - info.a * info.a)), info.a));
                gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
            }
        `
    });
};

const createWaterSimTargets = () => {
    const res = waterFx.sim.res;
    const createSimTexture = (name) => {
        const formatsToTry = [pc.PIXELFORMAT_RGBA16F, pc.PIXELFORMAT_RGBA32F, pc.PIXELFORMAT_RGBA8];
        for (let i = 0; i < formatsToTry.length; i++) {
            const format = formatsToTry[i];
            try {
                return new pc.Texture(device, {
                    name,
                    width: res,
                    height: res,
                    mipmaps: false,
                    format,
                    minFilter: pc.FILTER_LINEAR,
                    magFilter: pc.FILTER_LINEAR,
                    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                    addressV: pc.ADDRESS_CLAMP_TO_EDGE
                });
            } catch (e) {
            }
        }
        return new pc.Texture(device, {
            name,
            width: res,
            height: res,
            mipmaps: false,
            format: pc.PIXELFORMAT_RGBA8,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
    };

    const texA = createSimTexture('WaterSimA');
    const texB = createSimTexture('WaterSimB');
    const rtA = new pc.RenderTarget({ colorBuffer: texA, depth: false, flipY: !device.isWebGPU });
    const rtB = new pc.RenderTarget({ colorBuffer: texB, depth: false, flipY: !device.isWebGPU });

    const normalMapTex = new pc.Texture(device, {
        name: 'WaterNormalMap',
        width: res,
        height: res,
        mipmaps: false,
        format: pc.PIXELFORMAT_RGBA8,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    const normalMapRt = new pc.RenderTarget({ colorBuffer: normalMapTex, depth: false, flipY: !device.isWebGPU });

    pc.drawQuadWithShader(device, rtA, waterFx.sim.clearShader);
    pc.drawQuadWithShader(device, rtB, waterFx.sim.clearShader);
    pc.drawQuadWithShader(device, normalMapRt, waterFx.sim.clearShader);

    return {
        simRts: [rtA, rtB],
        simIndex: 0,
        normalMapRt,
        normalMapTex
    };
};

const waterSimSwap = (leak) => {
    leak.simIndex = 1 - leak.simIndex;
};

const waterSimSource = (leak) => leak.simRts[leak.simIndex].colorBuffer;
const waterSimTarget = (leak) => leak.simRts[1 - leak.simIndex];

const waterSimPass = (leak, shader) => {
    device.scope.resolve('sourceTexture').setValue(waterSimSource(leak));
    device.scope.resolve('delta').setValue(waterFx.sim.delta);
    pc.drawQuadWithShader(device, waterSimTarget(leak), shader);
    waterSimSwap(leak);
};

const waterSimDrop = (leak, centerUvX, centerUvY, radius, strength) => {
    device.scope.resolve('sourceTexture').setValue(waterSimSource(leak));
    device.scope.resolve('centerUv').setValue([centerUvX, centerUvY]);
    device.scope.resolve('radius').setValue(radius);
    device.scope.resolve('strength').setValue(strength);
    pc.drawQuadWithShader(device, waterSimTarget(leak), waterFx.sim.dropShader);
    waterSimSwap(leak);
};

const createIrregularPoolMesh = (radius = 1, vertexCount = 64) => {
    const count = Math.max(24, Math.min(96, Math.floor(vertexCount)));
    const positions = new Float32Array((count + 1) * 3);
    const normals = new Float32Array((count + 1) * 3);
    const uvs = new Float32Array((count + 1) * 2);
    const indices = new Uint32Array(count * 3);

    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;
    normals[0] = 0;
    normals[1] = 1;
    normals[2] = 0;
    uvs[0] = 0.5;
    uvs[1] = 0.5;

    const angleOffset = Math.random() * Math.PI * 2;
    const radiusX = radius * (0.92 + Math.random() * 0.38);
    const radiusZ = radius * (0.82 + Math.random() * 0.48);
    const phase1 = Math.random() * Math.PI * 2;
    const phase2 = Math.random() * Math.PI * 2;
    const phase3 = Math.random() * Math.PI * 2;

    const baseR = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const t = i / count;
        const a = angleOffset + t * Math.PI * 2;
        const n = 1
            + 0.08 * Math.sin(a * 2 + phase1)
            + 0.04 * Math.sin(a * 5 + phase2)
            + 0.03 * Math.sin(a * 9 + phase3);
        baseR[i] = Math.max(0.65, n);
    }

    for (let pass = 0; pass < 3; pass++) {
        const tmp = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const a = baseR[(i - 1 + count) % count];
            const b = baseR[i];
            const c = baseR[(i + 1) % count];
            tmp[i] = (a + b + c) / 3;
        }
        baseR.set(tmp);
    }

    for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = angleOffset + t * Math.PI * 2;
        const r = baseR[i];
        const x = Math.cos(angle) * radiusX * r;
        const z = Math.sin(angle) * radiusZ * r;

        const vi = (i + 1) * 3;
        positions[vi + 0] = x;
        positions[vi + 1] = 0;
        positions[vi + 2] = z;

        normals[vi + 0] = 0;
        normals[vi + 1] = 1;
        normals[vi + 2] = 0;

        const ui = (i + 1) * 2;
        uvs[ui + 0] = x / (radiusX * 2) + 0.5;
        uvs[ui + 1] = z / (radiusZ * 2) + 0.5;

        const ii = i * 3;
        indices[ii + 0] = 0;
        indices[ii + 1] = i + 1;
        indices[ii + 2] = ((i + 1) % count) + 1;
    }

    const mesh = new pc.Mesh(device);
    mesh.clear(true, false);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(radiusX * 1.35, 0.05, radiusZ * 1.35));

    return mesh;
};

const ensureWaterLeaks = () => {
    if (waterFx.roots.length) return;

    initWaterSimIfNeeded();

    if (!waterFx.sprinklerMaterial) {
        const mat = new pc.StandardMaterial();
        mat.diffuse.set(0.55, 0.58, 0.62);
        mat.specular.set(0.9, 0.9, 0.9);
        mat.gloss = 0.92;
        mat.metalness = 0.75;
        mat.useMetalness = true;
        mat.update();
        waterFx.sprinklerMaterial = mat;
    }
    if (!waterFx.sprinklerAccentMaterial) {
        const mat = new pc.StandardMaterial();
        mat.diffuse.set(0.42, 0.05, 0.05);
        mat.emissive.set(0.65, 0.08, 0.08);
        mat.emissiveIntensity = 0.7;
        mat.useLighting = false;
        mat.update();
        waterFx.sprinklerAccentMaterial = mat;
    }

    for (let i = 0; i < WATER_LEAK_POSITIONS.length; i++) {
        const root = new pc.Entity(`WaterLeakRoot_${i}`);
        root.setPosition(WATER_LEAK_POSITIONS[i]);
        sceneRoot.addChild(root);
        waterFx.roots.push(root);

        const sprinkler = new pc.Entity(`SprinklerHead_${i}`);
        sprinkler.setLocalPosition(0, 3.2, 0);
        root.addChild(sprinkler);

        const pipe = new pc.Entity(`SprinklerPipe_${i}`);
        pipe.addComponent('render', { type: 'cylinder', castShadows: false, receiveShadows: false });
        pipe.setLocalScale(0.06, 0.22, 0.06);
        pipe.setLocalPosition(0, 0.16, 0);
        pipe.render.material = waterFx.sprinklerMaterial;
        sprinkler.addChild(pipe);

        const body = new pc.Entity(`SprinklerBody_${i}`);
        body.addComponent('render', { type: 'cylinder', castShadows: false, receiveShadows: false });
        body.setLocalScale(0.16, 0.08, 0.16);
        body.setLocalPosition(0, 0.03, 0);
        body.render.material = waterFx.sprinklerMaterial;
        sprinkler.addChild(body);

        const ring = new pc.Entity(`SprinklerRing_${i}`);
        ring.addComponent('render', { type: 'cylinder', castShadows: false, receiveShadows: false });
        ring.setLocalScale(0.18, 0.015, 0.18);
        ring.setLocalPosition(0, -0.03, 0);
        ring.render.material = waterFx.sprinklerAccentMaterial;
        sprinkler.addChild(ring);

        const deflector = new pc.Entity(`SprinklerDeflector_${i}`);
        deflector.addComponent('render', { type: 'cone', castShadows: false, receiveShadows: false });
        deflector.setLocalScale(0.16, 0.06, 0.16);
        deflector.setLocalPosition(0, -0.08, 0);
        deflector.setLocalEulerAngles(180, 0, 0);
        deflector.render.material = waterFx.sprinklerMaterial;
        sprinkler.addChild(deflector);

        const jet = createParticleLayer(root, `WaterJet_${i}`, new pc.Vec3(0, 3.2, 0), {
            numParticles: 1400,
            lifetime: 0.3,
            rate: 0.0018,
            rate2: 0.0024,
            colorMap: assets.waterParticle.resource,
            blendType: pc.BLEND_NORMAL,
            emitterShape: pc.EMITTERSHAPE_SPHERE,
            emitterRadius: 0.65,
            emitterRadiusInner: 0.15,
            scaleGraph: new pc.Curve([0, 0.02, 0.55, 0.018, 1, 0.012]),
            alphaGraph: new pc.Curve([0, 0, 0.2, 0.26, 0.75, 0.22, 1, 0]),
            colorGraph: new pc.CurveSet([
                [0, 0.72, 1, 0.72],
                [0, 0.9, 1, 0.9],
                [0, 1, 1, 1]
            ]),
            localVelocityGraph: new pc.CurveSet([
                [0, -0.45, 1, 0.45],
                [0, -9.5, 1, -12.2],
                [0, -0.45, 1, 0.45]
            ]),
            localVelocityGraph2: new pc.CurveSet([
                [0, -0.7, 1, 0.7],
                [0, -10.2, 1, -13.2],
                [0, -0.7, 1, 0.7]
            ]),
            depthSoftening: 0.14,
            alignToMotion: true
        });
        jet.enabled = false;

        const splash = createParticleLayer(root, `WaterSplash_${i}`, new pc.Vec3(0, 0.02, 0), {
            numParticles: 420,
            lifetime: 0.8,
            rate: 0.009,
            rate2: 0.014,
            colorMap: assets.waterParticle.resource,
            blendType: pc.BLEND_NORMAL,
            emitterShape: pc.EMITTERSHAPE_SPHERE,
            emitterRadius: 0.32,
            scaleGraph: new pc.Curve([0, 0.05, 0.55, 0.06, 1, 0]),
            alphaGraph: new pc.Curve([0, 0, 0.2, 0.3, 0.7, 0.14, 1, 0]),
            colorGraph: new pc.CurveSet([
                [0, 0.72, 1, 0.72],
                [0, 0.9, 1, 0.9],
                [0, 1, 1, 1]
            ]),
            localVelocityGraph: new pc.CurveSet([
                [0, -1.2, 1, 1.2],
                [0, 2.0, 0.45, 4.2, 1, 0.4],
                [0, -1.2, 1, 1.2]
            ]),
            localVelocityGraph2: new pc.CurveSet([
                [0, -1.6, 1, 1.6],
                [0, 2.5, 0.45, 5.0, 1, 0.5],
                [0, -1.6, 1, 1.6]
            ]),
            depthSoftening: 0.12
        });
        splash.enabled = false;

        const poolMesh = createIrregularPoolMesh(1, 72);
        const pool = new pc.Entity(`WaterPool_${i}`);
        pool.setLocalPosition(0, 0.02, 0);
        pool.setLocalScale(0.5, 1, 0.5);
        root.addChild(pool);

        const poolMat = new pc.StandardMaterial();
        poolMat.diffuse.set(0.06, 0.18, 0.22);
        poolMat.specular.set(0.8, 0.85, 0.9);
        poolMat.gloss = 0.92;
        poolMat.metalness = 0;
        poolMat.emissive.set(0.02, 0.07, 0.08);
        poolMat.emissiveIntensity = 0.25;
        poolMat.opacity = 0.35;
        poolMat.blendType = pc.BLEND_NORMAL;
        poolMat.useLighting = true;
        poolMat.depthWrite = false;
        poolMat.cull = pc.CULLFACE_NONE;

        let sim = null;
        if (waterFx.sim.supported) {
            sim = createWaterSimTargets();
            poolMat.normalMap = sim.normalMapTex;
            poolMat.normalMapTiling = new pc.Vec2(1, 1);
        } else {
            poolMat.opacityMap = assets.waterParticle.resource;
            poolMat.opacityMapChannel = 'a';
        }
        poolMat.update();
        const poolMeshInstance = new pc.MeshInstance(poolMesh, poolMat);
        poolMeshInstance.cull = false;
        pool.addComponent('render', {
            type: 'asset',
            meshInstances: [poolMeshInstance],
            castShadows: false,
            receiveShadows: false
        });

        waterFx.leaks.push({
            root,
            sprinkler,
            jet,
            splash,
            pool,
            poolMat,
            poolSize: 0.5,
            poolTargetSize: 0.5,
            windState: createWindState(0.35, 0),
            simRts: sim?.simRts ?? null,
            simIndex: sim?.simIndex ?? 0,
            normalMapRt: sim?.normalMapRt ?? null,
            normalMapTex: sim?.normalMapTex ?? null
        });
    }
};

const toggleWaterFx = () => {
    if (!waterFx.enabled) ensureWaterLeaks();
    waterFx.enabled = !waterFx.enabled;

    for (let i = 0; i < waterFx.leaks.length; i++) {
        const leak = waterFx.leaks[i];
        leak.jet.enabled = waterFx.enabled;
        leak.splash.enabled = waterFx.enabled;
        leak.poolTargetSize = waterFx.enabled ? 4.8 : 0.5;
    }
    updateFxButtons();
};

app.on('update', (dt) => {
    if (!waterFx.roots.length) return;

    waterFx.time += dt;

    for (let i = 0; i < waterFx.leaks.length; i++) {
        const leak = waterFx.leaks[i];
        const wind = updateWindState(leak.windState, dt);

        if (leak.sprinkler) leak.sprinkler.setLocalPosition(wind.x * 0.55, 3.2, wind.z * 0.55);
        if (leak.jet) leak.jet.setLocalPosition(wind.x * 0.55, 3.2, wind.z * 0.55);
        if (leak.splash) leak.splash.setLocalPosition(wind.x * 0.22, 0.02, wind.z * 0.22);

        leak.poolSize += (leak.poolTargetSize - leak.poolSize) * Math.min(1, dt * 0.35);
        if (leak.pool) leak.pool.setLocalScale(leak.poolSize, 1, leak.poolSize);

        if (leak.poolMat) {
            const ripple = 0.5 + 0.5 * Math.sin((waterFx.time + i) * 1.8);
            leak.poolMat.opacity = (waterFx.enabled ? 0.45 : 0.28) + ripple * 0.05;
            leak.poolMat.emissiveIntensity = 0.18 + ripple * 0.12;
            leak.poolMat.update();
        }

        if (waterFx.enabled && waterFx.sim.supported && leak.simRts && leak.normalMapRt) {
            const poolSize = Math.max(0.5, leak.poolSize);
            const cx = 0.5 + (wind.x * 0.55) / poolSize;
            const cy = 0.5 + (wind.z * 0.55) / poolSize;

            const iterations = 2;
            for (let k = 0; k < iterations; k++) waterSimPass(leak, waterFx.sim.updateShader);

            waterSimDrop(leak, cx + (Math.random() - 0.5) * 0.01, cy + (Math.random() - 0.5) * 0.01, 0.028, 0.28);
            waterSimDrop(leak, cx + (Math.random() - 0.5) * 0.012, cy + (Math.random() - 0.5) * 0.012, 0.02, 0.18);

            waterSimPass(leak, waterFx.sim.normalShader);

            device.scope.resolve('sourceTexture').setValue(waterSimSource(leak));
            pc.drawQuadWithShader(device, leak.normalMapRt, waterFx.sim.normalMapShader);
        }
    }
});

const ensureIncidentRoot = () => {
    if (!incidentFx.firePiles.length) {
        for (let i = 0; i < FIRE_PILE_POSITIONS.length; i++) {
            const root = new pc.Entity(`IncidentFirePile_${i}`);
            root.setPosition(FIRE_PILE_POSITIONS[i]);
            sceneRoot.addChild(root);

            const firePile = i === 0 ? createClassicFlamePile(root) : createFireballFlamePile(root);
            const smokePile = createSmokePile(root, i === 0 ? 0.9 : 1.1);
            incidentFx.firePiles.push(firePile);
            incidentFx.smokePiles.push(smokePile);
        }
    }

    if (incidentFx.alarmRoot) return;

    const alarmRoot = new pc.Entity('AlarmRoot');
    alarmRoot.setPosition(ALARM_BEACON_POSITION);
    sceneRoot.addChild(alarmRoot);
    incidentFx.alarmRoot = alarmRoot;

    const housing = new pc.Entity('AlarmHousing');
    housing.addComponent('render', {
        type: 'box',
        castShadows: false,
        receiveShadows: false
    });
    housing.setLocalScale(0.22, 0.08, 0.12);
    housing.setLocalPosition(0, 2.0, 0);
    alarmRoot.addChild(housing);
    incidentFx.alarmHousing = housing;

    const housingMaterial = new pc.StandardMaterial();
    housingMaterial.diffuse.set(0.12, 0.12, 0.14);
    housingMaterial.emissive.set(0.05, 0.05, 0.05);
    housingMaterial.useLighting = false;
    housingMaterial.update();
    housing.render.material = housingMaterial;

    const beacon = new pc.Entity('AlarmBeacon');
    beacon.addComponent('render', {
        type: 'sphere',
        castShadows: false,
        receiveShadows: false
    });
    beacon.setLocalPosition(0, 2.08, 0);
    beacon.setLocalScale(0.11, 0.07, 0.11);
    alarmRoot.addChild(beacon);

    const beaconMaterial = new pc.StandardMaterial();
    beaconMaterial.diffuse.set(0.35, 0.02, 0.02);
    beaconMaterial.emissive.set(1, 0.08, 0.08);
    beaconMaterial.emissiveIntensity = 0.2;
    beaconMaterial.useLighting = false;
    beaconMaterial.update();
    beacon.render.material = beaconMaterial;
    incidentFx.beacon = beacon;
    incidentFx.beaconMaterial = beaconMaterial;

    const beaconLight = new pc.Entity('AlarmBeaconLight');
    beaconLight.addComponent('light', {
        type: 'point',
        color: new pc.Color(1, 0.08, 0.08),
        intensity: 0.5,
        range: 11,
        castShadows: false
    });
    beaconLight.setLocalPosition(0, 2.08, 0);
    beaconLight.enabled = false;
    alarmRoot.addChild(beaconLight);
    incidentFx.beaconLight = beaconLight;

    if (cameraEntity?.camera?.requestSceneDepthMap) {
        cameraEntity.camera.requestSceneDepthMap(true);
    }
};

const applyIncidentVisualState = () => {
    if (!incidentFx.firePiles.length && !incidentFx.alarmRoot) return;

    for (let i = 0; i < incidentFx.firePiles.length; i++) {
        const pile = incidentFx.firePiles[i];
        pile.primary.enabled = incidentFx.fireEnabled;
        if (pile.secondary) pile.secondary.enabled = incidentFx.fireEnabled;
        if (pile.embers) pile.embers.enabled = incidentFx.fireEnabled;
        if (pile.fireLight) pile.fireLight.enabled = incidentFx.fireEnabled;
    }

    for (let i = 0; i < incidentFx.smokePiles.length; i++) {
        const smoke = incidentFx.smokePiles[i];
        smoke.smokeBase.enabled = incidentFx.smokeEnabled;
        smoke.smokePlume.enabled = incidentFx.smokeEnabled;
    }

    if (incidentFx.beaconLight) incidentFx.beaconLight.enabled = incidentFx.alarmEnabled;

    for (let i = 0; i < incidentFx.smokePiles.length; i++) {
        const smoke = incidentFx.smokePiles[i];
        if (smoke.smokeBase?.particlesystem) {
            smoke.smokeBase.particlesystem.rate = incidentFx.fireEnabled ? 0.03 : 0.045;
            smoke.smokeBase.particlesystem.rate2 = incidentFx.fireEnabled ? 0.036 : 0.05;
        }
        if (smoke.smokePlume?.particlesystem) {
            smoke.smokePlume.particlesystem.rate = incidentFx.fireEnabled ? 0.06 : 0.08;
            smoke.smokePlume.particlesystem.rate2 = incidentFx.fireEnabled ? 0.07 : 0.09;
        }
    }

    stopAlarmAudio();
};

const toggleFireFx = () => {
    if (!incidentFx.fireEnabled) ensureIncidentRoot();
    incidentFx.fireEnabled = !incidentFx.fireEnabled;
    if (incidentFx.fireEnabled && !incidentFx.smokeEnabled) incidentFx.smokeEnabled = true;
    applyIncidentVisualState();
    updateFxButtons();
    destroyIncidentRootIfIdle();
};

const toggleSmokeFx = () => {
    if (!incidentFx.smokeEnabled) ensureIncidentRoot();
    incidentFx.smokeEnabled = !incidentFx.smokeEnabled;
    applyIncidentVisualState();
    updateFxButtons();
    destroyIncidentRootIfIdle();
};

const toggleAlarmFx = () => {
    if (!incidentFx.alarmEnabled) ensureIncidentRoot();
    incidentFx.alarmEnabled = !incidentFx.alarmEnabled;
    applyIncidentVisualState();
    updateFxButtons();
    destroyIncidentRootIfIdle();
};

app.on('update', (dt) => {
    if (!incidentFx.firePiles.length && !incidentFx.alarmRoot) return;

    incidentFx.time += dt;

    for (let i = 0; i < incidentFx.firePiles.length; i++) {
        const pile = incidentFx.firePiles[i];
        if (!incidentFx.fireEnabled || !pile.fireLight?.light) continue;
        const offset = i * 0.9;
        const flicker =
            0.55 +
            Math.abs(Math.sin(incidentFx.time * (12.0 + i * 1.8) + offset)) * 0.72 +
            Math.abs(Math.sin(incidentFx.time * (19.4 + i * 2.1) + 0.6 + offset)) * 0.42;
        pile.fireLight.light.intensity = (pile.type === 'classic' ? 2.2 : 2.8) + flicker * 2.8;
        pile.fireLight.light.range = (pile.type === 'classic' ? 4.8 : 6.2) + flicker * 0.9;
    }

    for (let i = 0; i < incidentFx.firePiles.length; i++) {
        const pile = incidentFx.firePiles[i];
        const wind = updateWindState(pile.windState, dt);

        if (pile.primary && pile.primaryBasePos) {
            pile.primary.setLocalPosition(
                pile.primaryBasePos.x + wind.x * 0.35,
                pile.primaryBasePos.y + wind.y * 0.18,
                pile.primaryBasePos.z + wind.z * 0.35
            );
            pile.primary.setLocalEulerAngles(wind.z * 12, 0, -wind.x * 12);
        }

        if (pile.secondary && pile.secondaryBasePos) {
            pile.secondary.setLocalPosition(
                pile.secondaryBasePos.x + wind.x * 0.55,
                pile.secondaryBasePos.y + wind.y * 0.25,
                pile.secondaryBasePos.z + wind.z * 0.55
            );
            pile.secondary.setLocalEulerAngles(wind.z * 18, 0, -wind.x * 18);
        }

        if (pile.embers && pile.embersBasePos) {
            pile.embers.setLocalPosition(
                pile.embersBasePos.x + wind.x * 0.45,
                pile.embersBasePos.y + wind.y * 0.2,
                pile.embersBasePos.z + wind.z * 0.45
            );
        }
    }

    for (let i = 0; i < incidentFx.smokePiles.length; i++) {
        const smoke = incidentFx.smokePiles[i];
        const wind = updateWindState(smoke.windState, dt);

        smoke.smokeBase.setLocalPosition(
            smoke.smokeBasePos.x + wind.x * 0.65,
            smoke.smokeBasePos.y + wind.y * 0.3,
            smoke.smokeBasePos.z + wind.z * 0.65
        );
        smoke.smokeBase.setLocalEulerAngles(wind.z * 16, 0, -wind.x * 16);

        smoke.smokePlume.setLocalPosition(
            smoke.smokePlumePos.x + wind.x * 1.2,
            smoke.smokePlumePos.y + wind.y * 0.6,
            smoke.smokePlumePos.z + wind.z * 1.2
        );
        smoke.smokePlume.setLocalEulerAngles(wind.z * 24, 0, -wind.x * 24);
    }

    if (incidentFx.alarmEnabled && incidentFx.beaconMaterial && incidentFx.beaconLight?.light) {
        const strobe = Math.pow(Math.max(0, Math.sin(incidentFx.time * 16.0)), 2);
        incidentFx.beaconMaterial.emissiveIntensity = 0.5 + strobe * 3.5;
        incidentFx.beaconMaterial.update();
        incidentFx.beaconLight.light.intensity = 0.3 + strobe * 11.5;
    } else if (incidentFx.beaconMaterial && incidentFx.beaconLight?.light) {
        incidentFx.beaconMaterial.emissiveIntensity = 0.2;
        incidentFx.beaconMaterial.update();
        incidentFx.beaconLight.light.intensity = 0.5;
    }
});

// ====== FX UI ======
const fxStyle = document.createElement('style');
fxStyle.textContent = `
    #fx-overlay { position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%); display: flex; gap: 14px; pointer-events: none; z-index: 10010; }
    #fx-overlay button { pointer-events: auto; background: rgba(18,24,34,0.88); color: #fff; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; width: 88px; height: 72px; font-size: 24px; cursor: pointer; backdrop-filter: blur(10px); transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 4px; box-shadow: 0 10px 26px rgba(0,0,0,0.28); }
    #fx-overlay button:hover { transform: scale(1.1); background: rgba(60,60,80,0.9); }
    #fx-overlay button .label { font-size: 11px; letter-spacing: 0.4px; opacity: 0.72; }
    #fx-overlay button.active { transform: translateY(-3px); }
    #fx-overlay button.fire-btn:hover,
    #fx-overlay button.fire-btn.active { background: linear-gradient(180deg, rgba(255,137,58,0.92), rgba(140,42,6,0.92)); border-color: rgba(255,183,111,0.55); box-shadow: 0 0 24px rgba(255,115,0,0.35); }
    #fx-overlay button.smoke-btn:hover,
    #fx-overlay button.smoke-btn.active { background: linear-gradient(180deg, rgba(118,128,142,0.92), rgba(55,61,72,0.94)); border-color: rgba(226,233,240,0.32); box-shadow: 0 0 20px rgba(206,212,218,0.22); }
    #fx-overlay button.alarm-btn:hover,
    #fx-overlay button.alarm-btn.active { background: linear-gradient(180deg, rgba(255,78,78,0.94), rgba(135,16,16,0.94)); border-color: rgba(255,176,176,0.44); box-shadow: 0 0 24px rgba(255,0,0,0.35); }
    #fx-overlay button.water-btn:hover,
    #fx-overlay button.water-btn.active { background: linear-gradient(180deg, rgba(84,170,255,0.92), rgba(14,66,120,0.92)); border-color: rgba(146,210,255,0.48); box-shadow: 0 0 22px rgba(84,170,255,0.32); }
    @media (max-width: 600px) {
        #fx-overlay { gap: 10px; bottom: 24px; }
        #fx-overlay button { width: 72px; height: 62px; font-size: 20px; }
    }
`;
document.head.appendChild(fxStyle);

const fxOverlay = document.createElement('div');
fxOverlay.id = 'fx-overlay';
fxOverlay.innerHTML = `
    <button class="fire-btn" id="btn-fire">🔥<span class="label">火焰</span></button>
    <button class="smoke-btn" id="btn-smoke">💨<span class="label">烟雾</span></button>
    <button class="alarm-btn" id="btn-alarm">🚨<span class="label">警报</span></button>
    <button class="water-btn" id="btn-water">💧<span class="label">漏水</span></button>
`;
document.body.appendChild(fxOverlay);

document.getElementById('btn-fire').addEventListener('click', toggleFireFx);
document.getElementById('btn-smoke').addEventListener('click', toggleSmokeFx);
document.getElementById('btn-alarm').addEventListener('click', toggleAlarmFx);
document.getElementById('btn-water').addEventListener('click', toggleWaterFx);
ensureIncidentRoot();
applyIncidentVisualState();
updateFxButtons();

// --- Merge cleanups ---
app.on('destroy', () => {
    app.mouse.off(pc.EVENT_MOUSEMOVE, exitMouseMove);
    app.mouse.off(pc.EVENT_MOUSEDOWN, exitMouseDown);
    app.mouse.off(pc.EVENT_MOUSEDOWN, debugClickWorldPosition);
    stopAlarmAudio();
    for (let i = 0; i < waterFx.roots.length; i++) waterFx.roots[i]?.destroy?.();
    fxOverlay.remove();
    fxStyle.remove();
});
