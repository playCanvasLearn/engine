// @config
//
// 职工之家 - 纯 PlayCanvas Engine 版，运行时直接装配模型/材质/节点树，
// 不再依赖 PlayCanvas Editor 导出的 config/scene/scripts/ammo 启动链路。

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';
import { MATERIAL_DEFINITIONS, MODEL_DEFINITIONS, TEXTURE_DEFINITIONS } from './assets.mjs';
import { NODE_DEFINITIONS, RENDER_SETTINGS } from './scene.mjs';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const BASE_URL = './assets/scene/staff-home/';
const APP_WIDTH = 1920;
const APP_HEIGHT = 1080;

const INPUT_SETTINGS = {
    useKeyboard: true,
    useMouse: true,
    useGamepads: false,
    useTouch: true
};
const deviceTypes = [...new Set([deviceType, 'webgl2', 'webgl1'].filter(Boolean))];
const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'default'
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    pc.ModelComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem
].filter(Boolean);
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.JsonHandler,
    pc.ModelHandler
].filter(Boolean);
createOptions.elementInput = new pc.ElementInput(canvas, {
    useMouse: INPUT_SETTINGS.useMouse,
    useTouch: INPUT_SETTINGS.useTouch
});
createOptions.keyboard = INPUT_SETTINGS.useKeyboard ? new pc.Keyboard(window) : null;
createOptions.mouse = INPUT_SETTINGS.useMouse ? new pc.Mouse(canvas) : null;
createOptions.gamepads = INPUT_SETTINGS.useGamepads ? new pc.GamePads() : null;
createOptions.touch = INPUT_SETTINGS.useTouch && pc.platform.touch ? new pc.TouchDevice(canvas) : null;
createOptions.soundManager = new pc.SoundManager();

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(pc.FILLMODE_KEEP_ASPECT);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const ensureCanvasCss = () => {
    const style = document.createElement('style');
    style.textContent = `@media screen and (min-aspect-ratio: ${APP_WIDTH}/${APP_HEIGHT}) {
        #application-canvas.fill-mode-KEEP_ASPECT {
            width: auto;
            height: 100%;
            margin: 0 auto;
        }
    }`;
    document.head.appendChild(style);

    if (canvas.classList) {
        canvas.classList.add('fill-mode-KEEP_ASPECT');
    }

    app.on('destroy', () => {
        style.remove();
    });
};

const resize = () => {
    canvas.style.width = '';
    canvas.style.height = '';
    app.resizeCanvas(canvas.width, canvas.height);
};

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
});

const createToolbar = () => {
    const style = document.createElement('style');
    style.textContent = `
        #staff-home-toolbar {
            position: absolute;
            left: 50%;
            bottom: 16px;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            padding: 8px;
            border-radius: 12px;
            background: rgba(12, 18, 28, 0.72);
            backdrop-filter: blur(10px);
            pointer-events: auto;
            user-select: none;
            z-index: 9999;
            font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
            opacity: 0;
            pointer-events: none;
            transition: opacity 200ms ease;
        }
        .staff-home-tool {
            appearance: none;
            border: 1px solid rgba(120, 180, 255, 0.22);
            background: rgba(18, 28, 44, 0.86);
            color: rgba(235, 246, 255, 0.9);
            padding: 8px 14px;
            border-radius: 10px;
            font-size: 13px;
            cursor: pointer;
        }
        .staff-home-tool.selected {
            background: rgba(51, 70, 232, 0.92);
            border-color: rgba(51, 70, 232, 0.92);
            color: #ffffff;
        }
        @media (max-width: 640px) {
            #staff-home-toolbar {
                bottom: 10px;
                padding: 6px;
                gap: 8px;
            }
            .staff-home-tool {
                padding: 7px 12px;
                font-size: 12px;
            }
        }
    `;
    document.head.appendChild(style);

    const toolbar = document.createElement('div');
    toolbar.id = 'staff-home-toolbar';

    const freeBtn = document.createElement('button');
    freeBtn.type = 'button';
    freeBtn.className = 'staff-home-tool';
    freeBtn.textContent = '自由参观';

    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'staff-home-tool';
    autoBtn.textContent = '自动参观';

    toolbar.appendChild(freeBtn);
    toolbar.appendChild(autoBtn);
    document.body.appendChild(toolbar);

    app.on('destroy', () => {
        toolbar.remove();
        style.remove();
    });

    const show = () => {
        toolbar.style.opacity = '1';
        toolbar.style.pointerEvents = 'auto';
    };

    return { freeBtn, autoBtn, show };
};

const computeSceneBounds = () => {
    const aabb = new pc.BoundingBox();
    let hasBounds = false;
    const models = app.root.findComponents('model');
    for (const model of models) {
        for (const meshInstance of model.meshInstances) {
            if (!meshInstance?.aabb) continue;
            if (!hasBounds) {
                aabb.copy(meshInstance.aabb);
                hasBounds = true;
            } else {
                aabb.add(meshInstance.aabb);
            }
        }
    }
    if (!hasBounds) {
        aabb.center.set(0, 1.5, 0);
        aabb.halfExtents.set(10, 5, 10);
    }
    return aabb;
};

const loadAssets = (assets) => new Promise((resolve, reject) => {
    if (!assets.length) {
        resolve();
        return;
    }

    let remaining = assets.length;
    let failed = false;

    const onComplete = () => {
        remaining -= 1;
        if (!failed && remaining === 0) {
            resolve();
        }
    };

    for (const asset of assets) {
        asset.once('load', onComplete);
        asset.once('error', (err) => {
            if (!failed) {
                failed = true;
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
        app.assets.load(asset);
    }
});

const textureOptionFromDef = (def) => {
    const options = {
        mipmaps: def.mipmaps,
        anisotropy: def.anisotropy
    };

    if (def.rgbm) {
        options.type = pc.TEXTURETYPE_RGBM;
    }
    if (def.srgb) {
        options.srgb = true;
    }
    return options;
};

const textureAssets = new Map();
for (const def of TEXTURE_DEFINITIONS) {
    const asset = new pc.Asset(`staff-home-texture-${def.id}`, 'texture', {
        url: BASE_URL + def.url
    }, textureOptionFromDef(def));
    asset.id = def.id;
    app.assets.add(asset);
    textureAssets.set(def.id, asset);
}

const envAtlas = new pc.Asset('staff-home-env', 'texture', {
    url: './assets/cubemaps/helipad-env-atlas.png'
}, {
    type: pc.TEXTURETYPE_RGBP,
    mipmaps: false
});
app.assets.add(envAtlas);

await loadAssets([...textureAssets.values(), envAtlas]);

const textureFromId = (id) => textureAssets.get(id)?.resource ?? null;
const mapProperties = new Set([
    'aoMap',
    'diffuseMap',
    'specularMap',
    'metalnessMap',
    'glossMap',
    'emissiveMap',
    'normalMap',
    'opacityMap',
    'lightMap'
]);

const assignMaterialValue = (material, key, value) => {
    if (mapProperties.has(key)) {
        material[key] = textureFromId(value);
        return;
    }

    if (Array.isArray(value)) {
        if (value.length === 3) {
            material[key] = new pc.Color(value[0], value[1], value[2]);
            return;
        }
        if (value.length === 2) {
            material[key] = new pc.Vec2(value[0], value[1]);
            return;
        }
    }

    material[key] = value;
};

for (const def of MATERIAL_DEFINITIONS) {
    const material = new pc.StandardMaterial();
    for (const [key, value] of Object.entries(def.data)) {
        assignMaterialValue(material, key, value);
    }
    material.update();

    const asset = new pc.Asset(def.name, 'material');
    asset.id = def.id;
    asset.resource = material;
    asset.loaded = true;
    app.assets.add(asset);
}

const modelAssets = [];
for (const def of MODEL_DEFINITIONS) {
    const asset = new pc.Asset(def.name, 'model', {
        url: BASE_URL + def.url
    }, {
        mapping: def.mapping.map((material) => ({ material }))
    });
    asset.id = def.id;
    app.assets.add(asset);
    modelAssets.push(asset);
}

await loadAssets(modelAssets);

app.scene.ambientLight = new pc.Color(...RENDER_SETTINGS.ambient);
app.scene.envAtlas = envAtlas.resource;
app.scene.exposure = RENDER_SETTINGS.exposure;
app.scene.skyboxIntensity = RENDER_SETTINGS.skyboxIntensity;

const nodes = new Map();
for (const def of NODE_DEFINITIONS) {
    const entity = new pc.Entity(def.name);
    entity.setLocalPosition(...def.position);
    entity.setLocalEulerAngles(...def.rotation);
    entity.setLocalScale(...def.scale);
    entity.enabled = def.enabled !== false;

    if (def.model?.asset) {
        entity.addComponent('model', {
            type: 'asset',
            asset: def.model.asset,
            castShadows: false,
            receiveShadows: false
        });
    }

    if (def.light) {
        entity.addComponent('light', {
            type: def.light.type,
            color: new pc.Color(...def.light.color),
            intensity: def.light.intensity,
            range: def.light.range,
            innerConeAngle: def.light.innerConeAngle,
            outerConeAngle: def.light.outerConeAngle,
            castShadows: def.light.castShadows,
            shadowBias: def.light.shadowBias,
            normalOffsetBias: def.light.normalOffsetBias
        });
    }

    if (def.camera) {
        entity.addComponent('camera', {
            fov: def.camera.fov,
            nearClip: def.camera.nearClip,
            farClip: def.camera.farClip,
            projection: def.camera.projection,
            clearColor: new pc.Color(0.05, 0.06, 0.08),
            toneMapping: pc.TONEMAP_ACES2
        });
    }

    nodes.set(def.id, entity);
}

for (const def of NODE_DEFINITIONS) {
    const entity = nodes.get(def.id);
    const parent = def.parent ? nodes.get(def.parent) : app.root;
    (parent ?? app.root).addChild(entity);
}

ensureCanvasCss();
resize();
app.start();

const pickSceneCameraEntity = () => {
    const cameras = app.root.findComponents('camera');
    if (!cameras?.length) return null;

    const preferred = cameras.find((c) => /camera/i.test(c.entity.name)) ?? cameras[0];
    preferred.aspectRatioMode = pc.ASPECT_AUTO;
    preferred.toneMapping = pc.TONEMAP_ACES2;
    return preferred?.entity ?? null;
};

let camera = pickSceneCameraEntity();
if (!camera) {
    camera = new pc.Entity('staff-home-camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.05, 0.06, 0.08),
        farClip: 2000,
        fov: 65,
        toneMapping: pc.TONEMAP_ACES2
    });
    app.root.addChild(camera);
}

const bounds = computeSceneBounds();
const focusPoint = bounds.center.clone();
const cameraStartPos = camera.getPosition().clone();
const cameraStartToFocus = cameraStartPos.clone().sub(focusPoint);
const cameraStartRadius = cameraStartToFocus.length();
const baseRadius = pc.math.clamp(cameraStartRadius || 0, 1.6, Math.max(3.2, Math.min(Math.max(bounds.halfExtents.x, bounds.halfExtents.z) * 0.8, 9)));
const baseHeightOffset = cameraStartPos.y - focusPoint.y;
const baseYaw = cameraStartRadius > 0.0001 ? Math.atan2(cameraStartToFocus.x, cameraStartToFocus.z) * pc.math.RAD_TO_DEG : 0;

const state = {
    mode: 'auto',
    yaw: 0,
    pitch: -10,
    autoTime: 0
};

const applyCameraAngles = () => {
    camera.setLocalEulerAngles(state.pitch, state.yaw, 0);
};

const setMode = (mode, toolbar) => {
    state.mode = mode;
    toolbar.freeBtn.classList.toggle('selected', mode === 'free');
    toolbar.autoBtn.classList.toggle('selected', mode === 'auto');
    if (mode === 'free') {
        const eulers = camera.getEulerAngles();
        state.pitch = eulers.x;
        state.yaw = eulers.y;
        applyCameraAngles();
        canvas.requestPointerLock?.();
    } else {
        document.exitPointerLock?.();
    }
};

const toolbar = createToolbar();
toolbar.freeBtn.addEventListener('click', () => setMode('free', toolbar));
toolbar.autoBtn.addEventListener('click', () => setMode('auto', toolbar));
setMode('auto', toolbar);

if (app.mouse) {
    app.mouse.on('mousemove', (e) => {
        if (state.mode !== 'free') return;
        const dx = e.dx ?? 0;
        const dy = e.dy ?? 0;
        state.yaw -= dx * 0.12;
        state.pitch -= dy * 0.12;
        state.pitch = pc.math.clamp(state.pitch, -85, 85);
        applyCameraAngles();
    });
}

applyCameraAngles();

const updateAuto = (dt) => {
    state.autoTime += dt;
    const arc = 35;
    const t = (Math.sin(state.autoTime * 0.22) * 0.5 + 0.5);
    const angle = baseYaw + pc.math.lerp(-arc, arc, t);
    const rad = angle * pc.math.DEG_TO_RAD;

    const bob = Math.sin(state.autoTime * 0.6) * 0.08;
    const y = pc.math.clamp(
        focusPoint.y + baseHeightOffset + bob,
        focusPoint.y - bounds.halfExtents.y + 1.2,
        focusPoint.y + bounds.halfExtents.y - 0.8
    );

    camera.setPosition(
        focusPoint.x + Math.sin(rad) * baseRadius,
        y,
        focusPoint.z + Math.cos(rad) * baseRadius
    );
    camera.lookAt(focusPoint);
};

updateAuto(0);

const updateFree = (dt) => {
    if (!app.keyboard) return;
    const speed = app.keyboard.isPressed(pc.KEY_SHIFT) ? 9 : 4.5;
    const move = new pc.Vec3();
    if (app.keyboard.isPressed(pc.KEY_W)) move.z -= 1;
    if (app.keyboard.isPressed(pc.KEY_S)) move.z += 1;
    if (app.keyboard.isPressed(pc.KEY_A)) move.x -= 1;
    if (app.keyboard.isPressed(pc.KEY_D)) move.x += 1;
    if (app.keyboard.isPressed(pc.KEY_E)) move.y += 1;
    if (app.keyboard.isPressed(pc.KEY_Q)) move.y -= 1;
    if (move.lengthSq() > 0) {
        move.normalize().mulScalar(speed * dt);
        camera.translateLocal(move);
    }
};

app.on('update', (dt) => {
    if (state.mode === 'auto') {
        updateAuto(dt);
        return;
    }
    updateFree(dt);
});

for (const other of app.root.findComponents('camera')) {
    other.enabled = other.entity === camera;
}

const revealToolbar = () => toolbar.show();
canvas.addEventListener('pointerdown', revealToolbar, { once: true });
setTimeout(revealToolbar, 1200);
