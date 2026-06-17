import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}
window.focus();

pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('machineAll', 'container', { url: './assets/scene/models/1988548899212464128_draco.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(canvas);
createOptions.touch = new pc.TouchDevice(canvas);
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight.set(0, 0, 0);
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 1;
app.scene.exposure = 1;
app.scene.envAtlas = assets.helipad.resource;

const applyHdri = (source) => {
    const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
    app.scene.skybox = skybox;
    const lighting = pc.EnvLighting.generateLightingSource(source);
    const envAtlas = pc.EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    app.scene.envAtlas = envAtlas;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

if (!navigator.webdriver) {
    void (async () => {
        const hdri = new pc.Asset(
            'hdri',
            'texture',
            { url: 'https://image.365me.me/static/hdr/crossfit_gym_1k.hdr?t=12345' },
            { mipmaps: false }
        );
        app.assets.add(hdri);
        app.assets.load(hdri);
        await Promise.race([
            new Promise((resolve) => hdri.ready(() => resolve(true))),
            sleep(5000)
        ]);
        if (hdri.resource) {
            applyHdri(hdri.resource);
        }
    })();
}

const modelRoot = assets.model.resource.instantiateRenderEntity();
modelRoot.setLocalEulerAngles(0, -90, 0);
app.root.addChild(modelRoot);

const hiddenNameIncludes = [
    '1镜向SK74_2', '1镜向SK7_2', '1SK7420226_2', '1SK7420219_2',
    '001a装065', '001a装062', '001a装067', '001a装068', '001a装066',
    '001a装063', 'a装070', 'a装069', '61-1-1S108', '61-1-1S119',
    '61-1-1J2', '61-1-1S118', '61-1-1S114', '61-1-1S051', '61-1-1SK',
    '61-1-1S111', '61-1-1S053', '61-1-1S105', '61-1-1S049', '61-1-1S120',
    '61-1-1S126', '61-1-1S007', '61-1-1S106', '61-1-1S103', '61-1-1S163',
    '61-1-1S008', '61-1-1S101', '61-1-1S116', '61-1-1S054', '61-1-1S058',
    '61-1-1S044', '61-1-1S046', '61-1-1S062', '61-1-1S172', '61-1-1S040',
    '61-1-1S128', '61-1-1S115', '61-1-1S043', '61-1-1S052', '61-1-1S021',
    '61-1-1S006', '61-1-1S005', '61-1-1S065', '61-1-1S002', '61-1-1S009',
    '61-1-1S069', '61-1-1S070', '61-1-1S214', '61-1-1S127', '1J11', '1J21'
];

const offsetXNameIncludes = [
    '装配体-147', '30+31+76+61+75', '40×68×15轴承', '1CRB1W63_(0)',
    '1J51', '30接近开关', '9(GB70-85)', '4(JB17-59)', '1KUD35',
    '500挡块', '南京工艺(FFZD5010-5)', '防护过渡板-1', 'L直线导轨滑块',
    '1CRB163W_SHAFT'
];

const shellNameIncludes = [
    '左罩', '外罩', '后罩', '移门', '顶盖', '人', '水箱装配体',
    '外形图', '电箱', '左移门', '上海机床', '左外罩', '装配体SK7420A(1)',
    '后墙', '后罩组合', '操纵面板', '后罩壳', '拉手', '右外罩焊接',
    '左移门1', '左外罩焊接', '底部围边', '接头', '全防护结构', '淋浴',
    '线槽盖板', '防护罩', '箱体', '铝管', '099973_a', '气动板装配图',
    '90度转角', '24节', '罩壳', 'H-77', '10-312', '床身冲洗装配',
    '冷却水硬管', '水箱', '固定座', '砂轮冷却装配', '后防护支架',
    '2000内六角圆柱头螺', '下支架', '支架', '地基-1',
    '1J11', '1J21', 'Mesh_'
];

const renderComponents = modelRoot.findComponents('render');
const baselineHidden = new Set();
const getName = (entity) => entity.name ?? '';

const includesAny = (names, includes) => {
    for (const name of names) {
        if (!name) {
            continue;
        }
        for (const sub of includes) {
            if (name.includes(sub)) {
                return true;
            }
        }
    }
    return false;
};

for (const render of renderComponents) {
    const names = [getName(render.entity)];
    for (const mi of render.meshInstances) {
        const n = mi?.node?.name;
        if (typeof n === 'string' && n) {
            names.push(n);
        }
    }

    if (includesAny(names, offsetXNameIncludes)) {
        const lp = render.entity.getLocalPosition();
        render.entity.setLocalPosition(lp.x - 0.2, lp.y, lp.z);
    }

    if (includesAny(names, hiddenNameIncludes)) {
        render.enabled = false;
        baselineHidden.add(render.entity);
        for (const mi of render.meshInstances) {
            mi.visible = false;
            mi.pick = false;
        }
    }
}

const picker = new pc.Picker(app, 1, 1, true);
const meshInstanceToEntity = new Map();
for (const render of renderComponents) {
    for (const mi of render.meshInstances) {
        meshInstanceToEntity.set(mi, render.entity);
    }
}

const selectionOriginalMaterials = new Map();
const dragOriginalMaterials = new Map();
let selectedEntity = null;

const makeDragMaterial = () => {
    const mat = new pc.StandardMaterial();
    mat.diffuse.set(1, 0.6, 0.1);
    mat.emissive.set(1, 0.6, 0.1);
    mat.emissiveIntensity = 0.8;
    mat.useLighting = false;
    mat.opacity = 0.8;
    mat.blendType = pc.BLEND_NORMAL;
    mat.update();
    return mat;
};

const makeHighlightMaterial = (source) => {
    const mat = source?.clone ? source.clone() : source;
    if (mat && mat.emissive && mat.emissiveIntensity !== undefined) {
        mat.emissive.set(0.3, 1, 0.3);
        mat.emissiveIntensity = 0.6;
        mat.update?.();
    }
    return mat;
};

const restoreSelection = () => {
    for (const [mi, mat] of selectionOriginalMaterials) {
        mi.material = mat;
    }
    selectionOriginalMaterials.clear();
    selectedEntity = null;
};

const restoreDrag = () => {
    for (const [mi, mat] of dragOriginalMaterials) {
        mi.material = mat;
    }
    dragOriginalMaterials.clear();
};

const setSelection = (entity) => {
    if (!entity?.render) {
        restoreSelection();
        return;
    }
    if (selectedEntity === entity) {
        restoreSelection();
        return;
    }
    restoreSelection();
    selectedEntity = entity;
    for (const mi of entity.render.meshInstances) {
        if (dragOriginalMaterials.has(mi)) {
            continue;
        }
        if (!selectionOriginalMaterials.has(mi)) {
            selectionOriginalMaterials.set(mi, mi.material);
        }
        mi.material = makeHighlightMaterial(mi.material);
    }
};

const setDragHighlight = (entity) => {
    if (!entity?.render) {
        return;
    }
    for (const mi of entity.render.meshInstances) {
        if (!dragOriginalMaterials.has(mi)) {
            dragOriginalMaterials.set(mi, mi.material);
        }
        mi.material = makeDragMaterial();
    }
};

const restoreDragHighlight = (entity) => {
    if (!entity?.render) {
        restoreDrag();
        return;
    }
    for (const mi of entity.render.meshInstances) {
        if (dragOriginalMaterials.has(mi)) {
            mi.material = dragOriginalMaterials.get(mi);
            dragOriginalMaterials.delete(mi);
        }
    }
};

const pickEntityAt = async (x, y) => {
    const pickerScale = 0.5;
    picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
    const worldLayer = app.scene.layers.getLayerByName('World');
    picker.prepare(camera.camera, app.scene, [worldLayer]);
    const selection = await picker.getSelectionAsync(x * pickerScale, y * pickerScale, 1, 1);
    const mi = selection?.[0];
    const entity = mi ? meshInstanceToEntity.get(mi) : null;
    if (!entity || baselineHidden.has(entity)) {
        return null;
    }
    if (mi && (mi.pick === false || mi.visible === false)) {
        return null;
    }
    if (!entity.render || entity.render.enabled === false) {
        return null;
    }
    return entity;
};

const calcEntityAABB = (bbox, entity) => {
    bbox.center.set(0, 0, 0);
    bbox.halfExtents.set(0, 0, 0);
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((mi) => {
            bbox.add(mi.aabb);
        });
    });
    return bbox;
};

const bbox = calcEntityAABB(new pc.BoundingBox(), modelRoot);
const sceneSize = Math.max(0.001, bbox.halfExtents.length());

const start = bbox.center.clone().add(new pc.Vec3(0, sceneSize * 0.7, sceneSize * 2.2));

const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.2, 0.2, 0.2),
    farClip: 10000,
    fov: 60,
    toneMapping: pc.TONEMAP_LINEAR,
    gammaCorrection: pc.GAMMA_SRGB
});
camera.addComponent('script');
camera.setPosition(start);
app.root.addChild(camera);

const cc = camera.script.create(CameraControls);
Object.assign(cc, {
    focusPoint: bbox.center,
    enableFly: false,
    moveSpeed: 2 * sceneSize,
    moveFastSpeed: 4 * sceneSize,
    moveSlowSpeed: sceneSize
});
cc.rotateDamping = 0.985;
cc.zoomDamping = 0.985;
cc.focusDamping = 0.985;
cc.zoomRange = new pc.Vec2(10, 120);
cc.pitchRange = new pc.Vec2(-80, 80);
cc.reset(bbox.center, start);

const info = {
    manualName: '3D手册',
    equipmentCode: '总装图',
    equipmentName: '数控螺纹磨床SK7420A',
    equipmentIntro: '此示例使用 PlayCanvas Engine 加载本地 glb：assets/scene/models/machineAll.glb'
};

const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.left = '50%';
overlay.style.top = '16px';
overlay.style.transform = 'translateX(-50%)';
overlay.style.zIndex = '10';
overlay.style.width = 'min(560px, calc(100vw - 32px))';
overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
overlay.style.color = '#0b1220';
document.body.appendChild(overlay);

// const titleCard = document.createElement('div');
// titleCard.style.background = 'linear-gradient(135deg, rgba(18, 52, 86, 0.95), rgba(29, 78, 216, 0.92))';
// titleCard.style.border = '1px solid rgba(255, 255, 255, 0.14)';
// titleCard.style.borderRadius = '14px';
// titleCard.style.padding = '14px 16px';
// titleCard.style.boxShadow = '0 14px 34px rgba(16, 24, 40, 0.28)';
// titleCard.style.color = '#fff';
// titleCard.style.marginBottom = '12px';
// overlay.appendChild(titleCard);

// const titleLabel = document.createElement('div');
// titleLabel.textContent = '3D手册';
// titleLabel.style.fontSize = '12px';
// titleLabel.style.letterSpacing = '0.12em';
// titleLabel.style.textTransform = 'uppercase';
// titleLabel.style.opacity = '0.78';
// titleLabel.style.marginBottom = '6px';
// titleCard.appendChild(titleLabel);

// const titleName = document.createElement('div');
// titleName.textContent = info.manualName;
// titleName.style.fontSize = '24px';
// titleName.style.fontWeight = '700';
// titleName.style.lineHeight = '1.25';
// titleName.style.textShadow = '0 2px 12px rgba(0, 0, 0, 0.18)';
// titleCard.appendChild(titleName);

// const titleDesc = document.createElement('div');
// titleDesc.textContent = '设备三维浏览与交互说明';
// titleDesc.style.marginTop = '6px';
// titleDesc.style.fontSize = '13px';
// titleDesc.style.opacity = '0.84';
// titleCard.appendChild(titleDesc);

const card = document.createElement('div');
card.style.background = 'rgba(255, 255, 255, 0.92)';
card.style.backdropFilter = 'blur(10px)';
card.style.border = '1px solid rgba(0, 0, 0, 0.08)';
card.style.borderRadius = '14px';
card.style.padding = '12px 18px';
card.style.boxShadow = '0 10px 30px rgba(16, 24, 40, 0.16)';
card.style.display = 'flex';
card.style.alignItems = 'center';
card.style.justifyContent = 'center';
card.style.gap = '24px';
card.style.flexWrap = 'wrap';
overlay.appendChild(card);

const makeTopField = (label, value) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const l = document.createElement('div');
    l.style.color = 'rgba(11, 18, 32, 0.66)';
    l.style.fontSize = '14px';
    l.textContent = `${label}：`;

    const v = document.createElement('div');
    v.style.fontSize = '16px';
    v.style.fontWeight = '700';
    v.style.color = '#0b1220';
    v.textContent = value;

    row.appendChild(l);
    row.appendChild(v);
    return row;
};

card.appendChild(makeTopField('设备编号', info.equipmentCode));
card.appendChild(makeTopField('设备名称', info.equipmentName));

// const introWrap = document.createElement('div');
// introWrap.style.marginTop = '8px';
// introWrap.style.paddingTop = '8px';
// introWrap.style.borderTop = '1px solid rgba(0,0,0,0.08)';
// introWrap.style.whiteSpace = 'pre-line';
// introWrap.style.color = 'rgba(11, 18, 32, 0.82)';
// introWrap.textContent = info.equipmentIntro;
// card.appendChild(introWrap);

const buttons = document.createElement('div');
buttons.style.position = 'fixed';
buttons.style.left = '50%';
buttons.style.bottom = '24px';
buttons.style.transform = 'translateX(-50%)';
buttons.style.display = 'flex';
buttons.style.gap = '12px';
buttons.style.flexWrap = 'wrap';
buttons.style.alignItems = 'center';
buttons.style.justifyContent = 'center';
buttons.style.zIndex = '20';
document.body.appendChild(buttons);

const makeButton = (text, background, hover) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.padding = '10px 15px';
    btn.style.borderRadius = '6px';
    btn.style.border = 'none';
    btn.style.backgroundColor = background;
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.userSelect = 'none';
    btn.style.fontSize = '16px';
    btn.style.lineHeight = '1.2';
    btn.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    btn.style.whiteSpace = 'nowrap';
    btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = hover;
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = background;
    });
    return btn;
};

const explodedButton = makeButton('爆炸视图', '#4CAF50', '#45A049');
const separateButton = makeButton('拆分模型', '#2196F3', '#1976D2');
const mainBodyButton = makeButton('显示主要部件', '#FF9800', '#F57C00');
buttons.appendChild(explodedButton);
buttons.appendChild(separateButton);
buttons.appendChild(mainBodyButton);

const worldCenter = bbox.center.clone();
const renderEntities = new Map();
modelRoot.findComponents('render').forEach((render) => {
    renderEntities.set(render.entity, true);
});

const isShell = (name) => {
    for (const sub of shellNameIncludes) {
        if (name.includes(sub)) {
            return true;
        }
    }
    return false;
};

let isMainBodyMode = false;
const hiddenShells = new Set();

let isIsolated = false;
let isolatedEntity = null;
const isolationCache = new Map();

const setIsolation = (enabled, focusEntity) => {
    if (enabled === isIsolated) {
        return;
    }

    if (enabled) {
        isolationCache.clear();
        for (const render of renderComponents) {
            isolationCache.set(render.entity, {
                enabled: render.enabled,
                mesh: render.meshInstances.map(mi => ({ mi, visible: mi.visible, pick: mi.pick }))
            });
        }

        for (const render of renderComponents) {
            const isFocus = render.entity === focusEntity;
            const shouldRender = isFocus && render.enabled !== false;
            render.enabled = shouldRender;
            for (const mi of render.meshInstances) {
                mi.visible = shouldRender;
                mi.pick = shouldRender;
            }
        }

        isIsolated = true;
        isolatedEntity = focusEntity ?? null;
        return;
    }

    for (const [entity, saved] of isolationCache) {
        const render = entity.render;
        if (!render) {
            continue;
        }
        render.enabled = saved.enabled;
        for (const item of saved.mesh) {
            item.mi.visible = item.visible;
            item.mi.pick = item.pick;
        }
    }
    isolationCache.clear();
    isIsolated = false;
    isolatedEntity = null;
};

const setMainBodyMode = (enabled) => {
    if (enabled === isMainBodyMode) {
        return;
    }

    if (!enabled && isIsolated) {
        setIsolation(false);
    }
    isMainBodyMode = enabled;
    mainBodyButton.textContent = isMainBodyMode ? '显示全部' : '显示主要部件';

    if (isMainBodyMode) {
        for (const render of renderComponents) {
            const entity = render.entity;
            if (baselineHidden.has(entity)) {
                continue;
            }
            if (isShell(getName(entity))) {
                render.enabled = false;
                hiddenShells.add(entity);
                for (const mi of render.meshInstances) {
                    mi.visible = false;
                    mi.pick = false;
                }
            }
        }
        return;
    }

    for (const entity of hiddenShells) {
        if (baselineHidden.has(entity)) {
            continue;
        }
        const render = entity.render;
        if (render) {
            render.enabled = true;
            for (const mi of render.meshInstances) {
                mi.visible = true;
                mi.pick = true;
            }
        }
    }
    hiddenShells.clear();
};

const parts = Array.from(renderEntities.keys()).map((entity) => {
    const basePos = entity.getPosition().clone();
    const dir = basePos.clone().sub(worldCenter);
    if (dir.lengthSq() > 1e-10) {
        dir.normalize();
    } else {
        dir.set(0, 1, 0);
    }
    return { entity, basePos, dir };
});

const applyOffset = (distance) => {
    for (const p of parts) {
        p.entity.setPosition(p.basePos.clone().add(p.dir.clone().mulScalar(distance)));
    }
};

let mode = 'none';
let isMoveMode = false;
let isDragging = false;
let dragEntity = null;
let dragPlaneNormal = new pc.Vec3();
let dragPlanePoint = new pc.Vec3();
let dragOffset = new pc.Vec3();

const getRay = (x, y) => {
    const near = camera.camera.screenToWorld(x, y, camera.camera.nearClip);
    const far = camera.camera.screenToWorld(x, y, camera.camera.farClip);
    return {
        origin: near,
        dir: far.sub(near).normalize()
    };
};

const intersectRayPlane = (origin, dir, planeNormal, planePoint, out) => {
    const denom = planeNormal.dot(dir);
    if (Math.abs(denom) < 1e-6) {
        return null;
    }
    const t = planePoint.clone().sub(origin).dot(planeNormal) / denom;
    if (t < 0) {
        return null;
    }
    out.copy(origin).add(dir.clone().mulScalar(t));
    return out;
};

const setMode = (next) => {
    mode = next;
    if (mode === 'explode') {
        explodedButton.textContent = '复原模型';
        separateButton.style.display = 'none';
        applyOffset(sceneSize * 0.35);
        return;
    }
    explodedButton.textContent = '爆炸视图';
    if (!isMoveMode) {
        separateButton.style.display = '';
    }
    applyOffset(0);
};

explodedButton.addEventListener('click', () => {
    setMode(mode === 'explode' ? 'none' : 'explode');
});
separateButton.addEventListener('click', () => {
    isMoveMode = !isMoveMode;
    separateButton.textContent = isMoveMode ? '复原模型' : '拆分模型';
    if (isMoveMode) {
        setMode('none');
        explodedButton.style.display = 'none';
        restoreSelection();
        return;
    }
    explodedButton.style.display = '';
    explodedButton.textContent = '爆炸视图';
    if (isDragging) {
        isDragging = false;
        restoreDragHighlight(dragEntity);
        dragEntity = null;
        cc.enabled = true;
    }
    restoreSelection();
    setMode('none');
});
mainBodyButton.addEventListener('click', () => {
    setMainBodyMode(!isMainBodyMode);
});

app.mouse.on(pc.EVENT_MOUSEDOWN, async (event) => {
    if (event.button !== 0) {
        return;
    }
    const entity = await pickEntityAt(event.x, event.y);
    if (!isMoveMode) {
        if (entity) {
            setSelection(entity);
        } else {
            restoreSelection();
        }
        return;
    }
    if (!entity) {
        restoreSelection();
        return;
    }
    if (isDragging) {
        return;
    }

    restoreSelection();
    isDragging = true;
    dragEntity = entity;
    cc.enabled = false;
    setDragHighlight(entity);

    dragPlaneNormal = camera.forward.clone();
    dragPlanePoint = entity.getPosition().clone();

    const { origin, dir } = getRay(event.x, event.y);
    const hit = intersectRayPlane(origin, dir, dragPlaneNormal, dragPlanePoint, new pc.Vec3());
    if (hit) {
        dragOffset = entity.getPosition().clone().sub(hit);
    } else {
        dragOffset = new pc.Vec3(0, 0, 0);
    }
});

app.mouse.on(pc.EVENT_MOUSEMOVE, (event) => {
    if (!isMoveMode || !isDragging || !dragEntity) {
        return;
    }
    const { origin, dir } = getRay(event.x, event.y);
    const hit = intersectRayPlane(origin, dir, dragPlaneNormal, dragPlanePoint, new pc.Vec3());
    if (!hit) {
        return;
    }
    dragEntity.setPosition(hit.add(dragOffset));
});

app.mouse.on(pc.EVENT_MOUSEUP, async (event) => {
    if (event.button !== 0) {
        return;
    }
    if (isMoveMode && isDragging && dragEntity) {
        restoreDragHighlight(dragEntity);
        cc.enabled = true;
        isDragging = false;
        const entity = dragEntity;
        dragEntity = null;
        setSelection(entity);
        return;
    }
    if (!isMoveMode) {
        const entity = await pickEntityAt(event.x, event.y);
        if (entity) {
            setSelection(entity);
        } else {
            restoreSelection();
        }
    }
});

canvas.addEventListener('dblclick', (event) => {
    if (!isMainBodyMode) {
        return;
    }
    if (isIsolated) {
        setIsolation(false);
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pickerScale = 0.5;
    picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
    const worldLayer = app.scene.layers.getLayerByName('World');
    picker.prepare(camera.camera, app.scene, [worldLayer]);

    picker.getSelectionAsync(x * pickerScale, y * pickerScale, 1, 1).then((selection) => {
        const mi = selection?.[0];
        const entity = mi ? meshInstanceToEntity.get(mi) : null;
        if (!entity) {
            return;
        }
        if (baselineHidden.has(entity)) {
            return;
        }
        const render = entity.render;
        if (!render || !render.enabled) {
            return;
        }
        setIsolation(true, entity);
    });
});

app.on('destroy', () => {
    overlay.remove();
    buttons.remove();
});
