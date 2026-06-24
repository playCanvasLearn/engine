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

const billboard = new pc.Entity('Billboard');
const labelPlane = new pc.Entity('labelPlane');
labelPlane.addComponent('render', { type: 'plane' });
labelPlane.setLocalPosition(0, 2.266, 0);
labelPlane.setLocalEulerAngles(90, 90, 0);
labelPlane.setLocalScale(0.5, 0.5, 0.5);
billboard.addChild(labelPlane);
const labelBaseEuler = labelPlane.getLocalEulerAngles().clone();

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
player.addChild(billboard);
player.addComponent('anim', { activate: true });
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
            { from: 'Take', to: 'Idle', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 2 }] },
            { from: 'Put', to: 'Idle', time: 0.2, priority: 0, conditions: [{ parameterName: 'playerStatus', predicate: pc.ANIM_EQUAL_TO, value: 2 }] }
        ]
    }],
    parameters: {
        playerStatus: { name: 'playerStatus', type: pc.ANIM_PARAMETER_INTEGER, value: 0 }
    }
};

player.anim.loadStateGraph(animStateGraphData);
const baseLayer = player.anim.baseLayer;
baseLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Take', assets.takeAnim.resource.animations[0].resource);
baseLayer.assignAnimation('Put', assets.putAnim.resource.animations[0].resource);

const setStatus = v => player.anim.setInteger('playerStatus', v);

const pickupMaterial = new pc.StandardMaterial();
pickupMaterial.diffuse.set(0.85, 0.55, 0.16);
pickupMaterial.emissive.set(0.2, 0.09, 0.02);
pickupMaterial.update();

const pickupItem = new pc.Entity('PickupItem');
pickupItem.addComponent('model', { type: 'cylinder', castShadows: true, receiveShadows: true });
pickupItem.model.material = pickupMaterial;
pickupItem.setLocalScale(0.18, 0.12, 0.18);
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

const updateLabelFacingForThirdPerson = () => {
    if (!labelPlane || !cameraEntity) return;

    // Fixed/first mode: use base rotation
    if (viewMode === 'fixed' || viewMode === 'first') {
        labelPlane.setLocalEulerAngles(labelBaseEuler);
        return;
    }

    // Third-person mode: face camera
    _labelWorldPos.copy(labelPlane.getPosition());
    _labelCameraPos.copy(cameraEntity.getPosition());
    _labelCameraPos.y = _labelWorldPos.y;

    const dx = _labelCameraPos.x - _labelWorldPos.x;
    const dz = _labelCameraPos.z - _labelWorldPos.z;
    if (Math.abs(dx) <= 1e-4 && Math.abs(dz) <= 1e-4) return;

    const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    labelPlane.setLocalEulerAngles(90, yaw, 0);
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
    updateLabelFacingForThirdPerson();

    if (window.__robotPauseAnimation) {
        currentSpeed = 0;
        setStatus(2);
        return;
    }

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

app.mouse.on(pc.EVENT_MOUSEMOVE, exitMouseMove);
app.mouse.on(pc.EVENT_MOUSEDOWN, exitMouseDown);
app.on('destroy', () => {
    app.mouse.off(pc.EVENT_MOUSEMOVE, exitMouseMove);
    app.mouse.off(pc.EVENT_MOUSEDOWN, exitMouseDown);
});

// ====== Toolbar ======

const TOOLBAR_ID = 'bottom-toolbar';

(function injectToolbarCss() {
    if (document.getElementById('opencode-toolbar-css')) return;
    const css = [
        '.bottom-toolbar {',
        '    position: fixed;',
        '    left: 50%;',
        '    bottom: 12px;',
        '    transform: translateX(-50%);',
        '    display: flex;',
        '    gap: 10px;',
        '    padding: 10px 12px;',
        '    border-radius: 14px;',
        '    background: rgba(16, 18, 20, 0.72);',
        '    border: 1px solid rgba(255, 255, 255, 0.12);',
        '    backdrop-filter: blur(10px);',
        '    -webkit-backdrop-filter: blur(10px);',
        '    z-index: 10001;',
        '    pointer-events: auto;',
        '    user-select: none;',
        '}',
        '@supports (bottom: env(safe-area-inset-bottom)) {',
        '    .bottom-toolbar {',
        '        bottom: calc(12px + env(safe-area-inset-bottom));',
        '    }',
        '}',
        '.bottom-toolbar .toolbar-btn {',
        '    width: 44px;',
        '    height: 44px;',
        '    border-radius: 12px;',
        '    border: 1px solid rgba(255, 255, 255, 0.12);',
        '    background: rgba(255, 255, 255, 0.06);',
        '    display: inline-flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '    cursor: pointer;',
        '    padding: 0;',
        '    outline: none;',
        '    position: relative;',
        '}',
        '.bottom-toolbar .toolbar-btn:hover::after {',
        '    content: attr(aria-label);',
        '    position: absolute;',
        '    left: 50%;',
        '    bottom: 52px;',
        '    transform: translateX(-50%);',
        '    padding: 6px 8px;',
        '    border-radius: 10px;',
        '    background: rgba(16, 18, 20, 0.92);',
        '    border: 1px solid rgba(255, 255, 255, 0.14);',
        '    color: rgba(255, 255, 255, 0.92);',
        '    font-size: 12px;',
        '    line-height: 1;',
        '    white-space: nowrap;',
        '    pointer-events: none;',
        '    z-index: 10003;',
        '}',
        '.bottom-toolbar .toolbar-btn:hover::before {',
        '    content: "";',
        '    position: absolute;',
        '    left: 50%;',
        '    bottom: 44px;',
        '    transform: translateX(-50%);',
        '    width: 0;',
        '    height: 0;',
        '    border-style: solid;',
        '    border-width: 6px 6px 0 6px;',
        '    border-color: rgba(16, 18, 20, 0.92) transparent transparent transparent;',
        '    pointer-events: none;',
        '    z-index: 10003;',
        '}',
        '.bottom-toolbar .toolbar-btn svg {',
        '    width: 22px;',
        '    height: 22px;',
        '    fill: none;',
        '    stroke: rgba(255, 255, 255, 0.92);',
        '    stroke-width: 1.8;',
        '    stroke-linecap: round;',
        '    stroke-linejoin: round;',
        '}',
        '.bottom-toolbar .toolbar-btn.is-active {',
        '    background: rgba(0, 153, 255, 0.18);',
        '    border-color: rgba(0, 153, 255, 0.55);',
        '}',
        '.bottom-toolbar .toolbar-btn:active {',
        '    transform: translateY(1px);',
        '}',
        '.bottom-toolbar .toolbar-sep {',
        '    width: 1px;',
        '    height: 26px;',
        '    background: rgba(255, 255, 255, 0.18);',
        '    align-self: center;',
        '    margin: 0 2px;',
        '    pointer-events: none;',
        '}',
        '#materials-panel {',
        '    position: fixed;',
        '    top: 12px;',
        '    right: 12px;',
        '    width: 320px;',
        '    max-width: calc(100vw - 24px);',
        '    max-height: calc(100vh - 24px);',
        '    display: flex;',
        '    flex-direction: column;',
        '    border-radius: 14px;',
        '    background: rgba(16, 18, 20, 0.92);',
        '    border: 1px solid rgba(255, 255, 255, 0.14);',
        '    backdrop-filter: blur(10px);',
        '    -webkit-backdrop-filter: blur(10px);',
        '    z-index: 10002;',
        '    overflow: hidden;',
        '}',
        '#materials-panel .materials-header {',
        '    display: flex;',
        '    flex-direction: column;',
        '    gap: 8px;',
        '    padding: 12px 12px 10px 12px;',
        '    border-bottom: 1px solid rgba(255, 255, 255, 0.10);',
        '}',
        '#materials-panel .materials-title {',
        '    color: rgba(255, 255, 255, 0.92);',
        '    font-size: 13px;',
        '    font-weight: 600;',
        '    letter-spacing: 0.2px;',
        '}',
        '#materials-panel .materials-search {',
        '    width: 100%;',
        '    height: 34px;',
        '    border-radius: 10px;',
        '    border: 1px solid rgba(255, 255, 255, 0.12);',
        '    background: rgba(255, 255, 255, 0.06);',
        '    color: rgba(255, 255, 255, 0.92);',
        '    padding: 0 10px;',
        '    outline: none;',
        '    box-sizing: border-box;',
        '}',
        '#materials-panel .materials-search::placeholder {',
        '    color: rgba(255, 255, 255, 0.45);',
        '}',
        '#materials-panel .materials-list {',
        '    padding: 8px 8px 10px 8px;',
        '    overflow: auto;',
        '    flex: 1;',
        '}',
        '#materials-panel .scene-row {',
        '    display: flex;',
        '    align-items: center;',
        '    gap: 8px;',
        '    padding-top: 8px;',
        '    padding-bottom: 8px;',
        '    border-radius: 10px;',
        '    border: 1px solid rgba(255, 255, 255, 0.08);',
        '    background: rgba(255, 255, 255, 0.03);',
        '    margin: 0 0 8px 0;',
        '    cursor: pointer;',
        '    user-select: none;',
        '}',
        '#materials-panel .scene-row:hover {',
        '    background: rgba(255, 255, 255, 0.05);',
        '}',
        '#materials-panel .scene-row.is-selected {',
        '    background: rgba(0, 153, 255, 0.16);',
        '    border-color: rgba(0, 153, 255, 0.38);',
        '}',
        '#materials-panel .scene-toggle {',
        '    width: 12px;',
        '    height: 12px;',
        '    flex: 0 0 12px;',
        '    position: relative;',
        '}',
        '#materials-panel .scene-toggle:before {',
        '    content: "";',
        '    position: absolute;',
        '    top: 1px;',
        '    left: 3px;',
        '    width: 0;',
        '    height: 0;',
        '    border-style: solid;',
        '    border-width: 5px 0 5px 6px;',
        '    border-color: transparent transparent transparent rgba(255, 255, 255, 0.70);',
        '    transform-origin: 2px 5px;',
        '}',
        '#materials-panel .scene-toggle.is-open:before {',
        '    transform: rotate(90deg);',
        '}',
        '#materials-panel .scene-toggle.is-leaf:before {',
        '    border-width: 0;',
        '}',
        '#materials-panel .scene-name {',
        '    color: rgba(255, 255, 255, 0.92);',
        '    font-size: 13px;',
        '    line-height: 1.2;',
        '    word-break: break-word;',
        '    flex: 1;',
        '}',
        '#materials-panel .scene-name.is-match {',
        '    color: rgba(0, 153, 255, 0.95);',
        '}',
        '#materials-panel .scene-eye {',
        '    margin-left: auto;',
        '    width: 28px;',
        '    height: 28px;',
        '    border-radius: 10px;',
        '    border: 1px solid rgba(255, 255, 255, 0.12);',
        '    background: rgba(255, 255, 255, 0.05);',
        '    display: inline-flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '    padding: 0;',
        '    cursor: pointer;',
        '}',
        '#materials-panel .scene-eye svg {',
        '    width: 18px;',
        '    height: 18px;',
        '    fill: none;',
        '    stroke: rgba(255, 255, 255, 0.80);',
        '    stroke-width: 1.8;',
        '    stroke-linecap: round;',
        '    stroke-linejoin: round;',
        '}',
        '#materials-panel .materials-empty {',
        '    color: rgba(255, 255, 255, 0.55);',
        '    font-size: 12px;',
        '    padding: 12px 10px;',
        '}'
    ].join('\n');

    const style = document.createElement('style');
    style.id = 'opencode-toolbar-css';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
})();

if (!document.getElementById(TOOLBAR_ID)) {
    const createIconSvg = (type) => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');

        if (type === 'fixed') {
            const p1 = document.createElementNS(ns, 'path');
            p1.setAttribute('d', 'M12 5a7 7 0 1 0 7 7');
            svg.appendChild(p1);
            const p2 = document.createElementNS(ns, 'path');
            p2.setAttribute('d', 'M19 5v6h-6');
            svg.appendChild(p2);
            const p3 = document.createElementNS(ns, 'path');
            p3.setAttribute('d', 'M19 11a7 7 0 0 0-7-6');
            svg.appendChild(p3);
            return svg;
        }

        if (type === 'third') {
            const rect = document.createElementNS(ns, 'rect');
            rect.setAttribute('x', '3');
            rect.setAttribute('y', '7');
            rect.setAttribute('width', '18');
            rect.setAttribute('height', '12');
            rect.setAttribute('rx', '2');
            rect.setAttribute('ry', '2');
            svg.appendChild(rect);
            const dot = document.createElementNS(ns, 'circle');
            dot.setAttribute('cx', '12');
            dot.setAttribute('cy', '13');
            dot.setAttribute('r', '2');
            svg.appendChild(dot);
            return svg;
        }

        if (type === 'materials') {
            const p = document.createElementNS(ns, 'path');
            p.setAttribute('d', 'M12 3l8 4v10l-8 4l-8-4V7l8-4z');
            svg.appendChild(p);
            const l1 = document.createElementNS(ns, 'path');
            l1.setAttribute('d', 'M12 3v18');
            svg.appendChild(l1);
            const l2 = document.createElementNS(ns, 'path');
            l2.setAttribute('d', 'M4 7l8 4l8-4');
            svg.appendChild(l2);
            return svg;
        }

        if (type === 'eye') {
            const e1 = document.createElementNS(ns, 'path');
            e1.setAttribute('d', 'M2 12s4-7 10-7s10 7 10 7s-4 7-10 7S2 12 2 12z');
            svg.appendChild(e1);
            const e2 = document.createElementNS(ns, 'circle');
            e2.setAttribute('cx', '12');
            e2.setAttribute('cy', '12');
            e2.setAttribute('r', '3');
            svg.appendChild(e2);
            return svg;
        }

        if (type === 'tv') {
            const r1 = document.createElementNS(ns, 'rect');
            r1.setAttribute('x', '4');
            r1.setAttribute('y', '6');
            r1.setAttribute('width', '16');
            r1.setAttribute('height', '11');
            r1.setAttribute('rx', '2');
            r1.setAttribute('ry', '2');
            svg.appendChild(r1);
            const s1 = document.createElementNS(ns, 'path');
            s1.setAttribute('d', 'M9 20h6');
            svg.appendChild(s1);
            const s2 = document.createElementNS(ns, 'path');
            s2.setAttribute('d', 'M12 17v3');
            svg.appendChild(s2);
            return svg;
        }

        if (type === 'fence') {
            const f1 = document.createElementNS(ns, 'path');
            f1.setAttribute('d', 'M4 20V7m4 13V7m4 13V7m4 13V7m4 13V7');
            svg.appendChild(f1);
            const f2 = document.createElementNS(ns, 'path');
            f2.setAttribute('d', 'M3 10h18M3 14h18');
            svg.appendChild(f2);
            return svg;
        }

        if (type === 'floor') {
            const g1 = document.createElementNS(ns, 'path');
            g1.setAttribute('d', 'M4 10l8-4l8 4l-8 4l-8-4z');
            svg.appendChild(g1);
            const g2 = document.createElementNS(ns, 'path');
            g2.setAttribute('d', 'M4 14l8 4l8-4');
            svg.appendChild(g2);
            const g3 = document.createElementNS(ns, 'path');
            g3.setAttribute('d', 'M12 10v8');
            svg.appendChild(g3);
            return svg;
        }

        if (type === 'pause') {
            const pr = document.createElementNS(ns, 'rect');
            pr.setAttribute('x', '6');
            pr.setAttribute('y', '5');
            pr.setAttribute('width', '4');
            pr.setAttribute('height', '14');
            pr.setAttribute('rx', '1');
            svg.appendChild(pr);
            const pl = document.createElementNS(ns, 'rect');
            pl.setAttribute('x', '14');
            pl.setAttribute('y', '5');
            pl.setAttribute('width', '4');
            pl.setAttribute('height', '14');
            pl.setAttribute('rx', '1');
            svg.appendChild(pl);
            return svg;
        }

        const head = document.createElementNS(ns, 'path');
        head.setAttribute('d', 'M12 12a4 4 0 1 0-4-4a4 4 0 0 0 4 4');
        svg.appendChild(head);
        const body = document.createElementNS(ns, 'path');
        body.setAttribute('d', 'M4 21a8 8 0 0 1 16 0');
        svg.appendChild(body);
        return svg;
    };

    const createToolbarButton = (label, iconType, className, isActive) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `toolbar-btn${className ? (` ${className}`) : ''}${isActive ? ' is-active' : ''}`;
        btn.setAttribute('aria-label', label);
        btn.appendChild(createIconSvg(iconType));
        return btn;
    };

    const createToolbarSeparator = () => {
        const sep = document.createElement('div');
        sep.className = 'toolbar-sep';
        sep.setAttribute('aria-hidden', 'true');
        return sep;
    };

    const createToolbarUi = () => {
        const toolbar = document.createElement('div');
        toolbar.className = 'bottom-toolbar';
        toolbar.id = TOOLBAR_ID;
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', '工具栏');

        const btnThird = createToolbarButton('固定视角', 'fixed', '', true);
        const btnFixed = createToolbarButton('第三人称视角', 'third', '');
        const btnPauseAnim = createToolbarButton('暂停动画', 'pause', 'toolbar-btn-pause-anim');
        const btnScene = createToolbarButton('查看场景物品', 'materials', 'toolbar-btn-materials');
        const btnHideTv = createToolbarButton('隐藏电视', 'tv', 'toolbar-btn-hide-tv');
        const btnHideFence = createToolbarButton('隐藏围栏', 'fence', 'toolbar-btn-hide-fence');
        const btnHideFloor = createToolbarButton('隐藏地板', 'floor', 'toolbar-btn-hide-floor');

        toolbar.appendChild(btnThird);
        toolbar.appendChild(btnFixed);
        toolbar.appendChild(btnPauseAnim);
        toolbar.appendChild(createToolbarSeparator());
        toolbar.appendChild(btnScene);
        toolbar.appendChild(btnHideTv);
        toolbar.appendChild(btnHideFence);
        toolbar.appendChild(btnHideFloor);

        document.body.appendChild(toolbar);

        return { toolbar, btnThird, btnFixed, btnPauseAnim, btnScene, btnHideTv, btnHideFence, btnHideFloor };
    };

    const createScenePanelUi = () => {
        const panel = document.createElement('div');
        panel.id = 'materials-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', '场景物品');
        panel.style.display = 'none';

        const header = document.createElement('div');
        header.className = 'materials-header';

        const title = document.createElement('div');
        title.className = 'materials-title';
        title.innerText = '场景物品';

        const search = document.createElement('input');
        search.className = 'materials-search';
        search.type = 'search';
        search.placeholder = '搜索物品名称';
        search.autocomplete = 'off';
        search.spellcheck = false;

        const list = document.createElement('div');
        list.className = 'materials-list';

        header.appendChild(title);
        header.appendChild(search);
        panel.appendChild(header);
        panel.appendChild(list);
        document.body.appendChild(panel);

        return { panel, search, list };
    };

    const ui = createToolbarUi();
    const sceneUi = createScenePanelUi();

    let isRobotPaused = false;
    window.__robotPauseAnimation = isRobotPaused;
    let isSceneOpen = false;
    let isTvHidden = false;
    let isFenceHidden = false;
    let isFloorHidden = false;

    const treeExpanded = Object.create(null);
    let selectedPath = '';
    let highlighted = null;
    let tvTargets = null;
    let fenceTargets = null;
    let floorTargets = null;
    const hiddenEntities = Object.create(null);
    const hiddenMeshInstances = Object.create(null);
    const sceneListHiddenNames = {
        SceneRoot: true,
        Light: true,
        MachineEntity: true,
        cabinetEntity1: true,
        cabinetEntity2: true,
        DetectionEntity: true,
        GroundEntity: true
    };

    const findByNameLower = (root, nameLower) => {
        if (!root) return null;
        const stack = [root];
        while (stack.length) {
            const e = stack.pop();
            const n = (e.name || '').toLowerCase();
            if (n === nameLower) return e;
            const children = e.children;
            for (let i = 0; i < children.length; i++) stack.push(children[i]);
        }
        return null;
    };

    const getSceneRoot = () => {
        const sr = app.root.findByName('SceneRoot');
        if (sr) return sr;
        const sr2 = findByNameLower(app.root, 'sceneroot');
        if (sr2) return sr2;
        return app.root;
    };

    const resolveEntityByPath = (root, path) => {
        if (!root || !path) return null;
        const parts = path.split('.');
        let node = root;
        for (let i = 1; i < parts.length; i++) {
            const idx = parseInt(parts[i], 10);
            if (!node || !node.children || Number.isNaN(idx)) return null;
            if (idx < 0 || idx >= node.children.length) return null;
            node = node.children[idx];
        }
        return node;
    };

    const getEntityId = (e) => {
        if (!e) return '';
        if (e.getGuid) return e.getGuid();
        if (e._guid) return e._guid;
        return e.name || '';
    };

    const getMeshInstanceId = (mi) => {
        if (!mi) return '';
        if (mi.id !== undefined) return String(mi.id);
        if (mi._id !== undefined) return String(mi._id);
        const n = mi.node && mi.node.name ? mi.node.name : '';
        const m = mi.mesh && mi.mesh.name ? mi.mesh.name : '';
        return `${n}|${m}`;
    };

    const addHiddenEntity = (e) => {
        const id = getEntityId(e);
        if (!id) return;
        let rec = hiddenEntities[id];
        if (!rec) {
            rec = { count: 0, enabled: e.enabled, entity: e };
            hiddenEntities[id] = rec;
        }
        rec.entity = e;
        rec.count++;
        e.enabled = false;
    };

    const removeHiddenEntity = (e) => {
        const id = getEntityId(e);
        if (!id) return;
        const rec = hiddenEntities[id];
        if (!rec) return;
        rec.count--;
        if (rec.count <= 0) {
            if (rec.entity) rec.entity.enabled = rec.enabled;
            delete hiddenEntities[id];
        }
    };

    const addHiddenMeshInstance = (mi) => {
        const id = getMeshInstanceId(mi);
        if (!id) return;
        let rec = hiddenMeshInstances[id];
        if (!rec) {
            rec = { count: 0, visible: mi.visible, mi: mi };
            hiddenMeshInstances[id] = rec;
        }
        rec.mi = mi;
        rec.count++;
        mi.visible = false;
    };

    const removeHiddenMeshInstance = (mi) => {
        const id = getMeshInstanceId(mi);
        if (!id) return;
        const rec = hiddenMeshInstances[id];
        if (!rec) return;
        rec.count--;
        if (rec.count <= 0) {
            if (rec.mi) rec.mi.visible = rec.visible;
            delete hiddenMeshInstances[id];
        }
    };

    const collectTargetsByNames = (names) => {
        const set = Object.create(null);
        for (let i = 0; i < names.length; i++) set[names[i]] = true;
        const entities = [];
        const meshInstances = [];
        app.root.forEach((node) => {
            if (set[node.name]) entities.push(node);

            let mis = null;
            if (node.render && node.render.meshInstances) mis = node.render.meshInstances;
            else if (node.model && node.model.meshInstances) mis = node.model.meshInstances;
            if (!mis || !mis.length) return;

            for (let j = 0; j < mis.length; j++) {
                const mi = mis[j];
                const n1 = mi && mi.node && mi.node.name ? mi.node.name : '';
                const n2 = mi && mi.mesh && mi.mesh.name ? mi.mesh.name : '';
                if (set[n1] || set[n2]) meshInstances.push(mi);
            }
        });
        return { entities, meshInstances };
    };

    const hideTargets = (targets) => {
        if (!targets) return;
        const es = targets.entities || [];
        for (let i = 0; i < es.length; i++) addHiddenEntity(es[i]);
        const ms = targets.meshInstances || [];
        for (let j = 0; j < ms.length; j++) addHiddenMeshInstance(ms[j]);
    };

    const showTargets = (targets) => {
        if (!targets) return;
        const es = targets.entities || [];
        for (let i = 0; i < es.length; i++) removeHiddenEntity(es[i]);
        const ms = targets.meshInstances || [];
        for (let j = 0; j < ms.length; j++) removeHiddenMeshInstance(ms[j]);
    };

    const clearHighlight = () => {
        if (!highlighted || !highlighted.items) return;
        for (let i = 0; i < highlighted.items.length; i++) {
            const it = highlighted.items[i];
            if (!it || !it.meshInstance) continue;
            it.meshInstance.material = it.material;
        }
        highlighted = null;
    };

    const applyHighlight = (entity) => {
        clearHighlight();
        if (!entity) return;
        const items = [];

        entity.forEach((node) => {
            let meshInstances = null;
            if (node.render && node.render.meshInstances) meshInstances = node.render.meshInstances;
            else if (node.model && node.model.meshInstances) meshInstances = node.model.meshInstances;
            if (!meshInstances || !meshInstances.length) return;

            for (let i = 0; i < meshInstances.length; i++) {
                const mi = meshInstances[i];
                if (!mi || !mi.material || !mi.material.clone) continue;

                items.push({ meshInstance: mi, material: mi.material });

                const cloned = mi.material.clone();
                if (cloned.emissive && cloned.emissive.set) cloned.emissive.set(0, 0.6, 1);
                if (cloned.emissiveIntensity !== undefined) cloned.emissiveIntensity = 1.8;
                if (cloned.update) cloned.update();
                mi.material = cloned;
            }
        });

        highlighted = { items };
    };

    const isSceneListHiddenNode = (node) => {
        if (!node) return false;
        return !!sceneListHiddenNames[node.name || ''];
    };

    const shouldShowNode = (node, q, path) => {
        if (!node) return false;
        if (isSceneListHiddenNode(node) && path !== '0') return false;

        if (!q) return true;
        const name = (node.name || '').toLowerCase();
        if (name.indexOf(q) !== -1) return true;
        const children = node.children;
        for (let i = 0; i < children.length; i++) {
            if (shouldShowNode(children[i], q, `${path}.${i}`)) return true;
        }
        return false;
    };

    const renderSceneTree = () => {
        const q = (sceneUi.search.value || '').trim().toLowerCase();
        const root = getSceneRoot();
        sceneUi.list.textContent = '';

        if (!root) {
            const empty0 = document.createElement('div');
            empty0.className = 'materials-empty';
            empty0.innerText = '未找到 SceneRoot';
            sceneUi.list.appendChild(empty0);
            return;
        }

        let any = false;

        const renderNode = (node, depth, path) => {
            if (!shouldShowNode(node, q, path)) return;

            const hiddenByName = isSceneListHiddenNode(node);
            const children = node.children || [];

            if (hiddenByName && path === '0') {
                for (let rootChildIdx = 0; rootChildIdx < children.length; rootChildIdx++) {
                    renderNode(children[rootChildIdx], depth, `${path}.${rootChildIdx}`);
                }
                return;
            }

            any = true;
            const hasChildren = children.length > 0;

            const matched = !q || ((node.name || '').toLowerCase().indexOf(q) !== -1);
            const expanded = path === '0' || (!!treeExpanded[path]) || (!!q && hasChildren && shouldShowNode(node, q, path));

            const row = document.createElement('div');
            row.className = `scene-row${selectedPath === path ? ' is-selected' : ''}`;
            row.dataset.path = path;
            row.dataset.hasChildren = hasChildren ? '1' : '0';
            row.dataset.depth = String(depth);
            row.dataset.expanded = expanded ? '1' : '0';
            row.style.paddingLeft = `${10 + depth * 14}px`;

            const toggle = document.createElement('div');
            toggle.className = `scene-toggle${hasChildren ? '' : ' is-leaf'}${expanded ? ' is-open' : ''}`;
            row.appendChild(toggle);

            const nameEl = document.createElement('div');
            nameEl.className = `scene-name${matched && q ? ' is-match' : ''}`;
            nameEl.innerText = node.name || '(未命名)';
            row.appendChild(nameEl);

            if (path !== '0' && hasChildren) {
                const eyeBtn = document.createElement('button');
                eyeBtn.type = 'button';
                eyeBtn.className = 'scene-eye';
                eyeBtn.setAttribute('aria-label', '高亮选中');
                eyeBtn.dataset.path = path;
                eyeBtn.appendChild(createIconSvg('eye'));
                row.appendChild(eyeBtn);
            }

            sceneUi.list.appendChild(row);

            if (!hasChildren) return;
            if (!expanded) return;

            for (let i = 0; i < children.length; i++) {
                renderNode(children[i], depth + 1, `${path}.${i}`);
            }
        };

        renderNode(root, 0, '0');

        if (!any) {
            const empty = document.createElement('div');
            empty.className = 'materials-empty';
            empty.innerText = '无匹配物品';
            sceneUi.list.appendChild(empty);
        }
    };

    const setSceneOpen = (open) => {
        if (open === isSceneOpen) return;
        isSceneOpen = open;
        if (isSceneOpen) {
            ui.btnScene.classList.add('is-active');
            sceneUi.panel.style.display = '';
            renderSceneTree();
            sceneUi.search.focus();
            sceneUi.search.select();
        } else {
            ui.btnScene.classList.remove('is-active');
            sceneUi.panel.style.display = 'none';
        }
    };

    sceneUi.search.addEventListener('input', () => {
        if (!isSceneOpen) return;
        renderSceneTree();
    });

    sceneUi.list.addEventListener('click', (ev) => {
        let t = ev.target;
        let eye = null;
        while (t && t !== sceneUi.list) {
            if (t.classList && t.classList.contains('scene-eye')) {
                eye = t;
                break;
            }
            t = t.parentElement;
        }

        if (eye) {
            ev.preventDefault();
            ev.stopPropagation();
            const p = eye.dataset.path;
            if (!p) return;
            if (selectedPath === p) {
                selectedPath = '';
                clearHighlight();
            } else {
                selectedPath = p;
                applyHighlight(resolveEntityByPath(getSceneRoot(), p));
            }
            renderSceneTree();
            return;
        }

        let el = ev.target;
        while (el && el !== sceneUi.list && !(el.classList && el.classList.contains('scene-row'))) el = el.parentElement;
        if (!el || el === sceneUi.list) return;

        const path = el.dataset.path;
        const hasChildren = el.dataset.hasChildren === '1';
        const q = (sceneUi.search.value || '').trim();

        if (!hasChildren && path) {
            selectedPath = path;
            applyHighlight(resolveEntityByPath(getSceneRoot(), path));
            renderSceneTree();
            return;
        }

        if (!q && hasChildren && path && path !== '0') {
            treeExpanded[path] = !treeExpanded[path];
            renderSceneTree();
        }
    });

    const syncPauseButton = () => {
        if (isRobotPaused) ui.btnPauseAnim.classList.add('is-active');
        else ui.btnPauseAnim.classList.remove('is-active');
    };

    const swallow = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
    };

    const hookButton = (btn, onClick) => {
        btn.addEventListener('pointerdown', swallow, { passive: false });
        btn.addEventListener('click', onClick);
    };

    const syncViewButtons = () => {
        const isThird = viewMode === 'third';
        const isFirst = viewMode === 'first';
        ui.btnThird.classList.toggle('is-active', !isThird && !isFirst);
        ui.btnFixed.classList.toggle('is-active', isThird);
    };

    hookButton(ui.btnThird, () => { setViewMode('fixed'); });
    hookButton(ui.btnFixed, () => { setViewMode('third'); });

    const tvNames = [
        'Mesh_368', 'Mesh_369', 'Mesh_370', 'Mesh_371', 'Mesh_372', 'Mesh_373', 'Mesh_374', 'Mesh_375', 'Mesh_376',
        'Mesh_377', 'Mesh_378', 'Mesh_379', 'Mesh_380', 'Mesh_381', '屏幕'
    ];

    const applyTvHidden = (hidden) => {
        if (hidden === isTvHidden) return;
        isTvHidden = hidden;
        if (isTvHidden) {
            ui.btnHideTv.classList.add('is-active');
            tvTargets = collectTargetsByNames(tvNames);
            hideTargets(tvTargets);
        } else {
            ui.btnHideTv.classList.remove('is-active');
            showTargets(tvTargets);
            tvTargets = null;
        }
    };

    hookButton(ui.btnPauseAnim, () => {
        isRobotPaused = !isRobotPaused;
        window.__robotPauseAnimation = isRobotPaused;
        if (isRobotPaused) {
            setStatus(2);
        }
        syncPauseButton();
    });

    hookButton(ui.btnScene, () => {
        setSceneOpen(!isSceneOpen);
    });
    hookButton(ui.btnHideTv, () => {
        applyTvHidden(!isTvHidden);
    });

    hookButton(ui.btnHideFence, () => {
        const fenceNames = [
            'Mesh_106', 'Mesh_77', 'Mesh_55', 'Mesh_63', 'Mesh_155', 'Mesh_60', 'Mesh_110', 'Mesh_145', 'Mesh_156', 'Mesh_153', 'Mesh_154',
            'Mesh_75', 'Mesh_80', 'Mesh_85', 'Mesh_90', 'Mesh_96', 'Mesh_101', 'Mesh_103', 'Mesh_113',
            'Mesh_48', 'Mesh_53', 'Mesh_58', 'Mesh_62', 'Mesh_64', 'Mesh_66', 'Mesh_68', 'Mesh_69', 'Mesh_71', 'Mesh_72', 'Mesh_76', 'Mesh_78',
            'Mesh_88', 'Mesh_91', 'Mesh_93', 'Mesh_98', 'Mesh_100', 'Mesh_105', 'Mesh_107', 'Mesh_109', 'Mesh_111', 'Mesh_115', 'Mesh_119',
            'Mesh_44', 'Mesh_59', 'Mesh_81', 'Mesh_83', 'Mesh_86', 'Mesh_95',
            'Mesh_40', 'Mesh_49', 'Mesh_54', 'Mesh_57', 'Mesh_62', 'Mesh_67', 'Mesh_73'
        ];
        isFenceHidden = !isFenceHidden;
        if (isFenceHidden) {
            ui.btnHideFence.classList.add('is-active');
            fenceTargets = collectTargetsByNames(fenceNames);
            hideTargets(fenceTargets);
        } else {
            ui.btnHideFence.classList.remove('is-active');
            showTargets(fenceTargets);
            fenceTargets = null;
        }
    });

    hookButton(ui.btnHideFloor, () => {
        const floorNames = ['Mesh_383'];
        isFloorHidden = !isFloorHidden;
        if (isFloorHidden) {
            ui.btnHideFloor.classList.add('is-active');
            floorTargets = collectTargetsByNames(floorNames);
            hideTargets(floorTargets);
        } else {
            ui.btnHideFloor.classList.remove('is-active');
            showTargets(floorTargets);
            floorTargets = null;
        }
    });

    syncViewButtons();
    syncPauseButton();
}
