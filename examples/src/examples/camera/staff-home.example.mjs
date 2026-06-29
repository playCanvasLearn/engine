// @config
//
// 职工之家 - 基于 Hotel Showcase 导出资源重构为 PlayCanvas Engine 示例加载器。

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.script.legacy = false;

const BASE_URL = './assets/scene/staff-home/';
const CONFIG_URL = `${BASE_URL}config.json`;
const SCENE_NAME = '2531838.json';

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

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    pc.AnimationComponentSystem,
    pc.AnimComponentSystem,
    pc.ModelComponentSystem,
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.AudioSourceComponentSystem,
    pc.SoundComponentSystem,
    pc.AudioListenerComponentSystem,
    pc.ParticleSystemComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem,
    pc.ButtonComponentSystem,
    pc.ScrollViewComponentSystem,
    pc.ScrollbarComponentSystem,
    pc.SpriteComponentSystem,
    pc.LayoutGroupComponentSystem,
    pc.LayoutChildComponentSystem,
    pc.ZoneComponentSystem,
    pc.GSplatComponentSystem
].filter(Boolean);
createOptions.resourceHandlers = [
    pc.RenderHandler,
    pc.AnimationHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler,
    pc.ModelHandler,
    pc.MaterialHandler,
    pc.TextureHandler,
    pc.TextHandler,
    pc.JsonHandler,
    pc.AudioHandler,
    pc.ScriptHandler,
    pc.SceneHandler,
    pc.CubemapHandler,
    pc.HtmlHandler,
    pc.CssHandler,
    pc.ShaderHandler,
    pc.HierarchyHandler,
    pc.FolderHandler,
    pc.FontHandler,
    pc.BinaryHandler,
    pc.TextureAtlasHandler,
    pc.SpriteHandler,
    pc.TemplateHandler,
    pc.ContainerHandler,
    pc.GSplatHandler
].filter(Boolean);

createOptions.elementInput = new pc.ElementInput(canvas, {
    useMouse: INPUT_SETTINGS.useMouse,
    useTouch: INPUT_SETTINGS.useTouch
});
createOptions.keyboard = INPUT_SETTINGS.useKeyboard ? new pc.Keyboard(window) : null;
createOptions.mouse = INPUT_SETTINGS.useMouse ? new pc.Mouse(canvas) : null;
createOptions.gamepads = INPUT_SETTINGS.useGamepads ? new pc.GamePads() : null;
createOptions.touch = INPUT_SETTINGS.useTouch && pc.platform.touch ? new pc.TouchDevice(canvas) : null;
createOptions.assetPrefix = BASE_URL;
createOptions.scriptPrefix = BASE_URL;
createOptions.scriptsOrder = [];
createOptions.soundManager = new pc.SoundManager();
createOptions.lightmapper = pc.Lightmapper;
createOptions.batchManager = pc.BatchManager;
createOptions.xr = pc.XrManager;

const app = new pc.AppBase(canvas);
app.init(createOptions);

const ensureCanvasCss = () => {
    const style = document.createElement('style');
    style.textContent = `@media screen and (min-aspect-ratio: ${app._width}/${app._height}) {
        #application-canvas.fill-mode-KEEP_ASPECT {
            width: auto;
            height: 100%;
            margin: 0 auto;
        }
    }`;
    document.head.appendChild(style);

    if (canvas.classList) {
        canvas.classList.add(`fill-mode-${app.fillMode}`);
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
    const renders = app.root.findComponents('render');
    for (const render of renders) {
        for (const mi of render.meshInstances) {
            if (!mi?.aabb) continue;
            if (!hasBounds) {
                aabb.copy(mi.aabb);
                hasBounds = true;
            } else {
                aabb.add(mi.aabb);
            }
        }
    }
    if (!hasBounds) {
        aabb.center.set(0, 1.5, 0);
        aabb.halfExtents.set(10, 5, 10);
    }
    return aabb;
};

const createPatchedConfigUrl = async () => {
    const response = await fetch(CONFIG_URL);
    if (!response.ok) {
        throw new Error(`Failed to load config: ${CONFIG_URL}`);
    }
    const config = await response.json();
    const appProps = config.application_properties;
    if (appProps && typeof appProps === 'object') {
        appProps.libraries = [];
        appProps.use3dPhysics = false;
        appProps.useLegacyAmmoPhysics = false;
        appProps.scripts = [];
    }
    const blob = new Blob([JSON.stringify(config)], { type: 'application/json' });
    return URL.createObjectURL(blob);
};

const configureApp = () => new Promise((resolve, reject) => {
    createPatchedConfigUrl().then((url) => {
        app.configure(url, (err) => {
            URL.revokeObjectURL(url);
            if (err) {
                reject(err);
                return;
            }
            resolve(true);
        });
    }).catch(reject);
});

const preloadApp = () => new Promise((resolve, reject) => {
    app.preload((err) => {
        if (err) {
            reject(err);
            return;
        }
        resolve(true);
    });
});

const loadScene = () => new Promise((resolve, reject) => {
    app.scenes.loadScene(SCENE_NAME, (err) => {
        if (err) {
            reject(err);
            return;
        }
        resolve(true);
    });
});

await configureApp();
ensureCanvasCss();
resize();
await preloadApp();
await loadScene();
app.start();

const pickSceneCameraEntity = () => {
    const cameras = app.root.findComponents('camera');
    if (!cameras?.length) return null;

    const preferred = cameras.find((c) => /camera/i.test(c.entity.name)) ?? cameras[0];
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
