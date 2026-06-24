// @config
//
// 适用于给工业设备/产品模型添加“热点标注”，用于讲解结构、功能点或操作设备指导等。
// @flag NO_DEVICE_SELECTOR

import * as pc from 'playcanvas';
import { Annotation, AnnotationManager } from 'playcanvas/scripts/esm/annotations.mjs';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GsplatLines } from 'playcanvas/scripts/esm/gsplat/gsplat-lines.mjs';
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
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.GSplatHandler];

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
    modelRoot.setLocalEulerAngles(0, -45, 0);
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

    const loremIpsum =
        '上海机床厂有限公司主营业务是各类磨床的生产制造，主要产品品种有：外圆磨床、平面磨床、轧辊磨床、曲轴磨床等十大类普通、精密、大型、专用、数控等磨床，其中外圆系列磨床、数控端面外圆磨床、数控车轴磨床、数控曲轴磨床等产品技术处于国内前列。公司在做强磨床产品，保持国内重要地位的同时，逐步扩充磨床类以外的产品，还增加了成型机床的制造和销售，主要产品有QC12Y系列剪板机、WC67Y系列板料折弯机、PS系列数控板料折弯机等，通过产品门类的扩张提升了企业的经营规模。公司技术力量雄厚，建有产品研发中心——上海磨床研究所。该所是磨床行业的技术权威研究机构，全国金属切削机床标准化技术委员会磨床分会设立在该所，在技术进步、行业发展、标准制定等方面起到带头、引导作用。该所主编的《精密制造与自动化》杂志是磨床行业的专业性刊物。同时，拥有一批包括工程院院士、教授级高级工程师在内的专业技术人员，为公司产品研发提供技术支持。 自2009年起，公司紧紧抓住国家重大专项立项机遇，已先后获得国家“高档数控机床和基础制造装备” 科技重大专项课题十项，通过国家验收九项，为企业进一步调结构、走高端，赶超国际先进水平、实现替代进口目标奠定了坚实的基础。  公司以“塑造人品，制造精品”的质量理念贯穿于生产、经营、管理等全过程，相继获得：出口管理一类企业、上海市文明单位、上海市质量管理奖、上海市高新技术企业、中国最具市场竞争力品牌、现代化管理企业、中国名牌、自主创新品牌、上海名牌等殊荣。 公司通过不断自主创新，瞄准国际磨床的先进水平，以提升国内机床行业的技术品位为己任，推动产品升级换代。';

    const introPanel = document.createElement('div');
    introPanel.style.cssText = `
        position: absolute;
        left: 24px;
        top: 50%;
        transform: translateY(-50%);
        width: 373px;
        height: 240px;
        background: rgba(0, 0, 0, 0.65);
        box-sizing: border-box;
        padding: 18px;
        overflow: hidden;
        pointer-events: none;
        z-index: 20;
    `;

    const introViewport = document.createElement('div');
    introViewport.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
    `;

    const introTextEl = document.createElement('div');
    introTextEl.style.cssText = `
        color: #ffffff;
        font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
        font-size: 18px;
        line-height: 24px;
        white-space: pre-wrap;
        word-break: break-all;
        will-change: transform;
    `;

    introViewport.appendChild(introTextEl);
    introPanel.appendChild(introViewport);
    document.body.appendChild(introPanel);

    let introCharCount = 0;
    const updateIntroText = () => {
        introTextEl.textContent = loremIpsum.slice(0, introCharCount);
        const overflow = Math.max(0, introTextEl.scrollHeight - introViewport.clientHeight);
        introTextEl.style.transform = `translateY(-${overflow}px)`;
    };

    app.on('destroy', () => {
        introPanel.remove();
    });

    modelRoot.addComponent('script');
    const manager = modelRoot.script.create(AnnotationManager);
    manager.hotspotSize = 40;
    data.set('data', {
        showIntro: true,
        showLines: true,
        hotspotSize: 40,
        hotspotColor: [0.8, 0.8, 0.8],
        hoverColor: [1, 0.4, 0],
        opacity: 1,
        behindOpacity: 0.25
    });

    app.scene.gsplat.renderer = pc.GSPLAT_RENDERER_AUTO;

    const yellow = new pc.Color(1, 0.9, 0.2, 1);
    const cyan = new pc.Color(0.2, 0.9, 1, 1);
    const gray = new pc.Color(0.5, 0.5, 0.5, 0.8);
    const dimensionRoot = new pc.Entity('dimensions');
    modelRoot.addChild(dimensionRoot);

    const dimensionFont = new pc.CanvasFont(app, {
        color: new pc.Color(1, 1, 1),
        fontName: 'Arial',
        fontSize: 64,
        width: 512,
        height: 256
    });
    dimensionFont.createTextures('0123456789.');

    let linesEntity = null;
    const dimensionLabels = [];

    const createTextLabel = (text, position, scale = 0.01) => {
        const labelRoot = new pc.Entity(`dimension-${text}`);
        labelRoot.setLocalPosition(position);

        const labelScreen = new pc.Entity('screen');
        labelScreen.setLocalScale(scale, scale, scale);
        labelScreen.setLocalEulerAngles(0, 180, 0);
        labelScreen.addComponent('screen', {
            referenceResolution: new pc.Vec2(256, 64),
            screenSpace: false
        });
        labelRoot.addChild(labelScreen);

        const labelText = new pc.Entity('text');
        labelText.addComponent('element', {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            width: 220,
            height: 48,
            fontSize: 14,
            color: new pc.Color(0.227, 0.553, 1),
            text,
            autoWidth: false,
            autoHeight: false,
            wrapLines: false,
            type: pc.ELEMENTTYPE_TEXT
        });
        labelText.element.font = dimensionFont;
        labelScreen.addChild(labelText);

        dimensionRoot.addChild(labelRoot);
        dimensionLabels.push(labelRoot);
        return labelRoot;
    };

    const updateDimensionLabels = () => {
        for (const label of dimensionLabels) {
            label.lookAt(camera.getPosition());
        }
    };

    const createLinesEntity = () => {
        if (!hasAabb) {
            return;
        }

        destroyLinesEntity();

        linesEntity = new pc.Entity('Lines');
        linesEntity.addComponent('script');
        const lines = linesEntity.script.create(GsplatLines);
        dimensionRoot.addChild(linesEntity);

        const min = modelAabb.getMin().clone();
        const max = modelAabb.getMax().clone();
        const size = new pc.Vec3(max.x - min.x, max.y - min.y, max.z - min.z);
        const maxDim = Math.max(size.x, size.y, size.z);
        const thickness = Math.max(0.001, maxDim * 0.0015);
        const arrowHeadSize = thickness * 27;
        const offset = maxDim * 0.12;
        const labelScale = Math.max(0.006, maxDim * 0.005);
        const lineLocal = (ax, ay, az, bx, by, bz, color, width) => {
           // lines.addLineSimple(new pc.Vec3(ax, ay, az), new pc.Vec3(bx, by, bz), color, width);
           // 模型旁边黄色标线
        };

        const midX = (min.x + max.x) * 0.5;
        const midY = (min.y + max.y) * 0.5;
        const midZ = (min.z + max.z) * 0.5;

        const boxWidth = thickness * 0.6;
        lineLocal(min.x, min.y, min.z, max.x, min.y, min.z, yellow, boxWidth);
        lineLocal(max.x, min.y, min.z, max.x, min.y, max.z, yellow, boxWidth);
        lineLocal(max.x, min.y, max.z, min.x, min.y, max.z, yellow, boxWidth);
        lineLocal(min.x, min.y, max.z, min.x, min.y, min.z, yellow, boxWidth);

        lineLocal(min.x, max.y, min.z, max.x, max.y, min.z, yellow, boxWidth);
        lineLocal(max.x, max.y, min.z, max.x, max.y, max.z, yellow, boxWidth);
        lineLocal(max.x, max.y, max.z, min.x, max.y, max.z, yellow, boxWidth);
        lineLocal(min.x, max.y, max.z, min.x, max.y, min.z, yellow, boxWidth);

        lineLocal(min.x, min.y, min.z, min.x, max.y, min.z, yellow, boxWidth);
        lineLocal(max.x, min.y, min.z, max.x, max.y, min.z, yellow, boxWidth);
        lineLocal(max.x, min.y, max.z, max.x, max.y, max.z, yellow, boxWidth);
        lineLocal(min.x, min.y, max.z, min.x, max.y, max.z, yellow, boxWidth);

        const yDim = max.y + offset;
        lines.addArrow(new pc.Vec3(min.x, yDim, midZ), new pc.Vec3(max.x, yDim, midZ), cyan, thickness * 0.8, arrowHeadSize);
        lines.addArrow(new pc.Vec3(max.x, yDim, midZ), new pc.Vec3(min.x, yDim, midZ), cyan, thickness * 0.8, arrowHeadSize);
        lineLocal(min.x, max.y, midZ, min.x, yDim, midZ, gray, thickness * 0.5);
        lineLocal(max.x, max.y, midZ, max.x, yDim, midZ, gray, thickness * 0.5);

        const xDim = max.x + offset;
        lines.addArrow(new pc.Vec3(xDim, min.y, midZ), new pc.Vec3(xDim, max.y, midZ), cyan, thickness * 0.8, arrowHeadSize);
        lines.addArrow(new pc.Vec3(xDim, max.y, midZ), new pc.Vec3(xDim, min.y, midZ), cyan, thickness * 0.8, arrowHeadSize);
        lineLocal(max.x, min.y, midZ, xDim, min.y, midZ, gray, thickness * 0.5);
        lineLocal(max.x, max.y, midZ, xDim, max.y, midZ, gray, thickness * 0.5);

        const zDim = min.z - offset;
        lines.addArrow(new pc.Vec3(midX, min.y, zDim), new pc.Vec3(midX, min.y, max.z), cyan, thickness * 0.8, arrowHeadSize);
        lines.addArrow(new pc.Vec3(midX, min.y, max.z), new pc.Vec3(midX, min.y, zDim), cyan, thickness * 0.8, arrowHeadSize);
        lineLocal(midX, min.y, min.z, midX, min.y, zDim, gray, thickness * 0.5);

        createTextLabel(size.x.toFixed(2), new pc.Vec3(midX, yDim + offset * 0.15, midZ), labelScale);
        createTextLabel(size.y.toFixed(2), new pc.Vec3(xDim, midY + offset * 0.15, midZ), labelScale);
        createTextLabel(size.z.toFixed(2), new pc.Vec3(midX, min.y + offset * 0.15, (zDim + max.z) * 0.5), labelScale);
        updateDimensionLabels();
    };

    const destroyLinesEntity = () => {
        if (linesEntity) {
            linesEntity.destroy();
            linesEntity = null;
        }
        for (const label of dimensionLabels) {
            label.destroy();
        }
        dimensionLabels.length = 0;
    };

    if (data.get('data.showLines') === true) {
        createLinesEntity();
    }

    data.on('*:set', (path, value) => {
        const prop = path.split('.')[1];
        if (prop === 'showIntro') {
            introPanel.style.display = value === true ? 'block' : 'none';
            if (value === true) {
                introCharCount = 0;
                updateIntroText();
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
            text: '结构说明结构说明结构说明结构说明结构说明结构说明结构说明结构说明'
        },
        {
            pos: new pc.Vec3(c.x + he.x * f, c.y+1, c.z),
            title: '机门结构',
            text: '结构说明结构说明结构说明结构说明结构说明结构说明结构说明结构说明。'
        },
        {
            pos: new pc.Vec3(c.x + he.x * f, c.y+1, c.z-2),
            title: '操控面板',
            text: '结构说明结构说明结构说明结构说明结构说明结构说明结构说明结构说明。'
        },
        {
            pos: new pc.Vec3(c.x, c.y, c.z + he.z * f),
            title: '侧面结构',
            text: '结构说明结构说明结构说明结构说明结构说明结构说明结构说明结构说明。'
        },
        {
            pos: new pc.Vec3(c.x - he.x * f, c.y, c.z),
            title: '背面结构',
            text: '结构说明结构说明结构说明结构说明结构说明结构说明结构说明结构说明。'
        }
    ];

    annotations.forEach(({ pos, title, text }, index) => {
        modelRoot.addChild(createAnnotation(pos, String(index + 1), title, text));
    });

    updateIntroText();
    app.on('update', updateDimensionLabels);

    const typewriterId = setInterval(() => {
        if (data.get('data.showIntro') !== true) {
            return;
        }

        introCharCount += 1;
        if (introCharCount >= loremIpsum.length) {
            introCharCount = 0;
        }
        updateIntroText();
    }, 55);
    app.on('destroy', () => clearInterval(typewriterId));
    app.on('destroy', destroyLinesEntity);

    const shadowCatcher = new pc.Entity('shadowCatcher');
    shadowCatcher.addComponent('script');
    shadowCatcher.script.create(ShadowCatcher, {
        properties: {
            scale: new pc.Vec3(sceneSize * 7.5, sceneSize * 7.5, sceneSize * 7.5)
        }
    });
    app.root.addChild(shadowCatcher);
});
