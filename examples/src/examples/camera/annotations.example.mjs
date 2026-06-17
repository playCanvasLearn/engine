// @config

import * as pc from 'playcanvas';
import { Annotation, AnnotationManager } from 'playcanvas/scripts/esm/annotations.mjs';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { ShadowCatcher } from 'playcanvas/scripts/esm/shadow-catcher.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
});

pc.basisInitialize({
    glueUrl: './assets/wasm/basis/basis.wasm.js',
    wasmUrl: './assets/wasm/basis/basis.wasm.wasm',
    fallbackUrl: './assets/wasm/basis/basis.js'
});

const assets = {
    model: new pc.Asset('Sk7420A_260_1', 'container', { url: './assets/scene/models/Sk7420A_260_1.glb' }),
    shanghai: new pc.Asset(
        'shanghai',
        'texture',
        { url: './assets/hdri/shanghai-riverside-4k.hdr' },
        { mipmaps: false }
    )
};

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
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    const applyHdri = (source) => {
        const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
        app.scene.skybox = skybox;

        const lighting = pc.EnvLighting.generateLightingSource(source);
        const envAtlas = pc.EnvLighting.generateAtlas(lighting);
        lighting.destroy();
        app.scene.envAtlas = envAtlas;
    };

    device.on('devicerestored', () => {
        applyHdri(assets.shanghai.resource);
    });

    applyHdri(assets.shanghai.resource);

    app.scene.sky.type = pc.SKYTYPE_DOME;
    app.scene.sky.node.setLocalScale(new pc.Vec3(50, 50, 50));
    app.scene.sky.node.setLocalPosition(new pc.Vec3(0, 0, 0));
    app.scene.sky.center = new pc.Vec3(0, 0.1, 0);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9),
        farClip: 500,
        toneMapping: pc.TONEMAP_ACES2
    });
    camera.addComponent('script');
    app.root.addChild(camera);

    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        castShadows: true,
        shadowDistance: 30,
        shadowIntensity: 0.6,
        shadowResolution: 1024,
        shadowType: pc.SHADOW_VSM_16F
    });
    app.root.addChild(light);

    const modelRoot = new pc.Entity('model');
    app.root.addChild(modelRoot);

    const modelEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: true
    });
    modelRoot.addChild(modelEntity);

    const modelAabb = new pc.BoundingBox();
    let hasAabb = false;
    modelEntity.findComponents('render').forEach((render) => {
        for (const mi of render.meshInstances) {
            if (!hasAabb) {
                modelAabb.copy(mi.aabb);
                hasAabb = true;
            } else {
                modelAabb.add(mi.aabb);
            }
        }
    });

    const focusPoint = hasAabb ? modelAabb.center.clone() : new pc.Vec3(0, 1, 0);
    const sceneSize = hasAabb ? Math.max(modelAabb.halfExtents.x, modelAabb.halfExtents.y, modelAabb.halfExtents.z) * 2 : 2;

    camera.setPosition(
        focusPoint.x + sceneSize * 2.0,
        focusPoint.y + sceneSize * 1.4,
        focusPoint.z + sceneSize * 2.0
    );

    camera.script.create(CameraControls, {
        properties: {
            focusPoint,
            pitchRange: new pc.Vec2(-90, 0),
            sceneSize,
            zoomRange: new pc.Vec2(sceneSize * 1.5, sceneSize * 8.0)
        }
    });

    modelRoot.addComponent('script');
    const manager = modelRoot.script.create(AnnotationManager);

    data.set('data', {
        hotspotSize: 25,
        hotspotColor: [0.8, 0.8, 0.8],
        hoverColor: [1, 0.4, 0],
        opacity: 1,
        behindOpacity: 0.25
    });

    data.on('*:set', (path, value) => {
        const prop = path.split('.')[1];
        if (prop === 'hotspotSize') {
            manager.hotspotSize = value;
        } else if (prop === 'hotspotColor' || prop === 'hoverColor') {
            manager[prop] = new pc.Color(value[0], value[1], value[2]);
        } else if (prop === 'opacity') {
            manager.opacity = value;
        } else if (prop === 'behindOpacity') {
            manager.behindOpacity = value;
        }
    });

    const createAnnotation = (position, label, title, text) => {
        const entity = new pc.Entity(`annotation${label}`);
        entity.setLocalPosition(position);
        entity.addComponent('script');
        entity.script.create(Annotation, {
            properties: {
                label,
                title,
                text
            }
        });
        return entity;
    };

    const c = focusPoint;
    const he = hasAabb ? modelAabb.halfExtents.clone() : new pc.Vec3(1, 1, 1);
    const f = 1.05;

    const annotations = [
        {
            pos: new pc.Vec3(c.x, c.y + he.y * f, c.z),
            title: '顶部结构',
            text: '顶部区域的关键结构位置示例。'
        },
        {
            pos: new pc.Vec3(c.x + he.x * f, c.y, c.z),
            title: '侧面结构',
            text: '侧面区域的关键结构位置示例。'
        },
        {
            pos: new pc.Vec3(c.x, c.y, c.z + he.z * f),
            title: '前部结构',
            text: '前部区域的关键结构位置示例。'
        },
        {
            pos: new pc.Vec3(c.x - he.x * f, c.y, c.z - he.z * f),
            title: '后部结构',
            text: '后部区域的关键结构位置示例。'
        }
    ];

    annotations.forEach(({ pos, title, text }, index) => {
        modelRoot.addChild(createAnnotation(pos, String(index + 1), title, text));
    });

    const shadowCatcher = new pc.Entity('shadowCatcher');
    shadowCatcher.addComponent('script');
    shadowCatcher.script.create(ShadowCatcher, {
        properties: {
            scale: new pc.Vec3(sceneSize * 7.5, sceneSize * 7.5, sceneSize * 7.5)
        }
    });
    app.root.addChild(shadowCatcher);
});
