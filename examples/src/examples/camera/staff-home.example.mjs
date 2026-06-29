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
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem
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
    const graph = entity?.model?.model?.graph ?? null;
    const resolvedNodes = new Map();
    const tmp = new pc.Vec3();
    const apply = (clip, time) => {
        if (!graph) return;
        for (const track of clip.nodes) {
            let node = resolvedNodes.get(track.name);
            if (node === undefined) {
                node = graph.findByName(track.name) ?? null;
                resolvedNodes.set(track.name, node);
            }
            if (!node) continue;
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

    return { entity: state.entity, trigger, update, isBusy: () => state.playing };
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

const createFaucetInteractor = async (entityName, openAnim, closeAnim) => {
    const loop = createLoopAudio(`${SOUNDS_URL}sinkwater_loop.wav`, 0.6);
    return createToggleInteractor({
        entityName,
        openAnim,
        closeAnim,
        onOpenSound: () => loop.play(),
        onCloseStart: () => {
            loop.stop();
            playOneShotAudio(`${SOUNDS_URL}sinkwater_off.wav`, 0.75);
        }
    });
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

const eyeHeight = 0.85;
const yawPivot = new pc.Entity('player-yaw');
const pitchPivot = new pc.Entity('player-pitch');
yawPivot.addChild(pitchPivot);
pitchPivot.setLocalPosition(0, eyeHeight, 0);
player.addChild(yawPivot);

const attachCameraToPlayer = () => {
    const camPos = camera.getPosition().clone();
    const camRot = camera.getRotation().clone();
    player.setPosition(camPos.x, camPos.y - eyeHeight, camPos.z);
    yawPivot.setLocalEulerAngles(0, 0, 0);
    pitchPivot.setLocalEulerAngles(0, 0, 0);
    camera.reparent(pitchPivot);
    camera.setLocalPosition(0, 0, 0);
    camera.setRotation(camRot);
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
    const hit = pickModelEntity(ray, hitPoint);
    const interaction = findInteractable(hit);
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
    const hit = pickModelEntity(pickRay, pickHitPoint, 2);
    return findInteractable(hit);
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
    const hit = pickModelEntity(pickRay, pickHitPoint);
    return findInteractable(hit);
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
