// @config
//
// 机床展览馆 - 支持上一个/下一个切换与淡入/淡出动画。

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

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

// Draco decoder for compressed GLB files
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
});

const MODEL_COUNT = 3;

const modelMeta = [
    { title: 'Arm Assembly 260', desc: 'Compact rotary actuator assembly for precision positioning in automated manufacturing lines.' },
    { title: 'Arm Assembly 750', desc: 'Heavy-duty rotary actuator with extended reach for large-scale industrial automation.' },
    { title: 'Classical Statue', desc: 'Detailed plaster cast reproduction of a classical marble sculpture.' }
];

const modelSlugs = ['260', '750', 'statue'];
const modelFilenames = ['Sk7420A_260_1.glb', 'Sk7420A_750_1.glb', 'main_draco.glb'];
const modelYaws = [-30, 0, 30];

const MODEL_CENTER = new pc.Vec3(0, 0, 0);

const FADE_OUT_DURATION = 0.5;
const FADE_IN_DURATION = 1.5;

const setOpacity = (entity, opacity) => {
    const render = entity.render;
    if (!render) return;
    for (const meshInst of render.meshInstances) {
        const mat = meshInst.material;
        if (mat) {
            mat.opacity = opacity;
            mat.update();
        }
    }
};

const assets = {
    hdri: new pc.Asset('hdri', 'texture', { url: './assets/hdri/crossfit_gym_1k.hdr' }, { mipmaps: false }),
    orbit: new pc.Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' })
};

for (let i = 0; i < MODEL_COUNT; i++) {
    assets[modelSlugs[i]] = new pc.Asset(modelMeta[i].title, 'container', {
        url: `./assets/scene/models/${modelFilenames[i]}`
    });
}

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // --- HDR environment ---
    const applyHdri = (source) => {
        const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
        app.scene.skybox = skybox;
        app.scene.skyboxIntensity = 1;
        const lighting = pc.EnvLighting.generateLightingSource(skybox);
        const envAtlas = pc.EnvLighting.generateAtlas(lighting);
        lighting.destroy();
        app.scene.envAtlas = envAtlas;
    };
    applyHdri(assets.hdri.resource);

    // --- Create camera ---
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);

    const ORBIT_PIVOT = MODEL_CENTER.clone();
    const ORBIT_DISTANCE = 4;
    const ORBIT_INITIAL_YAW = 28;
    const ORBIT_INITIAL_PITCH = -15;

    camera.addComponent('script');
    const orbitCam = camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 30,
            frameOnStart: false
        }
    });
    if (orbitCam) {
        orbitCam.pivotPoint.copy(ORBIT_PIVOT);
        orbitCam.reset(ORBIT_INITIAL_YAW, ORBIT_INITIAL_PITCH, ORBIT_DISTANCE);
        orbitCam._updatePosition();
    }
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');

    // --- Create model entities ---
    const modelEntities = [];
    for (let i = 0; i < MODEL_COUNT; i++) {
        const entity = assets[modelSlugs[i]].resource.instantiateRenderEntity();
        entity.setLocalPosition(MODEL_CENTER);
        entity.setLocalEulerAngles(0, modelYaws[i], 0);
        app.root.addChild(entity);

        const render = entity.render;
        if (render) {
            for (const meshInst of render.meshInstances) {
                const mat = meshInst.material;
                if (mat) {
                    const clone = mat.clone();
                    clone.blendType = pc.BLEND_NORMAL;
                    clone.depthWrite = true;
                    meshInst.material = clone;
                }
            }
        }

        entity.enabled = i === 0;
        modelEntities.push(entity);
    }

    // --- Post-processing ---
    const cameraFrame = new pc.CameraFrame(app, camera.camera);
    cameraFrame.bloom.enabled = true;
    cameraFrame.bloom.intensity = 0.1;
    cameraFrame.bloom.blurLevel = 20;
    cameraFrame.vignette.enabled = true;
    cameraFrame.vignette.inner = 0.2;
    cameraFrame.vignette.outer = 1.0;
    cameraFrame.vignette.curvature = 0.5;
    cameraFrame.vignette.intensity = 0.4;
    cameraFrame.update();

    // --- UI overlay ---
    const style = document.createElement('style');
    style.textContent = `
        #gallery-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; user-select: none; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; }
        #gallery-info { position: absolute; top: 24px; right: 24px; background: rgba(30,30,30,0.5); color: #fff; padding: 16px; border-radius: 5px; backdrop-filter: blur(10px); width: 320px; max-width: 90%; pointer-events: auto; }
        #gallery-info h1 { font-size: 28px; margin: 0 0 4px 0; font-weight: 300; }
        #gallery-info p { margin: 4px 0; font-size: 11px; opacity: 0.6; line-height: 1.4; }
        #gallery-info .desc { opacity: 1; font-size: 13px; line-height: 1.3; }
        #gallery-nav { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; gap: 16px; pointer-events: auto; }
        #gallery-nav button { background: rgba(60,60,60,0.9); color: #fff; border: none; border-radius: 24px; padding: 10px 20px; cursor: pointer; font-size: 14px; backdrop-filter: blur(10px); opacity: 0.8; transition: all 0.15s; pointer-events: auto; display: flex; align-items: center; gap: 8px; }
        #gallery-nav button:hover { opacity: 1; }
        #gallery-nav button .label { display: none; }
        #gallery-nav button:hover .label { display: inline; }
        .gallery-counter { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.4); font-size: 12px; pointer-events: none; letter-spacing: 2px; }
        @media (max-width: 800px) {
            #gallery-info { top: 0; right: 0; width: 100%; max-width: 100%; border-radius: 0; }
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'gallery-overlay';

    const infoPanel = document.createElement('div');
    infoPanel.id = 'gallery-info';
    infoPanel.innerHTML = `
        <h1 id="g-title"></h1>
        <p class="desc" id="g-desc"></p>
    `;
    overlay.appendChild(infoPanel);

    const counter = document.createElement('div');
    counter.className = 'gallery-counter';
    counter.id = 'g-counter';
    overlay.appendChild(counter);

    const nav = document.createElement('div');
    nav.id = 'gallery-nav';
    nav.innerHTML = `
        <button id="g-prev"><span class="label">previous</span> &#9664;</button>
        <button id="g-next">&#9654; <span class="label">next</span></button>
    `;
    overlay.appendChild(nav);
    document.body.appendChild(overlay);

    const updateInfo = (index) => {
        const m = modelMeta[index];
        document.getElementById('g-title').textContent = m.title;
        document.getElementById('g-desc').textContent = m.desc;
        document.getElementById('g-counter').textContent = `${index + 1} / ${MODEL_COUNT}`;
    };

    // --- Carousel state ---
    let currentIndex = 0;
    let transitioning = false;
    let animTime = 0;
    let animMode = 0; // 0=fade in, 1=fade out

    const showModel = (index) => {
        modelEntities.forEach((e, i) => {
            e.enabled = i === index;
        });
        if (modelEntities[index]) {
            setOpacity(modelEntities[index], 0);
        }
    };

    const startTransition = (newIndex) => {
        if (transitioning || newIndex === currentIndex) return;
        transitioning = true;
        animTime = 0;
        animMode = 1;
        currentIndex = newIndex;
    };

    const onPrev = () => {
        startTransition((currentIndex - 1 + MODEL_COUNT) % MODEL_COUNT);
    };

    const onNext = () => {
        startTransition((currentIndex + 1) % MODEL_COUNT);
    };

    document.getElementById('g-prev').addEventListener('click', onPrev);
    document.getElementById('g-next').addEventListener('click', onNext);

    updateInfo(0);

    // --- Auto-rotation ---
    let autoRotate = true;
    let lastInteraction = 0;
    const AUTO_ROTATE_DELAY = 3000;
    const AUTO_ROTATE_SPEED = 15;

    const onInteraction = () => {
        autoRotate = false;
        lastInteraction = Date.now();
    };

    if (app.mouse) {
        app.mouse.on('mousedown', onInteraction);
        app.mouse.on('mousewheel', onInteraction);
    }
    if (app.touch) {
        app.touch.on('touchstart', onInteraction);
    }

    // --- Update loop ---
    app.on('update', (dt) => {
        if (transitioning) {
            animTime += dt;

            if (animMode === 1) {
                // Fade out current
                const t = Math.min(1, animTime / FADE_OUT_DURATION);
                const prevIdx = currentIndex === 0 ? MODEL_COUNT - 1 : currentIndex - 1;
                if (modelEntities[prevIdx]) {
                    setOpacity(modelEntities[prevIdx], 1 - t);
                }
                if (animTime >= FADE_OUT_DURATION) {
                    showModel(currentIndex);
                    animTime = 0;
                    animMode = 0;
                    updateInfo(currentIndex);
                }
            } else {
                // Fade in new
                const t = Math.min(1, animTime / FADE_IN_DURATION);
                if (modelEntities[currentIndex]) {
                    setOpacity(modelEntities[currentIndex], t);
                }
                if (animTime >= FADE_IN_DURATION) {
                    if (modelEntities[currentIndex]) {
                        setOpacity(modelEntities[currentIndex], 1);
                    }
                    transitioning = false;
                }
            }
        }

        // Auto-rotate
        if (!autoRotate && (Date.now() - lastInteraction) > AUTO_ROTATE_DELAY) {
            autoRotate = true;
        }
        if (autoRotate) {
            const oc = camera.script?.orbitCamera;
            if (oc && !transitioning) {
                oc.yaw += AUTO_ROTATE_SPEED * dt;
                oc._updatePosition();
            }
        }
    });

    // Cleanup UI on destroy
    app.on('destroy', () => {
        overlay.remove();
        style.remove();
    });
});
