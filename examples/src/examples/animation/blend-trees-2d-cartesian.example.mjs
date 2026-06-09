// @config
//
// 数字人常见动作 + 表情
// 应用场景：用于产线巡检 / 设备操作辅助 / 安全规范演示 / 新员工培训 / 远程协作指导

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    playcanvasGreyTexture: new pc.Asset('playcanvasGreyTexture', 'texture', {
        url: './assets/textures/floor_01.jpg'
    }),
    model: new pc.Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/idle.glb' }),
    walkAnim: new pc.Asset('walkAnim', 'container', { url: './assets/animations/bitmoji/walk.glb' }),
    jogAnim: new pc.Asset('jogAnim', 'container', { url: './assets/animations/bitmoji/run.glb' }),
    eagerAnim: new pc.Asset('eagerAnim', 'container', {
        url: './assets/animations/bitmoji/idle-eager.glb'
    }),
    danceAnim: new pc.Asset('danceAnim', 'container', {
        url: './assets/animations/bitmoji/win-dance.glb'
    }),
    jumpAnim: new pc.Asset('jumpAnim', 'container', {
        url: './assets/animations/bitmoji/jump-flip.glb'
    }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
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
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.skyboxIntensity = 0.7;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.name = 'Camera';
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.15, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    cameraEntity.translateLocal(0.5, 3, 8);
    cameraEntity.rotateLocal(-30, 0, 0);
    app.root.addChild(cameraEntity);

    // Create an entity with a light component
    const lightEntity = new pc.Entity();
    lightEntity.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        castShadows: true,
        intensity: 2,
        shadowBias: 0.2,
        shadowDistance: 16,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    app.root.addChild(lightEntity);
    lightEntity.setLocalEulerAngles(60, 30, 0);

    const characterEntity = new pc.Entity();

    // create an entity from the loaded model using the render component
    const renderEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: true
    });
    renderEntity.name = 'model';

    // keep the same character mounting style as locomotion, so the displayed size and scene feel match
    characterEntity.addChild(renderEntity);

    // add an anim component to the entity
    characterEntity.addComponent('anim', {
        activate: true
    });

    // create an anim state graph
    const animStateGraphData = {
        layers: [
            {
                name: 'locomotion',
                states: [
                    {
                        name: 'START'
                    },
                    {
                        name: 'Idle',
                        speed: 1.0
                    },
                    {
                        name: 'Walk',
                        speed: 1.0
                    },
                    {
                        name: 'Jump',
                        speed: 1
                    },
                    {
                        name: 'Jog',
                        speed: 1.0
                    },
                    {
                        name: 'Blend',
                        speed: 1.0,
                        loop: true,
                        blendTree: {
                            type: pc.ANIM_BLEND_2D_CARTESIAN,
                            parameters: ['posX', 'posY'],
                            children: [
                                {
                                    name: 'Idle',
                                    point: [-0.5, 0.5]
                                },
                                {
                                    name: 'Eager',
                                    point: [0.5, 0.5]
                                },
                                {
                                    name: 'Walk',
                                    point: [0.5, -0.5]
                                },
                                {
                                    name: 'Dance',
                                    point: [-0.5, -0.5]
                                }
                            ]
                        }
                    },
                    {
                        name: 'END'
                    }
                ],
                transitions: [
                    {
                        from: 'START',
                        to: 'Idle',
                        time: 0,
                        priority: 0
                    },
                    {
                        from: 'Idle',
                        to: 'Walk',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'speed',
                                predicate: pc.ANIM_GREATER_THAN,
                                value: 0
                            }
                        ]
                    },
                    {
                        from: 'ANY',
                        to: 'Jump',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'jump',
                                predicate: pc.ANIM_EQUAL_TO,
                                value: true
                            }
                        ]
                    },
                    {
                        from: 'ANY',
                        to: 'Blend',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'mode',
                                predicate: pc.ANIM_EQUAL_TO,
                                value: 1
                            }
                        ]
                    },
                    {
                        from: 'Jump',
                        to: 'Idle',
                        time: 0.2,
                        priority: 0,
                        exitTime: 0.8
                    },
                    {
                        from: 'Jump',
                        to: 'Walk',
                        time: 0.2,
                        priority: 0,
                        exitTime: 0.8
                    },
                    {
                        from: 'Walk',
                        to: 'Idle',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'speed',
                                predicate: pc.ANIM_LESS_THAN_EQUAL_TO,
                                value: 0
                            }
                        ]
                    },
                    {
                        from: 'Walk',
                        to: 'Jog',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'speed',
                                predicate: pc.ANIM_GREATER_THAN,
                                value: 1
                            }
                        ]
                    },
                    {
                        from: 'Jog',
                        to: 'Walk',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'speed',
                                predicate: pc.ANIM_LESS_THAN,
                                value: 2
                            }
                        ]
                    },
                    {
                        from: 'Blend',
                        to: 'Idle',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'mode',
                                predicate: pc.ANIM_EQUAL_TO,
                                value: 0
                            },
                            {
                                parameterName: 'speed',
                                predicate: pc.ANIM_LESS_THAN_EQUAL_TO,
                                value: 0
                            }
                        ]
                    },
                    {
                        from: 'Blend',
                        to: 'Walk',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'mode',
                                predicate: pc.ANIM_EQUAL_TO,
                                value: 0
                            },
                            {
                                parameterName: 'speed',
                                predicate: pc.ANIM_GREATER_THAN,
                                value: 0
                            }
                        ]
                    },
                    {
                        from: 'Blend',
                        to: 'Jog',
                        time: 0.1,
                        priority: 0,
                        conditions: [
                            {
                                parameterName: 'mode',
                                predicate: pc.ANIM_EQUAL_TO,
                                value: 0
                            },
                            {
                                parameterName: 'speed',
                                predicate: pc.ANIM_GREATER_THAN,
                                value: 1
                            }
                        ]
                    }
                ]
            }
        ],
        parameters: {
            speed: {
                name: 'speed',
                type: pc.ANIM_PARAMETER_INTEGER,
                value: 0
            },
            jump: {
                name: 'jump',
                type: pc.ANIM_PARAMETER_TRIGGER,
                value: false
            },
            mode: {
                name: 'mode',
                type: pc.ANIM_PARAMETER_INTEGER,
                value: 0
            },
            posX: {
                name: 'posX',
                type: 'FLOAT',
                value: -0.5
            },
            posY: {
                name: 'posY',
                type: 'FLOAT',
                value: 0.5
            }
        }
    };

    // load the state graph into the anim component
    characterEntity.anim.loadStateGraph(animStateGraphData);

    // load the state graph asset resource into the anim component
    const characterStateLayer = characterEntity.anim.baseLayer;
    characterStateLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Jog', assets.jogAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Jump', assets.jumpAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Blend.Idle', assets.idleAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Blend.Eager', assets.eagerAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Blend.Walk', assets.walkAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Blend.Dance', assets.danceAnim.resource.animations[0].resource);

    data.set('jogToggle', false);

    const currentPosition = new pc.Vec3();
    const targetPosition = new pc.Vec3();
    const moveDirection = new pc.Vec3();
    const characterDirection = new pc.Vec3();
    const moveVector = new pc.Vec3();
    const lookTarget = new pc.Vec3();
    let moving = false;

    const stopMoving = () => {
        moving = false;
        characterEntity.anim.setInteger('mode', 0);
        characterEntity.anim.setInteger('speed', 0);
    };

    const setBlendPose = (x, y) => {
        moving = false;
        characterEntity.anim.setInteger('speed', 0);
        characterEntity.anim.setInteger('mode', 1);
        characterEntity.anim.setFloat('posX', x);
        characterEntity.anim.setFloat('posY', y);
    };

    data.on('stop', () => {
        stopMoving();
    });

    data.on('jump', () => {
        const isJumping = characterEntity.anim.baseLayer.activeState === 'Jump';
        if (!isJumping) {
            characterEntity.anim.setInteger('mode', 0);
            characterEntity.anim.setTrigger('jump');
        }
    });

    data.on('poseIdle', () => {
        setBlendPose(-0.5, 0.5);
    });

    data.on('poseEager', () => {
        setBlendPose(0.5, 0.5);
    });

    data.on('poseWalk', () => {
        setBlendPose(0.5, -0.5);
    });

    data.on('poseWalkEager', () => {
        setBlendPose(0.5, -0.25);
    });

    data.on('poseDance', () => {
        setBlendPose(-0.5, -0.5);
    });

    app.root.addChild(characterEntity);

    const planeEntity = new pc.Entity();
    planeEntity.name = 'Plane';
    planeEntity.addComponent('render', {
        type: 'plane'
    });
    planeEntity.setLocalScale(15, 1, 15);
    planeEntity.setPosition(0, 0, 0);
    const material = new pc.StandardMaterial();
    assets.playcanvasGreyTexture.resource.addressU = pc.ADDRESS_REPEAT;
    assets.playcanvasGreyTexture.resource.addressV = pc.ADDRESS_REPEAT;
    material.diffuseMap = assets.playcanvasGreyTexture.resource;
    material.diffuseMapTiling = new pc.Vec2(20, 20);
    material.update();
    planeEntity.render.meshInstances[0].material = material;
    app.root.addChild(planeEntity);

    const onMouseDown = (event) => {
        if (event.button !== 0) return;
        const near = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.nearClip);
        const far = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip);
        const denom = far.y - near.y;
        if (Math.abs(denom) < 1e-6) {
            return;
        }
        const t = -near.y / denom;
        if (t < 0 || t > 1) {
            return;
        }
        targetPosition.lerp(near, far, t);
        targetPosition.y = 0;
        moving = true;
        characterEntity.anim.setInteger('mode', 0);
        characterEntity.anim.setInteger('speed', data.get('jogToggle') ? 2 : 1);
    };
    document.addEventListener('mousedown', onMouseDown);
    app.on('destroy', () => {
        document.removeEventListener('mousedown', onMouseDown);
    });

    app.on('update', (dt) => {
        if (!moving) {
            return;
        }
        moveVector.sub2(targetPosition, currentPosition);
        const distance = moveVector.length();
        if (distance < 0.05) {
            currentPosition.copy(targetPosition);
            characterEntity.setPosition(currentPosition);
            stopMoving();
            return;
        }
        moveDirection.copy(moveVector).normalize();
        let speed = 0;
        switch (characterEntity.anim.baseLayer.activeState) {
            case 'Walk':
                speed = 1.0;
                break;
            case 'Jog':
                speed = 4.0;
                break;
            default:
                speed = 0.0;
                break;
        }
        if (characterEntity.anim.baseLayer.transitioning) {
            let previousSpeed = 0;
            switch (characterEntity.anim.baseLayer.previousState) {
                case 'Walk':
                    previousSpeed = 1.0;
                    break;
                case 'Jog':
                    previousSpeed = 4.0;
                    break;
            }
            const progress = characterEntity.anim.baseLayer.transitionProgress;
            speed = previousSpeed * (1.0 - progress) + speed * progress;
        }
        const step = Math.min(distance, dt * speed);
        currentPosition.add(moveDirection.clone().mulScalar(step));
        characterEntity.setPosition(currentPosition);
        characterDirection.copy(moveDirection).mulScalar(-1);
        lookTarget.add2(currentPosition, characterDirection);
        characterEntity.lookAt(lookTarget);
    });

    app.start();
});
