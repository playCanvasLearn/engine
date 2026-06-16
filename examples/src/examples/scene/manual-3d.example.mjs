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
    env: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('machineAll', 'container', { url: './assets/scene/models/machineAll.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
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

app.scene.ambientLight.set(0.4, 0.4, 0.4);
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.45;
app.scene.envAtlas = assets.env.resource;

const light = new pc.Entity('DirectionalLight');
light.addComponent('light', {
    type: 'directional',
    intensity: 2
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const modelRoot = assets.model.resource.instantiateRenderEntity();
app.root.addChild(modelRoot);

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
    clearColor: new pc.Color(0.95, 0.96, 0.98)
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
cc.reset(bbox.center, start);

const info = {
    manualName: '3D手册',
    equipmentCode: 'DEMO-001',
    equipmentName: '示例设备',
    equipmentIntro: '此示例使用 PlayCanvas Engine 加载本地 glb：assets/scene/models/machineAll.glb'
};

const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.left = '10px';
overlay.style.top = '60px';
overlay.style.zIndex = '10';
overlay.style.maxWidth = 'min(520px, calc(100vw - 24px))';
overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
overlay.style.color = '#0b1220';
document.body.appendChild(overlay);

const card = document.createElement('div');
card.style.background = 'rgba(255, 255, 255, 0.92)';
card.style.backdropFilter = 'blur(8px)';
card.style.border = '1px solid rgba(0, 0, 0, 0.08)';
card.style.borderRadius = '10px';
card.style.padding = '12px';
card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)';
overlay.appendChild(card);

const makeRow = (label, value) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.padding = '6px 0';

    const l = document.createElement('div');
    l.style.minWidth = '110px';
    l.style.color = 'rgba(11, 18, 32, 0.72)';
    l.textContent = label;

    const v = document.createElement('div');
    v.style.flex = '1';
    v.style.fontWeight = '600';
    v.textContent = value;

    row.appendChild(l);
    row.appendChild(v);
    return row;
};

card.appendChild(makeRow('3D手册名称：', info.manualName));
card.appendChild(makeRow('设备编号：', info.equipmentCode));
card.appendChild(makeRow('设备名称：', info.equipmentName));

// const introWrap = document.createElement('div');
// introWrap.style.marginTop = '8px';
// introWrap.style.paddingTop = '8px';
// introWrap.style.borderTop = '1px solid rgba(0,0,0,0.08)';
// introWrap.style.whiteSpace = 'pre-line';
// introWrap.style.color = 'rgba(11, 18, 32, 0.82)';
// introWrap.textContent = info.equipmentIntro;
// card.appendChild(introWrap);

const buttons = document.createElement('div');
buttons.style.display = 'flex';
buttons.style.gap = '10px';
buttons.style.flexWrap = 'wrap';
buttons.style.marginTop = '10px';
overlay.appendChild(buttons);

const makeButton = (text) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '8px';
    btn.style.border = '1px solid rgba(0,0,0,0.12)';
    btn.style.background = 'rgba(255,255,255,0.9)';
    btn.style.cursor = 'pointer';
    btn.style.userSelect = 'none';
    return btn;
};

const explodedButton = makeButton('爆炸视图');
const separateButton = makeButton('拆分模型');
const resetButton = makeButton('显示主要部件');
buttons.appendChild(explodedButton);
buttons.appendChild(separateButton);
buttons.appendChild(resetButton);

const worldCenter = bbox.center.clone();
const renderEntities = new Map();
modelRoot.findComponents('render').forEach((render) => {
    renderEntities.set(render.entity, true);
});

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
const setMode = (next) => {
    mode = next;
    if (mode === 'explode') {
        applyOffset(sceneSize * 0.35);
        return;
    }
    if (mode === 'separate') {
        applyOffset(sceneSize * 0.18);
        return;
    }
    applyOffset(0);
};

explodedButton.addEventListener('click', () => {
    setMode(mode === 'explode' ? 'none' : 'explode');
});
separateButton.addEventListener('click', () => {
    setMode(mode === 'separate' ? 'none' : 'separate');
});
resetButton.addEventListener('click', () => {
    setMode('none');
    cc.focus(bbox.center, true);
});

app.on('destroy', () => {
    overlay.remove();
});
