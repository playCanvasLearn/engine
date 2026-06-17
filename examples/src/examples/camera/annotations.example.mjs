// @config
//
// 适用于给工业设备/产品模型添加“热点标注”，用于讲解结构、功能点或操作位置。

import * as pc from 'playcanvas';
import { Annotation, AnnotationManager } from 'playcanvas/scripts/esm/annotations.mjs';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GsplatLines } from 'playcanvas/scripts/esm/gsplat/gsplat-lines.mjs';
import { GsplatText } from 'playcanvas/scripts/esm/gsplat/gsplat-text.mjs';
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
    font: new pc.Asset('font', 'font', { url: './assets/fonts/courier.json' }),
    shanghai: new pc.Asset(
        'shanghai',
        'texture',
        { url: './assets/hdri/crossfit_gym_1k.hdr' },
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
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.FontHandler, pc.GSplatHandler];

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
    modelRoot.setLocalEulerAngles(0, -70, 0);
    app.root.addChild(modelRoot);

    const modelEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: true
    });
    modelRoot.addChild(modelEntity);

    app.root.syncHierarchy();

    const modelAabb = new pc.BoundingBox();
    let hasAabb = false;
    const worldToModel = new pc.Mat4().copy(modelRoot.getWorldTransform()).invert();
    const modelMin = new pc.Vec3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const modelMax = new pc.Vec3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    const localToModel = new pc.Mat4();
    const corner = new pc.Vec3();

    modelEntity.findComponents('render').forEach((render) => {
        for (const mi of render.meshInstances) {
            const node = mi.node ?? render.entity;
            localToModel.mul2(worldToModel, node.getWorldTransform());

            const meshAabb = mi.mesh?.aabb ?? mi.aabb;
            const aabbMin = meshAabb.getMin();
            const aabbMax = meshAabb.getMax();

            for (let xi = 0; xi < 2; xi++) {
                for (let yi = 0; yi < 2; yi++) {
                    for (let zi = 0; zi < 2; zi++) {
                        corner.set(
                            xi ? aabbMax.x : aabbMin.x,
                            yi ? aabbMax.y : aabbMin.y,
                            zi ? aabbMax.z : aabbMin.z
                        );
                        localToModel.transformPoint(corner, corner);
                        modelMin.min(corner);
                        modelMax.max(corner);
                        hasAabb = true;
                    }
                }
            }
        }
    });

    if (hasAabb) {
        modelAabb.setMinMax(modelMin, modelMax);
    }

    const focusPointModel = hasAabb ? modelAabb.center.clone() : new pc.Vec3(0, 1, 0);
    const focusPoint = focusPointModel.clone();
    modelRoot.getWorldTransform().transformPoint(focusPoint, focusPoint);
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

    const screen = new pc.Entity('screen');
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    const introPanel = new pc.Entity('introPanel');
    introPanel.addComponent('element', {
        type: pc.ELEMENTTYPE_IMAGE,
        anchor: [0, 1, 0, 1],
        pivot: [0, 1],
        width: 500,
        height: 150,
        margin: [24, -24, 0, 0],
        color: new pc.Color(0, 0, 0),
        opacity: 0.65
    });
    screen.addChild(introPanel);

    const introTitle = new pc.Entity('introTitle');
    introTitle.addComponent('element', {
        type: pc.ELEMENTTYPE_TEXT,
        anchor: [0, 1, 1, 1],
        pivot: [0, 1],
        margin: [18, -14, 18, 0],
        height: 28,
        fontAsset: assets.font.id,
        fontSize: 22,
        color: new pc.Color(1, 0.85, 0.25),
        text: '设备标注说明',
        autoHeight: true,
        wrapLines: false
    });
    introPanel.addChild(introTitle);

    const loremIpsum =
        '上海机床厂有限公司主营业务是各类磨床的生产制造，主要产品品种有：外圆磨床、平面磨床、轧辊磨床、曲轴磨床等十大类普通、精密、大型、专用、数控等磨床，其中外圆系列磨床、数控端面外圆磨床、数控车轴磨床、数控曲轴磨床等产品技术处于国内前列。';
    const introText = new pc.Entity('introText');
    introText.addComponent('element', {
        type: pc.ELEMENTTYPE_TEXT,
        anchor: [0, 0, 1, 1],
        pivot: [0, 1],
        margin: [18, 18, 18, -48],
        fontAsset: assets.font.id,
        fontSize: 18,
        lineHeight: 24,
        color: new pc.Color(1, 1, 1),
        text: loremIpsum,
        autoHeight: true,
        wrapLines: true
    });
    introPanel.addChild(introText);
    introText.element.rangeStart = 0;
    introText.element.rangeEnd = 0;

    modelRoot.addComponent('script');
    const manager = modelRoot.script.create(AnnotationManager);

    data.set('data', {
        showIntro: true,
        showLines: true,
        hotspotSize: 25,
        hotspotColor: [0.8, 0.8, 0.8],
        hoverColor: [1, 0.4, 0],
        opacity: 1,
        behindOpacity: 0.25
    });

    app.scene.gsplat.renderer = pc.GSPLAT_RENDERER_AUTO;

    const yellow = new pc.Color(1, 0.9, 0.2, 1);
    const cyan = new pc.Color(0.2, 0.9, 1, 1);
    const gray = new pc.Color(0.5, 0.5, 0.5, 0.8);

    let linesEntity = null;
    const textEntities = [];

    const createTextLabel = (text, x, y, z, rotX, rotY, rotZ, scale) => {
        const textEntity = new pc.Entity(`Text-${text}`);
        textEntity.addComponent('script');
        const textScript = textEntity.script.create(GsplatText);
        textScript.text = text;
        textScript.fontSize = 48;
        textScript.fillStyle = '#00e5ff';
        textScript.strokeStyle = 'rgba(0,0,0,0.9)';
        textScript.strokeWidth = 3;
        textScript.padding = 8;
        textEntity.setLocalPosition(x, y, z);
        textEntity.setLocalEulerAngles(rotX, rotY, rotZ);
        textEntity.setLocalScale(scale, scale, scale);
        modelRoot.addChild(textEntity);
        textEntities.push(textEntity);
        return textEntity;
    };

    const createLinesEntity = () => {
        if (!hasAabb) {
            return;
        }

        destroyLinesEntity();

        linesEntity = new pc.Entity('Lines');
        linesEntity.addComponent('script');
        const lines = linesEntity.script.create(GsplatLines);
        modelRoot.addChild(linesEntity);

        const min = modelAabb.getMin().clone();
        const max = modelAabb.getMax().clone();
        const size = new pc.Vec3(max.x - min.x, max.y - min.y, max.z - min.z);
        const maxDim = Math.max(size.x, size.y, size.z);
        const thickness = Math.max(0.001, maxDim * 0.0015);
        const arrowHeadSize = thickness * 27;
        const offset = maxDim * 0.12;
        const textScale = Math.max(0.15, maxDim * 0.03);

        lines.addAABB(min, max, yellow, thickness * 0.6);

        const midX = (min.x + max.x) * 0.5;
        const midY = (min.y + max.y) * 0.5;

        const yDim = max.y + offset;
        lines.addArrow(new pc.Vec3(min.x, yDim, min.z), new pc.Vec3(max.x, yDim, min.z), cyan, thickness * 0.8, arrowHeadSize);
        lines.addArrow(new pc.Vec3(max.x, yDim, min.z), new pc.Vec3(min.x, yDim, min.z), cyan, thickness * 0.8, arrowHeadSize);
        lines.addLineSimple(new pc.Vec3(min.x, max.y, min.z), new pc.Vec3(min.x, yDim, min.z), gray, thickness * 0.5);
        lines.addLineSimple(new pc.Vec3(max.x, max.y, min.z), new pc.Vec3(max.x, yDim, min.z), gray, thickness * 0.5);

        const xDim = max.x + offset;
        lines.addArrow(new pc.Vec3(xDim, min.y, min.z), new pc.Vec3(xDim, max.y, min.z), cyan, thickness * 0.8, arrowHeadSize);
        lines.addArrow(new pc.Vec3(xDim, max.y, min.z), new pc.Vec3(xDim, min.y, min.z), cyan, thickness * 0.8, arrowHeadSize);
        lines.addLineSimple(new pc.Vec3(max.x, min.y, min.z), new pc.Vec3(xDim, min.y, min.z), gray, thickness * 0.5);
        lines.addLineSimple(new pc.Vec3(max.x, max.y, min.z), new pc.Vec3(xDim, max.y, min.z), gray, thickness * 0.5);

        const zDim = min.z - offset;
        lines.addArrow(new pc.Vec3(midX, min.y, zDim), new pc.Vec3(midX, min.y, max.z), cyan, thickness * 0.8, arrowHeadSize);
        lines.addArrow(new pc.Vec3(midX, min.y, max.z), new pc.Vec3(midX, min.y, zDim), cyan, thickness * 0.8, arrowHeadSize);
        lines.addLineSimple(new pc.Vec3(midX, min.y, min.z), new pc.Vec3(midX, min.y, zDim), gray, thickness * 0.5);

        createTextLabel(size.x.toFixed(2), midX, yDim + offset * 0.15, min.z, -90, 180, 0, textScale);
        createTextLabel(size.y.toFixed(2), xDim + offset * 0.15, midY, min.z, 0, -180, -90, textScale);
        createTextLabel(size.z.toFixed(2), midX, min.y - offset * 0.1, (zDim + max.z) * 0.5, -90, -90, 0, textScale);
    };

    const destroyLinesEntity = () => {
        if (linesEntity) {
            linesEntity.destroy();
            linesEntity = null;
        }
        for (const textEntity of textEntities) {
            textEntity.destroy();
        }
        textEntities.length = 0;
    };

    if (data.get('data.showLines') === true) {
        createLinesEntity();
    }

    data.on('*:set', (path, value) => {
        const prop = path.split('.')[1];
        if (prop === 'showIntro') {
            introPanel.enabled = value === true;
            if (value === true) {
                introText.element.rangeStart = 0;
                introText.element.rangeEnd = 0;
            }
        } else if (prop === 'showLines') {
            if (value === true) {
                createLinesEntity();
            } else {
                destroyLinesEntity();
            }
        } else if (prop === 'hotspotSize') {
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

    const c = focusPointModel;
    const he = hasAabb ? modelAabb.halfExtents.clone() : new pc.Vec3(1, 1, 1);
    const f = 1.15;

    const annotations = [
        {
            pos: new pc.Vec3(c.x, c.y + he.y * f, c.z),
            title: '顶部结构',
            text: '顶部区域的关键结构位置示例。'
        },
        {
            pos: new pc.Vec3(c.x + he.x * f, c.y, c.z),
            title: '正面结构',
            text: '正面区域的关键结构位置示例。'
        },
        {
            pos: new pc.Vec3(c.x, c.y, c.z + he.z * f),
            title: '侧面结构',
            text: '侧面区域的关键结构位置示例。'
        },
        {
            pos: new pc.Vec3(c.x - he.x * f, c.y, c.z),
            title: '背面结构',
            text: '背面区域的关键结构位置示例。'
        }
    ];

    annotations.forEach(({ pos, title, text }, index) => {
        modelRoot.addChild(createAnnotation(pos, String(index + 1), title, text));
    });

    const typewriterId = setInterval(() => {
        if (data.get('data.showIntro') !== true) {
            return;
        }

        introText.element.rangeEnd += 1;
        if (introText.element.rangeEnd >= loremIpsum.length) {
            introText.element.rangeEnd = 0;
        }
    }, 55);
    app.on('destroy', () => clearInterval(typewriterId));

    const shadowCatcher = new pc.Entity('shadowCatcher');
    shadowCatcher.addComponent('script');
    shadowCatcher.script.create(ShadowCatcher, {
        properties: {
            scale: new pc.Vec3(sceneSize * 7.5, sceneSize * 7.5, sceneSize * 7.5)
        }
    });
    app.root.addChild(shadowCatcher);
});
