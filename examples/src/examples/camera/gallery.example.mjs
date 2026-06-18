// @config
//
// 设备展览馆 - 基于高斯泼溅的雕塑艺术画廊，支持上一个/下一个切换与淡入/淡出动画。

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

import shaderGlslVert from './shader.glsl.vert';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false
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
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const statueMeta = [
    { title: 'Narcissus', artist: 'Possibly by Valerio Cioli (about 1529-99)', date: 'About 1560', description: 'During the Renaissance, it was common practice to re-work ancient Roman sculpture. Narcissus was long thought to be an example of this, but instead it was possibly made by a sculptor and restorer called Valerio Cioli. A Greek myth tells how Narcissus fell in love with his reflection in a pool. This made him a suitable subject for garden sculpture.', origin: 'Italy, probably Florence', material: 'Marble' },
    { title: 'Angel', artist: 'Matteo Civatali (1435-1501)', date: 'About 1496', description: 'Civitali\'s original marble angels are in Lucca Cathedral. They once flanked a tabernacle made to house the sanctified bread used during the Mass. The graceful figures would have appealed to audiences in the 19th century, when the casts were made.', origin: 'Lucca, Italy', material: 'Marble' },
    { title: 'Angel with Candlestick', artist: 'Luca della Robbia (1399/1400-1482)', date: 'About 1448', description: 'Della Robbia\'s angels were commissioned for Florence Cathedral. They originally stood either side of a tabernacle, which housed the sanctified bread used in the Mass. The plaster copies displayed here do not reproduce the color of the orginals. The angels in Florence are glazed in white, their eyes picked out in blue and the borders of their robes colored and gilded.', origin: 'Florence, Italy', material: 'White-glazed terracotta' },
    { title: 'Bust of Apollonio Massa', artist: 'Alessandro Vittoria (about 1525-1608)', date: 'Before 1572', description: 'Apollonio Massa, a physician, is depicted wearing classical-style drapery. This cast was taken from Vittoria\'s terracotta model for a marble portrait of Massa. Vittoria was a leading architect and sculptor in 16th-century Venice, renowned for his portraits of important contemporary patrons.', origin: 'Venice, Italy', material: 'Terracotta' },
    { title: 'Boy Blowing a Trumpet', artist: 'Pietro Tacca (1577-1640)', date: '1620', description: 'Electrotyping was another method for making copies of works of art. It used electricity to deposit copper particles into a mould. This electrotype reproduces a bronze figure in the State Hermitage Museum in St Petersburg. The figure is thought to have originally come from a fountain in the garden of the Palazzo della Stufa in Florence.', origin: 'Florence, Italy', material: 'Bronze' },
    { title: 'Kneeling Angel', artist: 'Silvio Cosini (1495-1549)', date: 'Mid sixteenth century', description: 'The positions of the arms and hands indicate that this and the companion angel originally functioned as candleholders on either side of an altar. Candles were used during the Mass to illuminate the altar and evoke the symbolism of Christ as light. They were purchased from the Palazzo Strozzi in Florence and probably originated from a church under the patronage of the Strozzi family, who were powerful bankers.', origin: 'Florence, Italy', material: 'Carved marble' },
    { title: 'St Peter', artist: 'Unknown', date: 'About 1510-20', description: 'Medieval Christians felt a deep affinity for the saints. They saw them as heavenly helpers, pleading with God to be merciful towards mankind. One of the most popular saints was St Peter, the first Pope. He was often shown holding the keys to Heaven and wearing his papal tiara. This figure was originally brightly painted. It would probably have been set in a church, on a console or ledge on one of the nave columns, with candles burning before it.', origin: 'Southern Netherlands', material: 'Oak' }
];

const statueSlugs = [
    'narcissus', 'angel', 'angel-with-candlestick', 'massa',
    'trumpet', 'kneeling-angel', 'st-peter'
];

const statueFilenames = [
    'narcissus.compressed.ply', 'angel.compressed.ply', 'angel-with-candlestick.compressed.ply',
    'massa.compressed.ply', 'trumpet.compressed.ply', 'kneeling-angel.compressed.ply',
    'st-peter.compressed.ply'
];

const STATUE_COUNT = statueMeta.length;

// Place statues in a gentle semicircle
const statuePositions = [];
const STATUE_RADIUS = 4;
for (let i = 0; i < STATUE_COUNT; i++) {
    const angle = ((i / (STATUE_COUNT - 1)) - 0.5) * Math.PI * 0.7;
    statuePositions.push(new pc.Vec3(
        Math.sin(angle) * STATUE_RADIUS,
        0,
        Math.cos(angle) * STATUE_RADIUS
    ));
}

const LERP_SPEED = 2;
const FADE_OUT_DURATION = 0.5;
const FADE_IN_DURATION = 1.5;

const sceneMat = app.scene.gsplat.material;

const applyCustomShader = (enabled) => {
    if (enabled) {
        sceneMat.getShaderChunks('glsl').set('gsplatModifyVS', shaderGlslVert);
        sceneMat.getShaderChunks('wgsl').set('gsplatModifyVS', shaderWgslVert);
    } else {
        sceneMat.getShaderChunks('glsl').delete('gsplatModifyVS');
        sceneMat.getShaderChunks('wgsl').delete('gsplatModifyVS');
    }
    sceneMat.update();
};

const assets = {
    orbit: new pc.Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' })
};

for (let i = 0; i < STATUE_COUNT; i++) {
    assets[statueSlugs[i]] = new pc.Asset(statueMeta[i].title, 'gsplat', {
        url: `./assets/splats/${statueFilenames[i]}`
    });
}

// Cubemap face textures for the environment
const cubemapFaces = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'];
for (const face of cubemapFaces) {
    assets[`cubemap_${face}`] = new pc.Asset(`cubemap_${face}`, 'texture', {
        url: `./assets/cubemaps/statues/${face}.webp`
    });
}

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // --- Cubemap skybox ---
    const faceAssets = cubemapFaces.map(f => assets[`cubemap_${f}`].resource);
    const cubemapTexture = new pc.Texture(device, {
        cubemap: true,
        width: faceAssets[0].width,
        height: faceAssets[0].height,
        format: pc.PIXELFORMAT_SRGBA8,
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    cubemapTexture.setSource(cubemapFaces.map(f => assets[`cubemap_${f}`].resource.getSource()));

    app.scene.skybox = cubemapTexture;
    app.scene.skyboxIntensity = 1;
    app.scene.sky.type = pc.SKYTYPE_DOME;
    app.scene.sky.node.setLocalScale(new pc.Vec3(50, 50, 50));
    app.scene.sky.center = new pc.Vec3(0, 0.1, 0);

    // --- Environment lighting from skybox ---
    const lighting = pc.EnvLighting.generateLightingSource(cubemapTexture);
    const envAtlas = pc.EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    app.scene.envAtlas = envAtlas;

    // --- Create camera ---
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.02, 0.02, 0.04),
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);

    const focusPoint = statuePositions[0].clone();
    focusPoint.y = 0.8;

    camera.addComponent('script');
    camera.script.create(CameraControls, {
        properties: {
            focusPoint,
            sceneSize: 4,
            pitchRange: new pc.Vec2(-30, 60),
            zoomRange: new pc.Vec2(1, 8),
            distance: 5
        }
    });

    // --- Create statue entities ---
    const statueEntities = [];
    for (let i = 0; i < STATUE_COUNT; i++) {
        const entity = new pc.Entity(statueMeta[i].title);
        entity.addComponent('gsplat', {
            asset: assets[statueSlugs[i]],
            enabled: i === 0
        });
        entity.setLocalPosition(statuePositions[i]);
        const angle = Math.atan2(statuePositions[i].x, statuePositions[i].z);
        entity.setLocalEulerAngles(0, -angle * 180 / Math.PI, 0);
        app.root.addChild(entity);
        statueEntities.push(entity);
    }

    // --- Apply custom shader ---
    applyCustomShader(true);
    sceneMat.setParameter('uGalleryTime', 1.0);
    sceneMat.setParameter('uGalleryMode', 0.0);
    sceneMat.update();

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
        #gallery-info h2 { font-size: 11px; margin: 0 0 4px 0; opacity: 0.6; font-weight: 300; }
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
            #gallery-info .right-col { display: none; }
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'gallery-overlay';

    const infoPanel = document.createElement('div');
    infoPanel.id = 'gallery-info';
    infoPanel.innerHTML = `
        <div class="full-width">
            <h1 id="g-title"></h1>
            <h2 id="g-artist"></h2>
            <h2 id="g-date"></h2>
        </div>
        <div style="display:flex;">
            <div style="flex:3;padding-right:8px;">
                <p class="desc" id="g-desc"></p>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;" class="right-col">
                <p id="g-origin"></p>
                <p id="g-material"></p>
            </div>
        </div>
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
        const m = statueMeta[index];
        document.getElementById('g-title').textContent = m.title;
        document.getElementById('g-artist').textContent = `Artist: ${m.artist}`;
        document.getElementById('g-date').textContent = `Date: ${m.date}`;
        document.getElementById('g-desc').textContent = m.description;
        document.getElementById('g-origin').textContent = `Origin: ${m.origin}`;
        document.getElementById('g-material').textContent = `Material: ${m.material}`;
        document.getElementById('g-counter').textContent = `${index + 1} / ${STATUE_COUNT}`;
    };

    // --- Carousel state ---
    let currentIndex = 0;
    let transitioning = false;
    let animTime = 0;
    let animMode = 0; // 0=fade in, 1=fade out

    const showStatue = (index) => {
        statueEntities.forEach((e, i) => {
            e.gsplat.enabled = i === index;
        });
    };

    const startTransition = (newIndex) => {
        if (transitioning || newIndex === currentIndex) return;
        transitioning = true;
        animTime = 0;
        animMode = 1; // fade out first
        currentIndex = newIndex;
    };

    const onPrev = () => {
        startTransition((currentIndex - 1 + STATUE_COUNT) % STATUE_COUNT);
    };

    const onNext = () => {
        startTransition((currentIndex + 1) % STATUE_COUNT);
    };

    document.getElementById('g-prev').addEventListener('click', onPrev);
    document.getElementById('g-next').addEventListener('click', onNext);

    // Initial info
    updateInfo(0);

    // Initial fade-in is already handled by uGalleryTime=1, uGalleryMode=0 from above

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
        // Transition animation
        if (transitioning) {
            animTime += dt;
            sceneMat.setParameter('uGalleryTime', animTime);
            sceneMat.setParameter('uGalleryMode', animMode);
            sceneMat.update();

            if (animMode === 1) {
                // Fading out
                if (animTime >= FADE_OUT_DURATION) {
                    // Switch statue
                    showStatue(currentIndex);
                    animTime = 0;
                    animMode = 0;
                    updateInfo(currentIndex);
                    sceneMat.setParameter('uGalleryTime', 0);
                    sceneMat.setParameter('uGalleryMode', 0);
                    sceneMat.update();
                }
            } else {
                // Fading in
                if (animTime >= FADE_IN_DURATION) {
                    transitioning = false;
                    sceneMat.setParameter('uGalleryTime', 1.0);
                    sceneMat.setParameter('uGalleryMode', 0);
                    sceneMat.update();
                }
            }
        }

        // Lerp camera focus point toward current statue
        const targetFocus = statuePositions[currentIndex].clone();
        targetFocus.y = 0.8;
        focusPoint.lerp(focusPoint, targetFocus, Math.min(1, LERP_SPEED * dt));

        // Auto-rotate
        if (!autoRotate && (Date.now() - lastInteraction) > AUTO_ROTATE_DELAY) {
            autoRotate = true;
        }
        if (autoRotate) {
            const controls = camera.script?.get(CameraControls);
            if (controls && !transitioning) {
                controls.yaw += AUTO_ROTATE_SPEED * dt;
            }
        }
    });

    // Cleanup UI on destroy
    app.on('destroy', () => {
        overlay.remove();
        style.remove();
    });
});
