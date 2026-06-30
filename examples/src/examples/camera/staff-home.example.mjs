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
const ANIMS_URL = `${BASE_URL}anims/`;
const SOUNDS_URL = `${BASE_URL}sounds/`;
const APP_WIDTH = 1920;
const APP_HEIGHT = 1080;
const CROSSHAIR_DEFAULT_URL = `${BASE_URL}ui/crosshair.png`;
const CROSSHAIR_ACTIVE_URL = `${BASE_URL}ui/crosshair_control.png`;

pc.WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve(true));
});

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
    pc.LightComponentSystem,
    pc.ParticleSystemComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem
].filter(Boolean);
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.CubemapHandler,
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

const extraTextureDefs = [
    { id: 295898584, url: 'textures/cubemaps/bathroom_mirror/01.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898588, url: 'textures/cubemaps/bathroom_mirror/02.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898581, url: 'textures/cubemaps/bathroom_mirror/03.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898461, url: 'textures/cubemaps/bathroom_mirror/04.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898591, url: 'textures/cubemaps/bathroom_mirror/05.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898575, url: 'textures/cubemaps/bathroom_mirror/06.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898639, url: 'textures/cubemaps/hallway_mirror/01.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898643, url: 'textures/cubemaps/hallway_mirror/02.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898474, url: 'textures/cubemaps/hallway_mirror/03.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898585, url: 'textures/cubemaps/hallway_mirror/04.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898624, url: 'textures/cubemaps/hallway_mirror/05.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898600, url: 'textures/cubemaps/hallway_mirror/06.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898730, url: 'textures/cubemaps/outdoor/right.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898741, url: 'textures/cubemaps/outdoor/left.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898552, url: 'textures/cubemaps/outdoor/top.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898734, url: 'textures/cubemaps/outdoor/bottom.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898553, url: 'textures/cubemaps/outdoor/front.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false },
    { id: 295898739, url: 'textures/cubemaps/outdoor/back.png', mipmaps: true, anisotropy: 1, srgb: true, rgbm: false }
];

for (const def of extraTextureDefs) {
    if (textureAssets.has(def.id)) continue;
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

const bathroomMirrorCubemap = new pc.Asset('bathroom_mirror_cubemap', 'cubemap', null, {
    textures: [295898588, 295898584, 295898461, 295898581, 295898575, 295898591],
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    anisotropy: 1
});
bathroomMirrorCubemap.id = 295898535;
app.assets.add(bathroomMirrorCubemap);

const hallwayMirrorCubemap = new pc.Asset('hallway_mirror_cubemap', 'cubemap', null, {
    textures: [295898624, 295898600, 295898585, 295898474, 295898643, 295898639],
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    anisotropy: 1
});
hallwayMirrorCubemap.id = 295898586;
app.assets.add(hallwayMirrorCubemap);

const outdoorCubemap = new pc.Asset('outdoor_cubemap', 'cubemap', null, {
    textures: [295898730, 295898741, 295898552, 295898734, 295898553, 295898739],
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    anisotropy: 1
});
outdoorCubemap.id = 295898587;
app.assets.add(outdoorCubemap);

await loadAssets([bathroomMirrorCubemap, hallwayMirrorCubemap, outdoorCubemap]);

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
    if (def.id === 295898761) {
        material.cubeMap = bathroomMirrorCubemap.resources?.[0] ?? null;
        material.cubeMapProjection = pc.CUBEPROJ_BOX;
        material.cubeMapProjectionBox = new pc.BoundingBox(
            new pc.Vec3(2.5, 1.6, 2.35),
            new pc.Vec3(7, 10, 10)
        );
    }
    if (def.id === 295898767) {
        material.cubeMap = hallwayMirrorCubemap.resources?.[0] ?? null;
        material.cubeMapProjection = pc.CUBEPROJ_BOX;
        material.cubeMapProjectionBox = new pc.BoundingBox(
            new pc.Vec3(4, 1, 0),
            new pc.Vec3(20, 12, 15)
        );
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
app.scene.exposure = RENDER_SETTINGS.exposure;
app.scene.skyboxIntensity = RENDER_SETTINGS.skyboxIntensity;
const skyboxCubemap = outdoorCubemap.resources?.[0] ?? null;
if (skyboxCubemap) {
    app.scene.skybox = skyboxCubemap;
    const lighting = pc.EnvLighting.generateLightingSource(skyboxCubemap);
    const atlas = pc.EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    app.scene.envAtlas = atlas;
} else {
    app.scene.envAtlas = envAtlas.resource;
}
app.scene.skyboxMip = 0;
app.scene.clusteredLightingEnabled = true;
app.scene.lightmapMode = pc.BAKE_COLORDIR;
app.scene.lightmapSizeMultiplier = 16;
app.scene.lightmapMaxResolution = 2048;
app.scene.lightmapFilterEnabled = false;
app.scene.lighting.maxLightsPerCell = 255;
app.scene.lighting.shadowsEnabled = true;
app.scene.lighting.cookiesEnabled = false;
app.scene.lighting.areaLightsEnabled = false;

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
            toneMapping: RENDER_SETTINGS.toneMapping
        });
    }

    nodes.set(def.id, entity);
}

for (const def of NODE_DEFINITIONS) {
    const entity = nodes.get(def.id);
    const parent = def.parent ? nodes.get(def.parent) : app.root;
    (parent ?? app.root).addChild(entity);
}

const sunLight = new pc.Entity('sun_light');
sunLight.addComponent('light', {
    type: 'directional',
    isStatic: true,
    bake: false,
    affectDynamic: true,
    affectLightmapped: false,
    bakeDir: true,
    color: new pc.Color(0.9647058823529412, 0.9176470588235294, 0.7450980392156863),
    intensity: 0.8,
    castShadows: true,
    shadowType: 2,
    shadowDistance: 10,
    shadowResolution: 1024,
    shadowBias: 0,
    normalOffsetBias: 0,
    vsmBlurMode: 1,
    vsmBlurSize: 11,
    vsmBias: 0.01,
    shadowUpdateMode: 1
});
sunLight.setLocalPosition(-5.4987688064575195, 7.928093919819875e-16, 2.48415207862854);
sunLight.setLocalEulerAngles(68, -58.5, 4);
app.root.addChild(sunLight);

const playOneShotAudio = (url, volume = 1) => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = volume;
    const playPromise = audio.play();
    if (playPromise?.catch) playPromise.catch(() => {});
};

const createLoopAudio = (url, volume = 1) => {
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    const play = () => {
        const p = audio.play();
        if (p?.catch) p.catch(() => {});
    };
    const stop = () => {
        audio.pause();
        audio.currentTime = 0;
    };
    return { audio, play, stop };
};

const vec3FromArray = (arr, fallback = [0, 0, 0]) => {
    const v = Array.isArray(arr) ? arr : fallback;
    return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
};

const sampleKeys = (keys, time, out, defaults) => {
    if (!keys?.length) {
        const d = vec3FromArray(defaults);
        out.set(d[0], d[1], d[2]);
        return out;
    }
    if (time <= keys[0].t) {
        const v = keys[0].v;
        out.set(v[0], v[1], v[2]);
        return out;
    }
    const last = keys[keys.length - 1];
    if (time >= last.t) {
        out.set(last.v[0], last.v[1], last.v[2]);
        return out;
    }
    let lo = 0;
    let hi = keys.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (time < keys[mid].t) hi = mid;
        else lo = mid;
    }
    const a = keys[lo];
    const b = keys[hi];
    const span = b.t - a.t;
    const t = span > 0 ? (time - a.t) / span : 0;
    out.set(
        pc.math.lerp(a.v[0], b.v[0], t),
        pc.math.lerp(a.v[1], b.v[1], t),
        pc.math.lerp(a.v[2], b.v[2], t)
    );
    return out;
};

const parseLegacyAnim = (data) => {
    const anim = data?.animation;
    if (!anim?.nodes?.length) return null;
    return {
        duration: anim.duration ?? 0,
        nodes: anim.nodes.map((node) => {
            const defaults = node.defaults ?? {};
            const posKeys = [];
            const rotKeys = [];
            const scaleKeys = [];
            for (const key of node.keys ?? []) {
                if (Array.isArray(key.p)) posKeys.push({ t: key.t ?? 0, v: key.p });
                if (Array.isArray(key.r)) rotKeys.push({ t: key.t ?? 0, v: key.r });
                if (Array.isArray(key.s)) scaleKeys.push({ t: key.t ?? 0, v: key.s });
            }
            return {
                name: node.name,
                defaults,
                posKeys,
                rotKeys,
                scaleKeys
            };
        })
    };
};

const animCache = new Map();
const loadLegacyAnim = async (fileName) => {
    const cached = animCache.get(fileName);
    if (cached) return cached;
    const res = await fetch(ANIMS_URL + fileName);
    if (!res.ok) throw new Error(`Failed to load animation: ${fileName}`);
    const data = await res.json();
    const anim = parseLegacyAnim(data);
    if (!anim) throw new Error(`Invalid animation: ${fileName}`);
    animCache.set(fileName, anim);
    return anim;
};

const createLegacyAnimPlayer = (entity) => {
    const model = entity?.model?.model ?? null;
    const graph = model?.graph ?? null;

    const boneTargets = new Map();
    for (const skinInstance of model?.skinInstances ?? []) {
        for (const bone of skinInstance?.bones ?? []) {
            if (!bone?.name) continue;
            const list = boneTargets.get(bone.name);
            if (list) list.push(bone);
            else boneTargets.set(bone.name, [bone]);
        }
    }

    const resolvedTargets = new Map();
    const tmp = new pc.Vec3();
    const applyToNode = (node, track, time) => {
        if (track.posKeys.length) {
            sampleKeys(track.posKeys, time, tmp, track.defaults.p);
            node.setLocalPosition(tmp);
        }
        if (track.rotKeys.length) {
            sampleKeys(track.rotKeys, time, tmp, track.defaults.r);
            node.setLocalEulerAngles(tmp.x, tmp.y, tmp.z);
        }
        if (track.scaleKeys.length) {
            sampleKeys(track.scaleKeys, time, tmp, track.defaults.s);
            node.setLocalScale(tmp);
        }
    };

    const apply = (clip, time) => {
        if (!graph) return;
        for (const track of clip.nodes) {
            let targets = resolvedTargets.get(track.name);
            if (targets === undefined) {
                const bones = boneTargets.get(track.name);
                const byName = graph.findByName(track.name) ?? null;
                targets = bones?.length ? bones : (byName ? [byName] : []);
                resolvedTargets.set(track.name, targets);
            }
            for (const node of targets) {
                applyToNode(node, track, time);
            }
        }
    };
    return { apply };
};

const createToggleInteractor = async (options) => {
    const entity = app.root.findByName(options.entityName);
    if (!entity?.model?.model) return null;

    const openClip = await loadLegacyAnim(options.openAnim);
    const closeClip = await loadLegacyAnim(options.closeAnim);
    const player = createLegacyAnimPlayer(entity);

    const state = {
        entity,
        isOn: false,
        clip: null,
        time: 0,
        duration: 0,
        speed: 1,
        playing: false,
        soundPlayed: false
    };

    const playOpen = () => {
        state.clip = openClip;
        state.time = 0;
        state.duration = openClip.duration;
        state.speed = 1;
        state.playing = true;
        state.soundPlayed = false;
        options.onOpenSound?.();
        state.isOn = true;
        player.apply(state.clip, 0);
    };

    const playClose = () => {
        state.clip = closeClip;
        state.time = 0;
        state.duration = closeClip.duration;
        state.speed = 1;
        state.playing = true;
        state.soundPlayed = false;
        options.onCloseStart?.();
        state.isOn = false;
        player.apply(state.clip, 0);
    };

    const trigger = () => {
        if (state.playing) return;
        if (state.isOn) playClose();
        else playOpen();
    };

    const update = (dt) => {
        if (!state.playing || !state.clip) return;
        state.time += dt;
        const total = state.speed !== 0 ? state.duration / state.speed : 0;
        const clamped = total > 0 ? Math.min(state.time, total) : 0;
        player.apply(state.clip, clamped);

        if (!state.isOn && options.onCloseTick && total > 0) {
            options.onCloseTick({
                time: clamped,
                total,
                played: state.soundPlayed,
                markPlayed: () => {
                    state.soundPlayed = true;
                }
            });
        }

        if (state.time >= total) {
            state.time = 0;
            state.playing = false;
            state.soundPlayed = false;
        }
    };

    return {
        entity: state.entity,
        trigger,
        update,
        isBusy: () => state.playing,
        pickInflate: Array.isArray(options.pickInflate) ? new pc.Vec3(...options.pickInflate) : null
    };
};

const interactables = [];
const interactableByEntity = new Map();

const registerInteractable = (controller) => {
    if (!controller) return;
    interactables.push(controller);
    interactableByEntity.set(controller.entity, controller);
};

registerInteractable(await createToggleInteractor({
    entityName: 'bathroom_door_anim',
    openAnim: 'bathroom_door_openanim.json',
    closeAnim: 'bathroom_door_closeanim.json',
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}bathroom_door_open.wav`, 0.85),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        if (ctx.time < ctx.total / 1.2) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}bathroom_door_close.wav`, 0.85);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'showerdoors',
    openAnim: 'showerdoors_openanim.json',
    closeAnim: 'showerdoors_closeanim.json',
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}showerdoor_open.wav`, 0.75),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}showerdoor_close.wav`, 0.75);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'hallwaycabinetdoors',
    openAnim: 'hallwaycabinetdoors_open_anim.json',
    closeAnim: 'hallwaycabinetdoors_close_anim.json',
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}hallway_cabinet_open.wav`, 0.85),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}hallway_cabinet_close.wav`, 0.85);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'hallwaydrawer',
    openAnim: 'hallwaydrawer_open_anim.json',
    closeAnim: 'hallwaydrawer_close_anim.json',
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}drawer_open.wav`, 0.85),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}drawer_close.wav`, 0.85);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'stand_l_door',
    openAnim: 'stand_l_door_open_anim.json',
    closeAnim: 'stand_l_door_close_anim.json',
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}hallway_cabinet_open.wav`, 0.65),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        if (ctx.time < ctx.total / 1.1) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}hallway_cabinet_close.wav`, 0.65);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'stand_r_door',
    openAnim: 'stand_r_door_open_anim.json',
    closeAnim: 'stand_r_door_close_anim.json',
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}hallway_cabinet_open.wav`, 0.65),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        if (ctx.time < ctx.total / 1.1) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}hallway_cabinet_close.wav`, 0.65);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'commode_door_l',
    openAnim: 'commode_door_l_open_anim.json',
    closeAnim: 'commode_door_l_close_anim.json',
    pickInflate: [0.35, 0.45, 0.35],
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}commode_door_open.wav`, 0.85),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        if (ctx.time < ctx.total / 1.15) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}commode_door_close.wav`, 0.85);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'commode_door_r',
    openAnim: 'commode_door_r_open_anim.json',
    closeAnim: 'commode_door_r_close_anim.json',
    pickInflate: [0.35, 0.45, 0.35],
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}commode_door_open.wav`, 0.85),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        if (ctx.time < ctx.total / 1.15) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}commode_door_close.wav`, 0.85);
    }
}));

registerInteractable(await createToggleInteractor({
    entityName: 'refrigerator_door',
    openAnim: 'refrigerator_door_open_anim.json',
    closeAnim: 'refrigerator_door_close_anim.json',
    onOpenSound: () => playOneShotAudio(`${SOUNDS_URL}refrigerator_door_open.wav`, 0.85),
    onCloseTick: (ctx) => {
        if (ctx.played) return;
        if (ctx.time < ctx.total / 1.1) return;
        ctx.markPlayed();
        playOneShotAudio(`${SOUNDS_URL}refrigerator_door_close.wav`, 0.85);
    }
}));

const faucetParticleSetup = new Map([
    ['bathroomsink_faucet', {
        parent: 'sink_faucet',
        water: 'sink_water_particle',
        spray: 'sink_waterspray_particle',
        waterTarget: [2.852, 1.088, 2.465],
        sprayTarget: [2.852, 0.834, 2.465]
    }],
    ['bathroomjacuzzi_faucet', {
        parent: 'jacuzzi_faucet',
        water: 'jacuzzi_water_particle',
        spray: 'jacuzzi_waterspray_particle',
        waterTarget: [4.562, 0.76, 5.64],
        sprayTarget: [4.558, 0.133, 5.65]
    }],
    ['barsink_faucet', {
        parent: 'barsink',
        water: 'barsink_water_particle',
        spray: 'barsink_waterspray_particle',
        waterTarget: [-4.575, 1.506, -1.182],
        sprayTarget: [-4.575, 1.197, -1.182]
    }]
]);

const faucetParticleTuning = new Map([
    ['sink_water_particle', {
        scaleMultiplier: [0.14, 0.14, 0.14],
        emitterRadius: 0.04
    }],
    ['jacuzzi_water_particle', {
        scaleMultiplier: [0.11, 0.11, 0.11],
        emitterRadius: 0.03
    }],
    ['barsink_water_particle', {
        scaleMultiplier: [0.14, 0.14, 0.14],
        emitterRadius: 0.04,
        emitterExtents: [0.012, 0.012, 0.012]
    }]
]);

const particleDefinitions = new Map([
    ['sink_water_particle', {
        position: [1.9788130596487523e-17, 0, 0],
        rotation: [0, 0, 0],
        scale: [0.001, 0.001, 0.001],
        data: {
            enabled: true,
            autoPlay: false,
            numParticles: 512,
            lifetime: 0.4,
            rate: 1,
            rate2: 0,
            startAngle: 0,
            startAngle2: 0,
            loop: true,
            preWarm: true,
            lighting: false,
            halfLambert: false,
            intensity: 0.75,
            depthWrite: false,
            depthSoftening: 0,
            sort: 0,
            blendType: 2,
            stretch: 0,
            alignToMotion: false,
            emitterShape: 1,
            emitterExtents: [0, 0, 0],
            emitterRadius: 1,
            initialVelocity: 0,
            animTilesX: 1,
            animTilesY: 1,
            animNumFrames: 1,
            animSpeed: 1,
            animLoop: true,
            wrap: false,
            wrapBounds: [1, 1, 1],
            colorMapAsset: null,
            normalMapAsset: null,
            mesh: null,
            localVelocityGraph: { type: 1, keys: [[0, 0], [0, 0], [0, 0]], betweenCurves: false },
            localVelocityGraph2: { type: 1, keys: [[0, 0], [0, 0], [0, 0]] },
            velocityGraph: { type: 0, keys: [[0, 0], [0, -650], [0, 0, 0, 0]], betweenCurves: false },
            velocityGraph2: { type: 0, keys: [[0, 0], [0, -650], [0, 0, 0, 0]] },
            rotationSpeedGraph: { type: 1, keys: [0, 0], betweenCurves: false },
            rotationSpeedGraph2: { type: 1, keys: [0, 0] },
            scaleGraph: { type: 0, keys: [0, 5], betweenCurves: true },
            scaleGraph2: { type: 0, keys: [0, 11] },
            colorGraph: { type: 2, keys: [[0, 0.917120021875], [0, 1], [0, 1]], betweenCurves: false },
            alphaGraph: { type: 1, keys: [0, 0.4], betweenCurves: false },
            alphaGraph2: { type: 1, keys: [0, 0.4] },
            layers: [0],
            renderAsset: null
        }
    }],
    ['sink_waterspray_particle', {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [0.0009303282130080784, 0.0009029446262500152, 0.0009303282130080784],
        data: {
            enabled: true,
            autoPlay: false,
            numParticles: 512,
            lifetime: 0.4,
            rate: 1,
            rate2: 0,
            startAngle: 0,
            startAngle2: 0,
            loop: true,
            preWarm: true,
            lighting: false,
            halfLambert: false,
            intensity: 0.75,
            depthWrite: false,
            depthSoftening: 0,
            sort: 0,
            blendType: 2,
            stretch: 0,
            alignToMotion: false,
            emitterShape: 1,
            emitterExtents: [0, 0, 0],
            emitterRadius: 0,
            initialVelocity: 0,
            animTilesX: 1,
            animTilesY: 1,
            animNumFrames: 1,
            animSpeed: 1,
            animLoop: true,
            wrap: false,
            wrapBounds: [5, 5, 5],
            colorMapAsset: null,
            normalMapAsset: null,
            mesh: null,
            localVelocityGraph: { type: 1, keys: [[0, 0], [0, 0], [0, 0]], betweenCurves: false },
            localVelocityGraph2: { type: 1, keys: [[0, 0], [0, 0], [0, 0]] },
            velocityGraph: {
                type: 1,
                keys: [
                    [0.4, 0, 0.4441860465116279, 595.875, 1, 715.05],
                    [0.4, 0, 0.5813953488372093, 297.9375, 1, 496.5625],
                    [0.4, 0, 0.4325581395348837, 547.15, 1, 794.25]
                ],
                betweenCurves: true
            },
            velocityGraph2: {
                type: 1,
                keys: [
                    [0.4, 0, 0.45348837209302323, -417.11249999999995, 1, -511.85000000000014],
                    [0.4, 0],
                    [0.4, 0, 0.4372093023255814, -405.95000000000005, 1, -494.20000000000005]
                ]
            },
            rotationSpeedGraph: { type: 1, keys: [0, 0], betweenCurves: false },
            rotationSpeedGraph2: { type: 1, keys: [0, 0] },
            scaleGraph: { type: 1, keys: [0.3, 0, 0.40232558139534885, 16.775], betweenCurves: true },
            scaleGraph2: { type: 1, keys: [0.3, 0] },
            colorGraph: { type: 2, keys: [[0, 0.917120021875], [0, 1], [0, 1]], betweenCurves: false },
            alphaGraph: { type: 1, keys: [0.3, 0], betweenCurves: true },
            alphaGraph2: { type: 1, keys: [0.3, 0, 0.349, 0.5] },
            layers: [0],
            renderAsset: null
        }
    }],
    ['jacuzzi_water_particle', {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [0.002, 0.0024084902112138347, 0.001],
        data: {
            enabled: true,
            autoPlay: false,
            numParticles: 512,
            lifetime: 0.6,
            rate: 1,
            rate2: 0,
            startAngle: 0,
            startAngle2: 0,
            loop: true,
            preWarm: true,
            lighting: false,
            halfLambert: false,
            intensity: 0.75,
            depthWrite: false,
            depthSoftening: 0,
            sort: 0,
            blendType: 2,
            stretch: 0,
            alignToMotion: false,
            emitterShape: 1,
            emitterExtents: [0, 0, 0],
            emitterRadius: 1,
            initialVelocity: 0,
            animTilesX: 1,
            animTilesY: 1,
            animNumFrames: 1,
            animSpeed: 1,
            animLoop: true,
            wrap: false,
            wrapBounds: [5, 5, 5],
            colorMapAsset: null,
            normalMapAsset: null,
            mesh: null,
            localVelocityGraph: { type: 1, keys: [[0, 0], [0, 0], [0, 0]], betweenCurves: false },
            localVelocityGraph2: { type: 1, keys: [[0, 0], [0, 0], [0, 0]] },
            velocityGraph: { type: 0, keys: [[0, 0], [0, -650], [0, 0, 0, 0]], betweenCurves: false },
            velocityGraph2: { type: 0, keys: [[0, 0], [0, -650], [0, 0, 0, 0]] },
            rotationSpeedGraph: { type: 1, keys: [0, 0], betweenCurves: false },
            rotationSpeedGraph2: { type: 1, keys: [0, 0] },
            scaleGraph: { type: 0, keys: [0, 16], betweenCurves: true },
            scaleGraph2: { type: 0, keys: [0, 9] },
            colorGraph: { type: 2, keys: [[0, 0.917120021875], [0, 1], [0, 1]], betweenCurves: false },
            alphaGraph: { type: 1, keys: [0, 0.4], betweenCurves: false },
            alphaGraph2: { type: 1, keys: [0, 0.4] },
            layers: [0],
            renderAsset: null
        }
    }],
    ['jacuzzi_waterspray_particle', {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [0.0016235520499256126, 0.0015757638846375592, 0.0016235520499256126],
        data: {
            enabled: true,
            autoPlay: false,
            numParticles: 512,
            lifetime: 0.4,
            rate: 1,
            rate2: 0,
            startAngle: 0,
            startAngle2: 0,
            loop: true,
            preWarm: true,
            lighting: false,
            halfLambert: false,
            intensity: 0.75,
            depthWrite: false,
            depthSoftening: 0,
            sort: 0,
            blendType: 2,
            stretch: 0,
            alignToMotion: false,
            emitterShape: 1,
            emitterExtents: [0, 0, 0],
            emitterRadius: 0,
            initialVelocity: 0,
            animTilesX: 1,
            animTilesY: 1,
            animNumFrames: 1,
            animSpeed: 1,
            animLoop: true,
            wrap: false,
            wrapBounds: [5, 5, 5],
            colorMapAsset: null,
            normalMapAsset: null,
            mesh: null,
            localVelocityGraph: { type: 1, keys: [[0, 0], [0, 0], [0, 0]], betweenCurves: false },
            localVelocityGraph2: { type: 1, keys: [[0, 0], [0, 0], [0, 0]] },
            velocityGraph: {
                type: 1,
                keys: [
                    [0.4, 0, 0.4720930232558139, 704.8125, 1, 861.4375],
                    [0.4, 0, 0.6186046511627907, 579.5125, 1, 720.475],
                    [0.4, 0, 0.46511627906976744, 673.4875, 1, 794.25]
                ],
                betweenCurves: true
            },
            velocityGraph2: {
                type: 1,
                keys: [
                    [0.4, 0, 0.4790697674418605, -673.4875000000002, 1, -689.1500000000001],
                    [0.4, 0],
                    [0.4, 0, 0.4790697674418605, -579.5124999999998, 1, -689.1500000000001]
                ]
            },
            rotationSpeedGraph: { type: 1, keys: [0, 0], betweenCurves: false },
            rotationSpeedGraph2: { type: 1, keys: [0, 0] },
            scaleGraph: { type: 1, keys: [0.3, 0, 0.402, 25], betweenCurves: true },
            scaleGraph2: { type: 1, keys: [0.3, 0] },
            colorGraph: { type: 2, keys: [[0, 0.917120021875], [0, 1], [0, 1]], betweenCurves: false },
            alphaGraph: { type: 1, keys: [0.3, 0], betweenCurves: true },
            alphaGraph2: { type: 1, keys: [0.3, 0, 0.349, 0.5] },
            layers: [0],
            renderAsset: null
        }
    }],
    ['barsink_water_particle', {
        position: [1.9788130596487523e-17, 0, 0],
        rotation: [0, 0, 0],
        scale: [0.001, 0.001, 0.001],
        data: {
            enabled: true,
            autoPlay: false,
            numParticles: 512,
            lifetime: 0.45,
            rate: 1,
            rate2: 0,
            startAngle: 0,
            startAngle2: 0,
            loop: true,
            preWarm: true,
            lighting: false,
            halfLambert: false,
            intensity: 0.75,
            depthWrite: false,
            depthSoftening: 0,
            sort: 0,
            blendType: 2,
            stretch: 0,
            alignToMotion: false,
            emitterShape: 1,
            emitterExtents: [0.1, 0.1, 0.1],
            emitterRadius: 1,
            initialVelocity: 0,
            animTilesX: 1,
            animTilesY: 1,
            animNumFrames: 1,
            animSpeed: 1,
            animLoop: true,
            wrap: false,
            wrapBounds: [1, 1, 1],
            colorMapAsset: null,
            normalMapAsset: null,
            mesh: null,
            localVelocityGraph: { type: 1, keys: [[0, 0], [0, 0], [0, 0]], betweenCurves: false },
            localVelocityGraph2: { type: 1, keys: [[0, 0], [0, 0], [0, 0]] },
            velocityGraph: { type: 0, keys: [[0, 0], [0, -650], [0, 0, 0, 0]], betweenCurves: false },
            velocityGraph2: { type: 0, keys: [[0, 0], [0, -650], [0, 0, 0, 0]] },
            rotationSpeedGraph: { type: 1, keys: [0, 0], betweenCurves: false },
            rotationSpeedGraph2: { type: 1, keys: [0, 0] },
            scaleGraph: { type: 0, keys: [0, 5], betweenCurves: true },
            scaleGraph2: { type: 0, keys: [0, 11] },
            colorGraph: { type: 2, keys: [[0, 0.917120021875], [0, 1], [0, 1]], betweenCurves: false },
            alphaGraph: { type: 1, keys: [0, 0.4], betweenCurves: false },
            alphaGraph2: { type: 1, keys: [0, 0.4] },
            layers: [0],
            renderAsset: null
        }
    }],
    ['barsink_waterspray_particle', {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [0.0009303282130080784, 0.0009029446262500152, 0.0009303282130080784],
        data: {
            enabled: true,
            autoPlay: false,
            numParticles: 512,
            lifetime: 0.35,
            rate: 1,
            rate2: 0,
            startAngle: 0,
            startAngle2: 0,
            loop: true,
            preWarm: true,
            lighting: false,
            halfLambert: false,
            intensity: 0.75,
            depthWrite: false,
            depthSoftening: 0,
            sort: 0,
            blendType: 2,
            stretch: 0,
            alignToMotion: false,
            emitterShape: 1,
            emitterExtents: [0, 0, 0],
            emitterRadius: 0,
            initialVelocity: 0,
            animTilesX: 1,
            animTilesY: 1,
            animNumFrames: 1,
            animSpeed: 1,
            animLoop: true,
            wrap: false,
            wrapBounds: [5, 5, 5],
            colorMapAsset: null,
            normalMapAsset: null,
            mesh: null,
            localVelocityGraph: { type: 1, keys: [[0, 0], [0, 0], [0, 0]], betweenCurves: false },
            localVelocityGraph2: { type: 1, keys: [[0, 0], [0, 0], [0, 0]] },
            velocityGraph: {
                type: 1,
                keys: [
                    [0.4, 0, 0.4441860465116279, 595.875, 1, 715.05],
                    [0.4, 0, 0.5813953488372093, 297.9375, 1, 496.5625],
                    [0.4, 0, 0.4325581395348837, 547.15, 1, 794.25]
                ],
                betweenCurves: true
            },
            velocityGraph2: {
                type: 1,
                keys: [
                    [0.4, 0, 0.45348837209302323, -417.11249999999995, 1, -511.85000000000014],
                    [0.4, 0],
                    [0.4, 0, 0.4372093023255814, -405.95000000000005, 1, -494.20000000000005]
                ]
            },
            rotationSpeedGraph: { type: 1, keys: [0, 0], betweenCurves: false },
            rotationSpeedGraph2: { type: 1, keys: [0, 0] },
            scaleGraph: { type: 1, keys: [0.3, 0, 0.40232558139534885, 16.775], betweenCurves: true },
            scaleGraph2: { type: 1, keys: [0.3, 0] },
            colorGraph: { type: 2, keys: [[0, 0.917120021875], [0, 1], [0, 1]], betweenCurves: false },
            alphaGraph: { type: 1, keys: [0.3, 0], betweenCurves: true },
            alphaGraph2: { type: 1, keys: [0.3, 0, 0.349, 0.5] },
            layers: [0],
            renderAsset: null
        }
    }]
]);

const ensureFaucetParticles = async (faucetName) => {
    const setup = faucetParticleSetup.get(faucetName);
    if (!setup) return null;
    const parent = app.root.findByName(setup.parent);
    if (!parent) return null;
    const defs = particleDefinitions;
    const cloneParticleValue = (value) => {
        if (Array.isArray(value)) {
            return value.map((entry) => cloneParticleValue(entry));
        }
        if (value && typeof value === 'object') {
            const clone = {};
            for (const [key, entry] of Object.entries(value)) {
                clone[key] = cloneParticleValue(entry);
            }
            return clone;
        }
        return value;
    };

    const buildParticleData = (particleName, def) => {
        const tuning = faucetParticleTuning.get(particleName);
        const data = cloneParticleValue(def.data);
        if (!tuning) return data;
        if (typeof tuning.emitterRadius === 'number') {
            data.emitterRadius = tuning.emitterRadius;
        }
        if (Array.isArray(tuning.emitterExtents)) {
            data.emitterExtents = tuning.emitterExtents.slice();
        }
        return data;
    };

    const applyParticleTransform = (entity, particleName, def) => {
        const tuning = faucetParticleTuning.get(particleName);
        const sx = tuning?.scaleMultiplier?.[0] ?? 1;
        const sy = tuning?.scaleMultiplier?.[1] ?? 1;
        const sz = tuning?.scaleMultiplier?.[2] ?? 1;
        entity.setLocalPosition(def.position[0], def.position[1], def.position[2]);
        entity.setLocalEulerAngles(def.rotation[0], def.rotation[1], def.rotation[2]);
        entity.setLocalScale(def.scale[0] * sx, def.scale[1] * sy, def.scale[2] * sz);
    };

    const ensureOne = (particleName) => {
        const def = defs.get(particleName);
        if (!def) return null;
        const existing = app.root.findByName(particleName);
        if (existing?.particlesystem) {
            if (existing.parent !== parent) {
                parent.addChild(existing);
            }
            applyParticleTransform(existing, particleName, def);
            existing.removeComponent('particlesystem');
            existing.addComponent('particlesystem', buildParticleData(particleName, def));
            if (!existing.model) {
                existing.addComponent('model', {
                    enabled: false,
                    isStatic: false,
                    type: 'capsule',
                    asset: null,
                    materialAsset: null,
                    castShadows: false,
                    castShadowsLightmap: false,
                    receiveShadows: false,
                    lightmapped: false,
                    lightmapSizeMultiplier: 1,
                    batchGroupId: null,
                    layers: [0]
                });
            }
            return existing;
        }
        const entity = new pc.Entity(particleName);
        parent.addChild(entity);
        applyParticleTransform(entity, particleName, def);
        entity.addComponent('model', {
            enabled: false,
            isStatic: false,
            type: 'capsule',
            asset: null,
            materialAsset: null,
            castShadows: false,
            castShadowsLightmap: false,
            receiveShadows: false,
            lightmapped: false,
            lightmapSizeMultiplier: 1,
            batchGroupId: null,
            layers: [0]
        });
        entity.addComponent('particlesystem', buildParticleData(particleName, def));
        return entity;
    };

    const waterEntity = ensureOne(setup.water);
    const sprayEntity = ensureOne(setup.spray);
    if (waterEntity && Array.isArray(setup.waterTarget)) {
        waterEntity.setPosition(setup.waterTarget[0], setup.waterTarget[1], setup.waterTarget[2]);
        waterEntity.particlesystem?.reset?.();
        waterEntity.particlesystem?.stop?.();
    }
    if (sprayEntity && Array.isArray(setup.sprayTarget)) {
        sprayEntity.setPosition(setup.sprayTarget[0], setup.sprayTarget[1], setup.sprayTarget[2]);
        sprayEntity.particlesystem?.reset?.();
        sprayEntity.particlesystem?.stop?.();
    }
    return {
        water: waterEntity?.particlesystem ?? null,
        spray: sprayEntity?.particlesystem ?? null
    };
};

const createFaucetInteractor = async (entityName, openAnim, closeAnim) => {
    const entity = app.root.findByName(entityName);
    if (!entity?.model?.model) return null;

    const openClip = await loadLegacyAnim(openAnim);
    const closeClip = await loadLegacyAnim(closeAnim);
    const player = createLegacyAnimPlayer(entity);

    const particles = await ensureFaucetParticles(entityName);
    const loop = createLoopAudio(`${SOUNDS_URL}sinkwater_loop.wav`, 0.6);

    const state = {
        entity,
        isTurnedOn: false,
        animationIsPlaying: false,
        animationDurationSeconds: 0,
        animationSpeed: 0,
        animationTimeSeconds: 0,
        soundIsPlaying: false,
        sprayDelaySeconds: 0,
        sprayHasStarted: false,
        clip: null
    };

    const trigger = () => {
        if (state.animationIsPlaying) return;

        const clip = state.isTurnedOn ? closeClip : openClip;
        state.clip = clip;
        state.animationIsPlaying = true;
        state.animationDurationSeconds = clip.duration;
        state.animationSpeed = 1;
        state.animationTimeSeconds = 0;

        if (state.isTurnedOn) {
            loop.stop();
            playOneShotAudio(`${SOUNDS_URL}sinkwater_off.wav`, 0.75);
            particles?.water?.stop?.();
            particles?.spray?.stop?.();
            state.sprayHasStarted = false;
            state.sprayDelaySeconds = 0;
        } else {
            particles?.water?.play?.();
            particles?.spray?.stop?.();
            state.sprayHasStarted = false;
            const total = state.animationDurationSeconds / (state.animationSpeed || 1);
            state.sprayDelaySeconds = Math.min(0.4, total / 3);
            if (!state.soundIsPlaying) {
                state.soundIsPlaying = true;
                loop.play();
            }
        }

        state.isTurnedOn = !state.isTurnedOn;
        player.apply(state.clip, 0);
    };

    const update = (dt) => {
        if (!state.animationIsPlaying || !state.clip) return;
        if (state.animationSpeed === 0) return;

        const total = state.animationDurationSeconds / state.animationSpeed;
        state.animationTimeSeconds += dt;

        const t = total > 0 ? Math.min(state.animationTimeSeconds, total) : 0;
        player.apply(state.clip, t);

        if (state.isTurnedOn && !state.sprayHasStarted && state.animationTimeSeconds >= state.sprayDelaySeconds) {
            particles?.spray?.play?.();
            state.sprayHasStarted = true;
        }

        if (state.animationTimeSeconds >= total) {
            state.animationTimeSeconds = 0;
            state.animationIsPlaying = false;
            state.soundIsPlaying = false;
            state.sprayHasStarted = false;
        }
    };

    return { entity: state.entity, trigger, update, isBusy: () => state.animationIsPlaying };
};

registerInteractable(await createFaucetInteractor(
    'bathroomsink_faucet',
    'bathroomsink_faucet_openanim.json',
    'bathroomsink_faucet_closeanim.json'
));

registerInteractable(await createFaucetInteractor(
    'bathroomjacuzzi_faucet',
    'bathroomjacuzzi_faucet_openanim.json',
    'bathroomjacuzzi_faucet_closeanim.json'
));

registerInteractable(await createFaucetInteractor(
    'barsink_faucet',
    'barsink_faucet_open_anim.json',
    'barsink_faucet_close_anim.json'
));

registerInteractable(await createToggleInteractor({
    entityName: 'TV_anim',
    openAnim: 'TV_clockwise_anim.json',
    closeAnim: 'TV_counter_clockwise_anim.json'
}));

ensureCanvasCss();
resize();
app.start();

const physicsStatics = new Set([
    'hotel_block_box',
    'bathroom_interior',
    'bathroom_floor',
    'bathroom_body',
    'hallway_interior',
    'room_body',
    'room_floor',
    'room_interior_a',
    'room_interior_b'
]);

for (const name of physicsStatics) {
    const entity = app.root.findByName(name);
    if (!entity?.model?.asset) continue;
    entity.addComponent('collision', {
        type: 'mesh',
        asset: entity.model.asset
    });
    entity.addComponent('rigidbody', {
        type: 'static',
        friction: 0.5,
        restitution: 0
    });
}

const player = new pc.Entity('player');
player.addComponent('collision', {
    type: 'capsule',
    radius: 0.32,
    height: 1.1
});
player.addComponent('rigidbody', {
    type: 'dynamic',
    mass: 75,
    friction: 0.0,
    restitution: 0,
    linearDamping: 0.2,
    angularDamping: 0.99
});
player.rigidbody.angularFactor = new pc.Vec3(0, 0, 0);
player.enabled = false;
app.root.addChild(player);

const pickSceneCameraEntity = () => {
    const cameras = app.root.findComponents('camera');
    if (!cameras?.length) return null;

    const preferred = cameras.find((c) => /camera/i.test(c.entity.name)) ?? cameras[0];
    preferred.aspectRatioMode = pc.ASPECT_AUTO;
    preferred.toneMapping = RENDER_SETTINGS.toneMapping;
    return preferred?.entity ?? null;
};

let camera = pickSceneCameraEntity();
if (!camera) {
    camera = new pc.Entity('staff-home-camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.05, 0.06, 0.08),
        farClip: 2000,
        fov: 65,
        toneMapping: RENDER_SETTINGS.toneMapping
    });
    app.root.addChild(camera);
}

const BLOOM_SAMPLE_COUNT = 15;
const computeGaussian = (n, theta) => ((1.0 / Math.sqrt(2 * Math.PI * theta)) * Math.exp(-(n * n) / (2 * theta * theta)));
const calculateBlurValues = (sampleWeights, sampleOffsets, dx, dy, blurAmount) => {
    sampleWeights[0] = computeGaussian(0, blurAmount);
    sampleOffsets[0] = 0;
    sampleOffsets[1] = 0;

    let totalWeights = sampleWeights[0];
    const len = Math.floor(BLOOM_SAMPLE_COUNT / 2);
    for (let i = 0; i < len; i++) {
        const weight = computeGaussian(i + 1, blurAmount);
        sampleWeights[i * 2] = weight;
        sampleWeights[i * 2 + 1] = weight;
        totalWeights += weight * 2;

        const sampleOffset = i * 2 + 1.5;
        sampleOffsets[i * 4] = dx * sampleOffset;
        sampleOffsets[i * 4 + 1] = dy * sampleOffset;
        sampleOffsets[i * 4 + 2] = -dx * sampleOffset;
        sampleOffsets[i * 4 + 3] = -dy * sampleOffset;
    }

    for (let i = 0; i < sampleWeights.length; i++) {
        sampleWeights[i] /= totalWeights;
    }
};

class StaffHomeBloomEffect extends pc.PostEffect {
    constructor(graphicsDevice) {
        super(graphicsDevice);

        const attributes = {
            aPosition: pc.SEMANTIC_POSITION
        };

        const extractFrag = `
            varying vec2 vUv0;
            uniform sampler2D uBaseTexture;
            uniform float uBloomThreshold;
            void main(void)
            {
                vec4 color = texture2D(uBaseTexture, vUv0);
                gl_FragColor = clamp((color - uBloomThreshold) / (1.0 - uBloomThreshold), 0.0, 1.0);
            }
        `;

        const gaussianBlurFrag = `
            #define SAMPLE_COUNT ${BLOOM_SAMPLE_COUNT}
            varying vec2 vUv0;
            uniform sampler2D uBloomTexture;
            uniform vec2 uBlurOffsets[${BLOOM_SAMPLE_COUNT}];
            uniform float uBlurWeights[${BLOOM_SAMPLE_COUNT}];
            void main(void)
            {
                vec4 color = vec4(0.0);
                for (int i = 0; i < SAMPLE_COUNT; i++)
                {
                    color += texture2D(uBloomTexture, vUv0 + uBlurOffsets[i]) * uBlurWeights[i];
                }
                gl_FragColor = color;
            }
        `;

        const combineFrag = `
            varying vec2 vUv0;
            uniform float uBloomEffectIntensity;
            uniform sampler2D uBaseTexture;
            uniform sampler2D uBloomTexture;
            void main(void)
            {
                vec4 bloom = texture2D(uBloomTexture, vUv0) * uBloomEffectIntensity;
                vec4 base = texture2D(uBaseTexture, vUv0);
                base *= (1.0 - clamp(bloom, 0.0, 1.0));
                gl_FragColor = base + bloom;
            }
        `;

        this.extractShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'StaffHomeBloomExtractShader',
            attributes,
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: extractFrag
        });

        this.blurShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'StaffHomeBloomBlurShader',
            attributes,
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: gaussianBlurFrag
        });

        this.combineShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'StaffHomeBloomCombineShader',
            attributes,
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: combineFrag
        });

        this.targets = [];
        this.bloomThreshold = 0.25;
        this.blurAmount = 4;
        this.bloomIntensity = 1;
        this.sampleWeights = new Float32Array(BLOOM_SAMPLE_COUNT);
        this.sampleOffsets = new Float32Array(BLOOM_SAMPLE_COUNT * 2);
    }

    _destroy() {
        if (this.targets) {
            for (let i = 0; i < this.targets.length; i++) {
                this.targets[i].destroyTextureBuffers();
                this.targets[i].destroy();
            }
        }
        this.targets.length = 0;
    }

    _resize(target) {
        const colorBuffer = target?.colorBuffer ?? target?._colorBuffers?.[0] ?? null;
        const width = target?.width ?? colorBuffer?.width ?? this.device.width;
        const height = target?.height ?? colorBuffer?.height ?? this.device.height;
        if (!width || !height) return;
        if (width === this.width && height === this.height) return;

        this.width = width;
        this.height = height;
        this._destroy();

        for (let i = 0; i < 2; i++) {
            const colorBuffer = new pc.Texture(this.device, {
                name: `pe-bloom-${i}`,
                format: pc.PIXELFORMAT_RGBA8,
                width: width >> 1,
                height: height >> 1,
                mipmaps: false
            });
            colorBuffer.minFilter = pc.FILTER_LINEAR;
            colorBuffer.magFilter = pc.FILTER_LINEAR;
            colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            const bloomTarget = new pc.RenderTarget({
                name: `Bloom Render Target ${i}`,
                colorBuffer,
                depth: false
            });
            this.targets.push(bloomTarget);
        }
    }

    render(inputTarget, outputTarget, rect) {
        if (!inputTarget?.colorBuffer) return;
        this._resize(inputTarget);

        const device = this.device;
        const scope = device.scope;

        scope.resolve('uBloomThreshold').setValue(this.bloomThreshold);
        scope.resolve('uBaseTexture').setValue(inputTarget.colorBuffer);
        this.drawQuad(this.targets[0], this.extractShader);

        calculateBlurValues(this.sampleWeights, this.sampleOffsets, 1.0 / this.targets[1].width, 0, this.blurAmount);
        scope.resolve('uBlurWeights[0]').setValue(this.sampleWeights);
        scope.resolve('uBlurOffsets[0]').setValue(this.sampleOffsets);
        scope.resolve('uBloomTexture').setValue(this.targets[0].colorBuffer);
        this.drawQuad(this.targets[1], this.blurShader);

        calculateBlurValues(this.sampleWeights, this.sampleOffsets, 0, 1.0 / this.targets[0].height, this.blurAmount);
        scope.resolve('uBlurWeights[0]').setValue(this.sampleWeights);
        scope.resolve('uBlurOffsets[0]').setValue(this.sampleOffsets);
        scope.resolve('uBloomTexture').setValue(this.targets[1].colorBuffer);
        this.drawQuad(this.targets[0], this.blurShader);

        scope.resolve('uBloomEffectIntensity').setValue(this.bloomIntensity);
        scope.resolve('uBloomTexture').setValue(this.targets[0].colorBuffer);
        scope.resolve('uBaseTexture').setValue(inputTarget.colorBuffer);
        this.drawQuad(outputTarget, this.combineShader, rect);
    }
}

const ensurePostEffects = () => {
    return;
};
ensurePostEffects();

const eyeHeight = 0.85;
const yawPivot = new pc.Entity('player-yaw');
const pitchPivot = new pc.Entity('player-pitch');
yawPivot.addChild(pitchPivot);
pitchPivot.setLocalPosition(0, eyeHeight, 0);
player.addChild(yawPivot);

const attachCameraToPlayer = () => {
    const camPos = camera.getPosition().clone();
    player.setPosition(camPos.x, camPos.y - eyeHeight, camPos.z);
    yawPivot.setLocalEulerAngles(0, 0, 0);
    pitchPivot.setLocalEulerAngles(0, 0, 0);
    camera.reparent(pitchPivot);
    camera.setLocalPosition(0, 0, 0);
    camera.setLocalEulerAngles(0, 0, 0);
};

const detachCameraFromPlayer = () => {
    if (camera.parent === pitchPivot) {
        const camPos = camera.getPosition().clone();
        const camRot = camera.getRotation().clone();
        camera.reparent(app.root);
        camera.setPosition(camPos);
        camera.setRotation(camRot);
    }
};

const pickModelEntity = (ray, outPoint, maxDistance = Number.POSITIVE_INFINITY) => {
    const models = app.root.findComponents('model');
    let best = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    const maxDistSq = Number.isFinite(maxDistance) ? maxDistance * maxDistance : Number.POSITIVE_INFINITY;
    const tmp = new pc.Vec3();
    for (const model of models) {
        if (!model?.enabled || !model.entity?.enabled) continue;
        const meshInstances = model.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
            const mi = meshInstances[i];
            if (!mi?.visible) continue;
            if (!mi?.aabb?.intersectsRay(ray, outPoint)) continue;
            tmp.sub2(outPoint, ray.origin);
            const d = tmp.lengthSq();
            if (d > maxDistSq) continue;
            if (d < bestDistSq) {
                bestDistSq = d;
                best = model.entity;
            }
        }
    }
    return best;
};

const findInteractable = (entity) => {
    if (!entity) return null;
    let current = entity;
    while (current) {
        const found = interactableByEntity.get(current);
        if (found) return found;
        current = current.parent;
    }
    return null;
};

const pickInteractable = (ray, outPoint, maxDistance = Number.POSITIVE_INFINITY) => {
    const models = app.root.findComponents('model');
    let best = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    const maxDistSq = Number.isFinite(maxDistance) ? maxDistance * maxDistance : Number.POSITIVE_INFINITY;
    const tmp = new pc.Vec3();
    const combinedAabb = new pc.BoundingBox();
    let combinedReady = false;
    for (const model of models) {
        if (!model?.enabled || !model.entity?.enabled) continue;
        const interaction = findInteractable(model.entity);
        if (!interaction) continue;
        const inflate = interaction.pickInflate;
        if (inflate) {
            combinedReady = false;
            const meshInstances = model.meshInstances;
            for (let i = 0; i < meshInstances.length; i++) {
                const mi = meshInstances[i];
                if (!mi?.visible) continue;
                if (!mi?.aabb) continue;
                if (!combinedReady) {
                    combinedAabb.copy(mi.aabb);
                    combinedReady = true;
                } else {
                    combinedAabb.add(mi.aabb);
                }
            }
            if (!combinedReady) continue;
            combinedAabb.halfExtents.x += inflate.x;
            combinedAabb.halfExtents.y += inflate.y;
            combinedAabb.halfExtents.z += inflate.z;
            if (!combinedAabb.intersectsRay(ray, outPoint)) continue;
            tmp.sub2(outPoint, ray.origin);
            const d = tmp.lengthSq();
            if (d > maxDistSq) continue;
            if (d < bestDistSq) {
                bestDistSq = d;
                best = interaction;
            }
            continue;
        }
        const meshInstances = model.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
            const mi = meshInstances[i];
            if (!mi?.visible) continue;
            if (!mi?.aabb?.intersectsRay(ray, outPoint)) continue;
            tmp.sub2(outPoint, ray.origin);
            const d = tmp.lengthSq();
            if (d > maxDistSq) continue;
            if (d < bestDistSq) {
                bestDistSq = d;
                best = interaction;
            }
        }
    }
    return best;
};

const attemptInteract = (clientX, clientY) => {
    const cameraComponent = camera?.camera;
    if (!cameraComponent) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * device.width;
    const y = ((clientY - rect.top) / rect.height) * device.height;

    const from = camera.getPosition().clone();
    const to = cameraComponent.screenToWorld(x, y, cameraComponent.farClip, new pc.Vec3());
    const ray = new pc.Ray(from, to.sub(from).normalize());
    const hitPoint = new pc.Vec3();
    const interaction = pickInteractable(ray, hitPoint);
    interaction?.trigger?.();
};

const bounds = computeSceneBounds();
const boundsMin = bounds.getMin().clone();
const boundsMax = bounds.getMax().clone();
const clampToBounds = (entity) => {
    const position = entity.getPosition();
    const paddingXZ = 0.35;
    const paddingYMin = 1.0;
    const paddingYMax = 0.8;
    position.x = pc.math.clamp(position.x, boundsMin.x + paddingXZ, boundsMax.x - paddingXZ);
    position.z = pc.math.clamp(position.z, boundsMin.z + paddingXZ, boundsMax.z - paddingXZ);
    position.y = pc.math.clamp(position.y, boundsMin.y + paddingYMin, boundsMax.y - paddingYMax);
    entity.setPosition(position);
};

const clampPlayerToBounds = () => {
    if (!player.enabled) return;
    const position = player.getPosition();
    const radius = player.collision?.radius ?? 0.3;
    const paddingXZ = radius + 0.05;
    const paddingYMin = 0.05;
    const paddingYMax = 0.8;

    const clampedX = pc.math.clamp(position.x, boundsMin.x + paddingXZ, boundsMax.x - paddingXZ);
    const clampedZ = pc.math.clamp(position.z, boundsMin.z + paddingXZ, boundsMax.z - paddingXZ);
    const clampedY = pc.math.clamp(position.y, boundsMin.y + paddingYMin, boundsMax.y - paddingYMax);

    const moved = clampedX !== position.x || clampedY !== position.y || clampedZ !== position.z;
    if (moved) {
        player.setPosition(clampedX, clampedY, clampedZ);
        const v = player.rigidbody.linearVelocity;
        if (clampedX !== position.x) v.x = 0;
        if (clampedZ !== position.z) v.z = 0;
        if (clampedY !== position.y && v.y < 0) v.y = 0;
        player.rigidbody.linearVelocity = v;
    }
};

let hasFreeSpawned = false;
const tmpSpawnTarget = new pc.Vec3();
const tmpSpawnDir = new pc.Vec3();
const placeFreeSpawnNearCabinet = () => {
    const cabinet = app.root.findByName('hallwaycabinetdoors') ?? app.root.findByName('Cabinet');
    if (!cabinet) return false;

    const cabinetPos = cabinet.getPosition();
    const spawnPos = new pc.Vec3(cabinetPos.x, 1.55, cabinetPos.z + 1.8);
    camera.setPosition(spawnPos);

    tmpSpawnTarget.set(cabinetPos.x, cabinetPos.y + 0.35, cabinetPos.z);
    tmpSpawnDir.sub2(tmpSpawnTarget, spawnPos);
    const len = tmpSpawnDir.length();
    if (len > 0.0001) {
        const yaw = Math.atan2(tmpSpawnDir.x, tmpSpawnDir.z) * pc.math.RAD_TO_DEG;
        const pitch = Math.atan2(-tmpSpawnDir.y, Math.sqrt(tmpSpawnDir.x * tmpSpawnDir.x + tmpSpawnDir.z * tmpSpawnDir.z)) * pc.math.RAD_TO_DEG;
        state.yaw = yaw;
        state.pitch = pc.math.clamp(pitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
        applyCameraAngles();
    }
    return true;
};

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

const LOOK_SPEED = 0.1;
const LOOK_PITCH_MIN = -90;
const LOOK_PITCH_MAX = 90;

const applyCameraAngles = () => {
    if (camera.parent === pitchPivot) {
        yawPivot.setLocalEulerAngles(0, state.yaw, 0);
        pitchPivot.setLocalEulerAngles(state.pitch, 0, 0);
        return;
    }
    camera.setLocalEulerAngles(state.pitch, state.yaw, 0);
};


const setMode = (mode, toolbar) => {
    state.mode = mode;
    toolbar.freeBtn.classList.toggle('selected', mode === 'free');
    toolbar.autoBtn.classList.toggle('selected', mode === 'auto');
    if (mode === 'free') {
        if (!hasFreeSpawned) {
            hasFreeSpawned = placeFreeSpawnNearCabinet();
        } else {
            const eulers = camera.getEulerAngles();
            state.pitch = eulers.x;
            state.yaw = eulers.y;
            state.pitch = pc.math.clamp(state.pitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
        }
        detachCameraFromPlayer();
        attachCameraToPlayer();
        player.enabled = true;
        player.rigidbody.linearVelocity = pc.Vec3.ZERO;
        player.rigidbody.angularVelocity = pc.Vec3.ZERO;
        applyCameraAngles();
        canvas.requestPointerLock?.();
    } else {
        document.exitPointerLock?.();
        player.enabled = false;
        detachCameraFromPlayer();
    }
};

const toolbar = createToolbar();
toolbar.freeBtn.addEventListener('click', () => setMode('free', toolbar));
toolbar.autoBtn.addEventListener('click', () => setMode('auto', toolbar));
setMode('auto', toolbar);

const createCrosshair = () => {
    const style = document.createElement('style');
    style.textContent = `
        #crosshair-cursor {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 100px;
            height: 100px;
            transform: translate(-50%, -50%);
            z-index: 9998;
            pointer-events: none;
        }
        #crosshair-cursor img {
            width: 100%;
            height: 100%;
            display: block;
        }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'crosshair-cursor';
    document.body.appendChild(el);

    const img = document.createElement('img');
    img.alt = '';
    img.src = CROSSHAIR_DEFAULT_URL;
    el.appendChild(img);

    const setVisible = (visible) => {
        el.style.display = visible ? 'block' : 'none';
    };

    const setActive = (active) => {
        img.src = active ? CROSSHAIR_ACTIVE_URL : CROSSHAIR_DEFAULT_URL;
    };

    const setCursor = (cursor) => {
        el.style.cursor = cursor;
    };

    app.on('destroy', () => {
        el.remove();
        style.remove();
    });

    return { setVisible, setActive, setCursor };
};

const crosshair = createCrosshair();
const mousePos = { x: 0, y: 0 };
let hasMouseEvent = false;
let lastMouseButtons = 0;
canvas.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
});

const pickRay = new pc.Ray();
const pickTo = new pc.Vec3();
const pickDir = new pc.Vec3();
const pickHitPoint = new pc.Vec3();
const getInteractionAhead = () => {
    if (!camera) return null;
    pickRay.set(camera.getPosition(), camera.forward);
    return pickInteractable(pickRay, pickHitPoint, 2);
};
const getInteractionAtClient = (clientX, clientY) => {
    const cameraComponent = camera?.camera;
    if (!cameraComponent) return null;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * device.width;
    const y = ((clientY - rect.top) / rect.height) * device.height;

    const from = camera.getPosition();
    cameraComponent.screenToWorld(x, y, cameraComponent.farClip, pickTo);
    pickDir.sub2(pickTo, from).normalize();
    pickRay.set(from, pickDir);
    return pickInteractable(pickRay, pickHitPoint);
};

if (app.mouse) {
    app.mouse.on('mousemove', (e) => {
        if (state.mode !== 'free') return;
        if (document.pointerLockElement !== canvas) return;
        hasMouseEvent = true;
        lastMouseButtons = e.buttons ?? 0;
        const dx = e.dx ?? 0;
        const dy = e.dy ?? 0;
        state.yaw -= LOOK_SPEED * dx;
        state.pitch -= LOOK_SPEED * dy;
        state.pitch = pc.math.clamp(state.pitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
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
    if (!player.enabled) return;

    const forwardInput = (app.keyboard.isPressed(pc.KEY_W) ? 1 : 0) - (app.keyboard.isPressed(pc.KEY_S) ? 1 : 0);
    const rightInput = (app.keyboard.isPressed(pc.KEY_D) ? 1 : 0) - (app.keyboard.isPressed(pc.KEY_A) ? 1 : 0);

    const velocity = player.rigidbody.linearVelocity.clone();
    if (forwardInput !== 0 || rightInput !== 0) {
        const forward = yawPivot.forward.clone();
        forward.y = 0;
        forward.normalize();
        const right = yawPivot.right.clone();
        right.y = 0;
        right.normalize();
        const desired = new pc.Vec3();
        desired.add2(forward.mulScalar(forwardInput), right.mulScalar(rightInput));
        if (desired.lengthSq() > 0) desired.normalize().mulScalar(speed);
        velocity.x = desired.x;
        velocity.z = desired.z;
    } else {
        velocity.x = 0;
        velocity.z = 0;
    }

    const origin = player.getPosition().clone();
    const target = origin.clone().add(new pc.Vec3(0, -0.9, 0));
    const grounded = app.systems.rigidbody.raycastFirst(origin, target) !== null;
    if (grounded && app.keyboard.wasPressed(pc.KEY_SPACE)) {
        velocity.y = 5.2;
    }

    player.rigidbody.linearVelocity = velocity;
};

app.on('update', (dt) => {
    if (state.mode === 'free') {
        applyCameraAngles();
        const locked = document.pointerLockElement === canvas;
        crosshair.setVisible(true);
        const interaction = locked ? (hasMouseEvent ? getInteractionAhead() : null) : getInteractionAtClient(mousePos.x, mousePos.y);
        const hoverActive = !!interaction;
        crosshair.setActive(hoverActive);
        const cursor = !locked && hoverActive ? 'pointer' : 'auto';
        canvas.style.cursor = cursor;
        crosshair.setCursor(cursor);
    } else {
        crosshair.setVisible(false);
        canvas.style.cursor = 'auto';
    }

    for (const interaction of interactables) {
        interaction.update(dt);
    }

    if (state.mode === 'auto') {
        updateAuto(dt);
        return;
    }
    updateFree(dt);
    clampPlayerToBounds();
});

canvas.addEventListener('mousedown', (e) => {
    if (state.mode !== 'free') return;
    if (e.button !== 0) return;
    if (document.pointerLockElement === canvas) {
        const rect = canvas.getBoundingClientRect();
        attemptInteract(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
        return;
    }
    attemptInteract(e.clientX, e.clientY);
});

for (const other of app.root.findComponents('camera')) {
    other.enabled = other.entity === camera;
}

const revealToolbar = () => toolbar.show();
canvas.addEventListener('pointerdown', revealToolbar, { once: true });
setTimeout(revealToolbar, 1200);
