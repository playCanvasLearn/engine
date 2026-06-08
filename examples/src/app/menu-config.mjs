/**
 * 菜单/侧边栏的配置中心（配置驱动 UI 显示与中文文案）
 *
 * 目标：
 * - 不改变路由结构：URL 仍使用 /:category/:example（kebab-case）
 * - 只影响“显示内容”：侧边栏列表可隐藏项、可替换显示名为中文
 * - 可按路径隐藏整块 UI：某些页面不显示侧边栏或顶部菜单
 * - 默认配置自动从现有 examples 生成：基于 src/app/metadata.mjs（由 src/examples 派生）
 *
 * 如何隐藏菜单/侧边栏（按页面路由）：
 * - 在 menuOverrides.hiddenPaths.menu / menuOverrides.hiddenPaths.sidebar 中增加路径即可
 * - 路径支持 '/misc/hello-world' 或 'misc/hello-world'（内部会自动补齐与规范化）
 * - 匹配是“精确匹配 pathname”，仅影响 UI 显示，不改变路由可访问性
 *
 * 如何覆盖默认配置（不需要复制全量 categories）：
 * - 默认 categories 是从 metadata 自动生成（每个分类/示例都有 label/hidden）
 * - 你只需要在 menuOverrides.categories 或按分类拆分文件中写“差异项”
 * - 合并规则：深合并到分类与示例层级（label/hidden 会覆盖默认值）
 *
 * 如何让菜单显示中文：
 * - 分类中文：设置 categories[categoryKebab].label
 * - 示例中文：设置 categories[categoryKebab].examples[exampleKebab].label
 * - 不配置则回退为英文（kebab 拆分 + 大写），不会改变 URL
 *
 * 配置字段说明：
 * - sidebar.title: 侧边栏 Panel 标题
 * - sidebar.filterPlaceholder: 侧边栏筛选输入框 placeholder 文案
 * - categories: 分类/示例的显示名与隐藏配置（key 必须是 kebab-case，与 URL 保持一致）
 *   - categories[categoryKebab].label: 分类显示名（用于侧边栏分类标题）
 *   - categories[categoryKebab].hidden: true 时隐藏整个分类（仅从列表隐藏，URL 仍可直达）
 *   - categories[categoryKebab].examples[exampleKebab].label: 示例显示名（用于侧边栏示例条目）
 *   - categories[categoryKebab].examples[exampleKebab].hidden: true 时隐藏该示例（仅从列表隐藏）
 * - hiddenPaths: 按“路由 pathname”隐藏整块 UI（精确匹配）
 *   - hiddenPaths.sidebar: 命中后 SideBar 直接不渲染（例：'/misc/hello-world' 或 'misc/hello-world'）
 *   - hiddenPaths.menu: 命中后 Menu 直接不渲染（例：'/misc/hello-world' 或 'misc/hello-world'）
 * - categories 可按文件拆分：在 src/app 下新增 menu-category.<categoryKebab>.mjs
 *   - 文件默认导出该分类的配置对象（label/hidden/examples）
 *   - 仅需要写你要覆盖的部分，未写的会走默认生成（来自 metadata）
 *
 * 示例 1（覆盖中文显示名 + 隐藏某个示例）：
 * {
 *   misc: {
 *     label: '杂项',
 *     examples: {
 *       'hello-world': { label: '你好，世界' },
 *       'mini-stats': { label: '性能统计', hidden: true }
 *     }
 *   },
 *   graphics: {
 *     label: '图形',
 *     hidden: true
 *   }
 * }
 *
 * 示例 2（按路径隐藏菜单/侧边栏）：
 * menuOverrides.hiddenPaths.menu = ['/misc/hello-world'];
 * menuOverrides.hiddenPaths.sidebar = ['misc/hello-world'];
 *
 * 示例 3（按分类拆分文件：src/app/menu-category.misc.mjs）：
 * export default {
 *   label: '杂项',
 *   examples: {
 *     'hello-world': { label: '你好，世界' }
 *   }
 * };
 */
import { exampleMetaData } from './metadata.mjs';

/** @param {string} value */
export const humanizeKebab = (value) => value.split('-').join(' ').toUpperCase();

/** @param {string} value */
const normalizePath = (value) => {
    if (!value) {
        return '/';
    }
    const v = value.startsWith('#') ? value.replace(/^#/, '') : value;
    const withSlash = v.startsWith('/') ? v : `/${v}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
};

const buildDefaultCategories = () => {
    /** @type {Record<string, { label: string, hidden: boolean, examples: Record<string, { label: string, hidden: boolean }> }>} */
    const categories = {};
    for (const { categoryKebab, exampleNameKebab } of exampleMetaData) {
        categories[categoryKebab] ??= {
            label: humanizeKebab(categoryKebab),
            hidden: false,
            examples: {}
        };
        categories[categoryKebab].examples[exampleNameKebab] ??= {
            label: humanizeKebab(exampleNameKebab),
            hidden: false
        };
    }
    return categories;
};


/**
 * @param {Record<string, any>} defaults
 * @param {Record<string, any>} overrides
 * @returns {Record<string, any>}
 */
const mergeCategoryTrees = (defaults, overrides) => {
    /** @type {Record<string, any>} */
    const out = {};
    const keys = new Set([...Object.keys(defaults ?? {}), ...Object.keys(overrides ?? {})]);
    for (const key of keys) {
        const base = defaults?.[key] ?? {};
        const over = overrides?.[key] ?? {};
        const baseExamples = base.examples ?? {};
        const overExamples = over.examples ?? {};
        /** @type {Record<string, any>} */
        const examples = {};
        const exampleKeys = new Set([...Object.keys(baseExamples), ...Object.keys(overExamples)]);
        for (const exKey of exampleKeys) {
            examples[exKey] = { ...baseExamples[exKey], ...overExamples[exKey] };
        }
        out[key] = { ...base, ...over, examples };
    }
    return out;
};

const loadCategoryOverrides = () => {
    /** @type {Record<string, any>} */
    const out = {};
    const modules = import.meta.glob('./menu-category.*.mjs', { eager: true });
    for (const key of Object.keys(modules)) {
        const match = /menu-category\.([^./\\\\]+)\.mjs$/.exec(key);
        if (!match) {
            continue;
        }
        const categoryKebab = match[1];
        const mod = /** @type {any} */ (modules[key]);
        out[categoryKebab] = mod?.default ?? mod?.categoryConfig ?? mod;
    }
    return out;
};

export const menuOverrides = {
    sidebar: {
        /*
        title: '鼎宏元景-数字工厂、虚拟现实',
        filterPlaceholder: '筛选...'
        */
    },
    categories: {
        "scene": {
            "label": "场景演示",
            "hidden": false,
            "order": 100,
            "examples": {
                "mes-worker": {
                    "label": "MES机器人工作场景",
                    "hidden": false,
                    "order": 100
                }
            }
        },
        "animation": {
            "label": "动画",
            "hidden": false,
            "examples": {
                "blend-trees-1d": {
                    "label": "混合树1D",
                    "hidden": false
                },
                "blend-trees-2d-cartesian": {
                    "label": "混合树2D笛卡尔",
                    "hidden": false
                },
                "blend-trees-2d-directional": {
                    "label": "混合树2D定向",
                    "hidden": false
                },
                "component-properties": {
                    "label": "组件属性",
                    "hidden": false
                },
                "events": {
                    "label": "事件",
                    "hidden": false
                },
                "layer-masks": {
                    "label": "层遮罩",
                    "hidden": false
                },
                "locomotion": {
                    "label": "行走",
                    "hidden": false
                },
                "tween": {
                    "label": "补间",
                    "hidden": false
                }
            }
        },
        "camera": {
            "label": "相机",
            "hidden": false,
            "examples": {
                "first-person": {
                    "label": "第一人称",
                    "hidden": false
                },
                "fly": {
                    "label": "飞行",
                    "hidden": false
                },
                "multi": {
                    "label": "多",
                    "hidden": false
                },
                "orbit": {
                    "label": "轨道",
                    "hidden": false
                }
            }
        },
        "compute": {
            "label": "计算",
            "hidden": false,
            "examples": {
                "edge-detect": {
                    "label": "边缘检测",
                    "hidden": false
                },
                "histogram": {
                    "label": "直方图",
                    "hidden": false
                },
                "indirect-dispatch": {
                    "label": "间接调度",
                    "hidden": false
                },
                "indirect-draw": {
                    "label": "间接绘制",
                    "hidden": false
                },
                "particles": {
                    "label": "粒子",
                    "hidden": false
                },
                "texture-gen": {
                    "label": "纹理生成",
                    "hidden": false
                },
                "vertex-update": {
                    "label": "顶点更新",
                    "hidden": false
                }
            }
        },
        "gaussian-splatting": {
            "label": "高斯泼溅",
            "hidden": false,
            "examples": {
                "annotations": {
                    "label": "ANNOTATIONS",
                    "hidden": false
                },
                "benchmark": {
                    "label": "BENCHMARK",
                    "hidden": false
                },
                "crop": {
                    "label": "CROP",
                    "hidden": false
                },
                "editor": {
                    "label": "编辑器",
                    "hidden": false
                },
                "first-person": {
                    "label": "第一人称",
                    "hidden": false
                },
                "flipbook": {
                    "label": "FLIPBOOK",
                    "hidden": false
                },
                "global-sorting": {
                    "label": "GLOBAL排序",
                    "hidden": false
                },
                "lod-instances": {
                    "label": "LODINSTANCES",
                    "hidden": false
                },
                "lod-streaming": {
                    "label": "LOD流式",
                    "hidden": false
                },
                "lod-streaming-sh": {
                    "label": "LOD流式SH",
                    "hidden": false
                },
                "lut-grading": {
                    "label": "LUTGRADING",
                    "hidden": false
                },
                "multi-splat": {
                    "label": "多SPLAT",
                    "hidden": false
                },
                "multi-view": {
                    "label": "多视图",
                    "hidden": false
                },
                "paint": {
                    "label": "绘制",
                    "hidden": false
                },
                "picking": {
                    "label": "拾取",
                    "hidden": false
                },
                "procedural-instanced": {
                    "label": "程序化INSTANCED",
                    "hidden": false
                },
                "procedural-mesh": {
                    "label": "程序化网格",
                    "hidden": false
                },
                "procedural-shapes": {
                    "label": "程序化形状",
                    "hidden": false
                },
                "reveal": {
                    "label": "REVEAL",
                    "hidden": false
                },
                "shader-effects": {
                    "label": "着色器效果",
                    "hidden": false
                },
                "shadow-soft": {
                    "label": "阴影柔和",
                    "hidden": false
                },
                "shadows": {
                    "label": "阴影",
                    "hidden": false
                },
                "simple": {
                    "label": "SIMPLE",
                    "hidden": false
                },
                "spherical-harmonics": {
                    "label": "SPHERICALHARMONICS",
                    "hidden": false
                },
                "splat-portal": {
                    "label": "SPLAT传送门",
                    "hidden": false
                },
                "third-person": {
                    "label": "第三人称",
                    "hidden": false
                },
                "viewer": {
                    "label": "查看器",
                    "hidden": false
                },
                "weather": {
                    "label": "WEATHER",
                    "hidden": false
                },
                "world": {
                    "label": "世界",
                    "hidden": false
                },
                "xr-views": {
                    "label": "XRVIEWS",
                    "hidden": false
                }
            }
        },
        "gaussian-splatting-legacy": {
            "label": "高斯泼溅（旧版）",
            "hidden": false,
            "examples": {
                "picking": {
                    "label": "拾取",
                    "hidden": false
                }
            }
        },
        "gaussian-splatting-xr": {
            "label": "高斯泼溅（XR）",
            "hidden": false,
            "examples": {
                "vr-lod": {
                    "label": "VRLOD",
                    "hidden": false
                }
            }
        },
        "gizmos": {
            "label": "控件",
            "hidden": false,
            "examples": {
                "transform-rotate": {
                    "label": "TRANSFORMROTATE",
                    "hidden": false
                },
                "transform-scale": {
                    "label": "TRANSFORMSCALE",
                    "hidden": false
                },
                "transform-translate": {
                    "label": "TRANSFORMTRANSLATE",
                    "hidden": false
                }
            }
        },
        "graphics": {
            "label": "图形",
            "hidden": false,
            "examples": {
                "ambient-occlusion": {
                    "label": "AMBIENTOCCLUSION",
                    "hidden": false
                },
                "area-lights": {
                    "label": "区域灯光",
                    "hidden": false
                },
                "area-picker": {
                    "label": "区域拾取",
                    "hidden": false
                },
                "asset-viewer": {
                    "label": "资源查看器",
                    "hidden": false
                },
                "batching-dynamic": {
                    "label": "BATCHINGDYNAMIC",
                    "hidden": false
                },
                "clustered-area-lights": {
                    "label": "CLUSTERED区域灯光",
                    "hidden": false
                },
                "clustered-lighting": {
                    "label": "CLUSTEREDLIGHTING",
                    "hidden": false
                },
                "clustered-omni-shadows": {
                    "label": "CLUSTEREDOMNI阴影",
                    "hidden": false
                },
                "clustered-spot-shadows": {
                    "label": "CLUSTEREDSPOT阴影",
                    "hidden": false
                },
                "custom-compose-shader": {
                    "label": "CUSTOMCOMPOSE着色器",
                    "hidden": false
                },
                "depth-of-field": {
                    "label": "景深OFFIELD",
                    "hidden": false
                },
                "dithered-transparency": {
                    "label": "抖动透明",
                    "hidden": false
                },
                "hdr": {
                    "label": "HDR",
                    "hidden": false
                },
                "hierarchy": {
                    "label": "层级",
                    "hidden": false
                },
                "instancing-basic": {
                    "label": "实例化基础",
                    "hidden": false
                },
                "instancing-custom": {
                    "label": "实例化CUSTOM",
                    "hidden": false
                },
                "instancing-glb": {
                    "label": "实例化GLB",
                    "hidden": false
                },
                "instancing-gooch": {
                    "label": "实例化GOOCH",
                    "hidden": false
                },
                "layers": {
                    "label": "层",
                    "hidden": false
                },
                "light-physical-units": {
                    "label": "灯光物理单位",
                    "hidden": false
                },
                "lights": {
                    "label": "灯光",
                    "hidden": false
                },
                "lights-baked": {
                    "label": "灯光烘焙",
                    "hidden": false
                },
                "lights-baked-a-o": {
                    "label": "灯光烘焙AO",
                    "hidden": false
                },
                "lines": {
                    "label": "线",
                    "hidden": false
                },
                "mesh-decals": {
                    "label": "网格贴花",
                    "hidden": false
                },
                "mesh-deformation": {
                    "label": "网格变形",
                    "hidden": false
                },
                "mesh-generation": {
                    "label": "网格生成",
                    "hidden": false
                },
                "mesh-morph": {
                    "label": "网格形变",
                    "hidden": false
                },
                "mesh-morph-many": {
                    "label": "网格形变MANY",
                    "hidden": false
                },
                "model-asset": {
                    "label": "模型资源",
                    "hidden": false
                },
                "model-outline": {
                    "label": "模型描边",
                    "hidden": false
                },
                "model-textured-box": {
                    "label": "模型TEXTUREDBOX",
                    "hidden": false
                },
                "multi-draw": {
                    "label": "多绘制",
                    "hidden": false
                },
                "multi-draw-instanced": {
                    "label": "多绘制INSTANCED",
                    "hidden": false
                },
                "multi-draw-instanced-multi-platform": {
                    "label": "多绘制INSTANCED多PLATFORM",
                    "hidden": false
                },
                "multi-render-targets": {
                    "label": "多渲染目标",
                    "hidden": false
                },
                "multi-view": {
                    "label": "多视图",
                    "hidden": false
                },
                "outlines-colored": {
                    "label": "描边COLORED",
                    "hidden": false
                },
                "painter": {
                    "label": "PAINTER",
                    "hidden": false
                },
                "particles-anim-index": {
                    "label": "粒子ANIMINDEX",
                    "hidden": false
                },
                "particles-mesh": {
                    "label": "粒子网格",
                    "hidden": false
                },
                "particles-random-sprites": {
                    "label": "粒子RANDOMSPRITES",
                    "hidden": false
                },
                "particles-snow": {
                    "label": "粒子SNOW",
                    "hidden": false
                },
                "particles-spark": {
                    "label": "粒子SPARK",
                    "hidden": false
                },
                "portal": {
                    "label": "传送门",
                    "hidden": false
                },
                "post-effects": {
                    "label": "后处理效果",
                    "hidden": false
                },
                "post-processing": {
                    "label": "后处理处理",
                    "hidden": false
                },
                "reflection-box": {
                    "label": "反射BOX",
                    "hidden": false
                },
                "reflection-cubemap": {
                    "label": "反射立方体贴图",
                    "hidden": false
                },
                "reflection-planar": {
                    "label": "反射平面",
                    "hidden": false
                },
                "reflection-planar-blurred": {
                    "label": "反射平面BLURRED",
                    "hidden": false
                },
                "render-asset": {
                    "label": "渲染资源",
                    "hidden": false
                },
                "render-pass": {
                    "label": "渲染通道",
                    "hidden": false
                },
                "render-to-texture": {
                    "label": "渲染TO纹理",
                    "hidden": false
                },
                "shadow-cascades": {
                    "label": "阴影级联",
                    "hidden": false
                },
                "shadow-catcher": {
                    "label": "阴影接收器",
                    "hidden": false
                },
                "shadow-soft": {
                    "label": "阴影柔和",
                    "hidden": false
                },
                "shapes": {
                    "label": "形状",
                    "hidden": false
                },
                "sky": {
                    "label": "天空",
                    "hidden": false
                },
                "taa": {
                    "label": "TAA",
                    "hidden": false
                },
                "texture-basis": {
                    "label": "纹理Basis",
                    "hidden": false
                },
                "transform-feedback": {
                    "label": "TRANSFORMFEEDBACK",
                    "hidden": false
                },
                "video-texture": {
                    "label": "视频纹理",
                    "hidden": false
                }
            }
        },
        "input": {
            "label": "输入",
            "hidden": false,
            "examples": {
                "gamepad": {
                    "label": "手柄",
                    "hidden": false
                },
                "keyboard": {
                    "label": "键盘",
                    "hidden": false
                },
                "mouse": {
                    "label": "鼠标",
                    "hidden": false
                }
            }
        },
        "loaders": {
            "label": "加载器",
            "hidden": false,
            "examples": {
                "bundle": {
                    "label": "Bundle",
                    "hidden": false
                },
                "draco-glb": {
                    "label": "DracoGLB",
                    "hidden": false
                },
                "glb": {
                    "label": "GLB",
                    "hidden": false
                },
                "gltf-export": {
                    "label": "GLTF导出",
                    "hidden": false
                },
                "loaders-gl": {
                    "label": "LOADERSGL",
                    "hidden": false
                },
                "obj": {
                    "label": "OBJ",
                    "hidden": false
                },
                "usdz-export": {
                    "label": "USDZ导出",
                    "hidden": false
                }
            }
        },
        "materials": {
            "label": "材质",
            "hidden": false,
            "examples": {
                "anisotropy-disc": {
                    "label": "各向异性DISC",
                    "hidden": false
                },
                "anisotropy-lamp": {
                    "label": "各向异性LAMP",
                    "hidden": false
                },
                "anisotropy-rotation": {
                    "label": "各向异性ROTATION",
                    "hidden": false
                },
                "anisotropy-strength": {
                    "label": "各向异性STRENGTH",
                    "hidden": false
                },
                "clear-coat": {
                    "label": "清漆涂层",
                    "hidden": false
                },
                "dispersion": {
                    "label": "色散",
                    "hidden": false
                },
                "lit-material": {
                    "label": "光照MATERIAL",
                    "hidden": false
                },
                "material-anisotropic": {
                    "label": "MATERIALANISOTROPIC",
                    "hidden": false
                },
                "material-clear-coat": {
                    "label": "MATERIAL清漆涂层",
                    "hidden": false
                },
                "material-physical": {
                    "label": "MATERIAL物理",
                    "hidden": false
                },
                "material-refraction": {
                    "label": "MATERIAL折射",
                    "hidden": false
                },
                "material-translucent-specular": {
                    "label": "MATERIALTRANSLUCENTSPECULAR",
                    "hidden": false
                },
                "material-transparency": {
                    "label": "MATERIAL透明",
                    "hidden": false
                },
                "normals-and-tangents": {
                    "label": "法线AND切线",
                    "hidden": false
                },
                "transmission-roughness": {
                    "label": "透射粗糙度",
                    "hidden": false
                }
            }
        },
        "misc": {
            "label": "杂项",
            "hidden": false,
            "examples": {
                "animated-sprite": {
                    "label": "ANIMATEDSPRITE",
                    "hidden": false
                },
                "annotations": {
                    "label": "ANNOTATIONS",
                    "hidden": false
                },
                "editor": {
                    "label": "编辑器",
                    "hidden": false
                },
                "esm-script": {
                    "label": "ESM脚本",
                    "hidden": false
                },
                "hello-world": {
                    "label": "你好，世界",
                    "hidden": false
                },
                "html-texture": {
                    "label": "HTML纹理",
                    "hidden": false
                },
                "html-texture-configurator": {
                    "label": "HTML纹理CONFIGURATOR",
                    "hidden": false
                },
                "mini-stats": {
                    "label": "性能统计",
                    "hidden": false
                },
                "multi-app": {
                    "label": "多APP",
                    "hidden": false
                },
                "spineboy": {
                    "label": "SPINEBOY",
                    "hidden": false
                }
            }
        },
        "physics": {
            "label": "物理",
            "hidden": false,
            "examples": {
                "compound-collision": {
                    "label": "COMPOUND碰撞",
                    "hidden": false
                },
                "falling-shapes": {
                    "label": "下落形状",
                    "hidden": false
                },
                "offset-collision": {
                    "label": "偏移碰撞",
                    "hidden": false
                },
                "raycast": {
                    "label": "射线检测",
                    "hidden": false
                },
                "vehicle": {
                    "label": "载具",
                    "hidden": false
                }
            }
        },
        "shaders": {
            "label": "着色器",
            "hidden": false,
            "examples": {
                "cloud-shadows": {
                    "label": "云阴影",
                    "hidden": false
                },
                "grab-pass": {
                    "label": "抓取通道",
                    "hidden": false
                },
                "ground-fog": {
                    "label": "地面雾",
                    "hidden": false
                },
                "integer-textures": {
                    "label": "整数TEXTURES",
                    "hidden": false
                },
                "paint-mesh": {
                    "label": "绘制网格",
                    "hidden": false
                },
                "point-cloud": {
                    "label": "点云",
                    "hidden": false
                },
                "point-cloud-simulation": {
                    "label": "点云SIMULATION",
                    "hidden": false
                },
                "shader-burn": {
                    "label": "着色器BURN",
                    "hidden": false
                },
                "shader-hatch": {
                    "label": "着色器HATCH",
                    "hidden": false
                },
                "shader-material": {
                    "label": "着色器MATERIAL",
                    "hidden": false
                },
                "shader-toon": {
                    "label": "着色器卡通",
                    "hidden": false
                },
                "shader-wobble": {
                    "label": "着色器WOBBLE",
                    "hidden": false
                },
                "texture-array": {
                    "label": "纹理ARRAY",
                    "hidden": false
                },
                "trees": {
                    "label": "树",
                    "hidden": false
                }
            }
        },
        "sound": {
            "label": "音频",
            "hidden": false,
            "examples": {
                "positional": {
                    "label": "空间音频",
                    "hidden": false
                }
            }
        },
        "test": {
            "label": "测试",
            "hidden": false,
            "examples": {
                "attenuation": {
                    "label": "ATTENUATION",
                    "hidden": false
                },
                "contact-hardening-shadows": {
                    "label": "CONTACTHARDENING阴影",
                    "hidden": false
                },
                "detail-map": {
                    "label": "DETAILMAP",
                    "hidden": false
                },
                "global-shader-properties": {
                    "label": "GLOBAL着色器属性",
                    "hidden": false
                },
                "material-test": {
                    "label": "MATERIALTEST",
                    "hidden": false
                },
                "opacity": {
                    "label": "OPACITY",
                    "hidden": false
                },
                "parallax-mapping": {
                    "label": "PARALLAXMAPPING",
                    "hidden": false
                },
                "primitive-mode": {
                    "label": "PRIMITIVEMODE",
                    "hidden": false
                },
                "radix-sort": {
                    "label": "RADIX排序",
                    "hidden": false
                },
                "radix-sort-compute": {
                    "label": "RADIX排序COMPUTE",
                    "hidden": false
                },
                "radix-sort-indirect-compute": {
                    "label": "RADIX排序间接COMPUTE",
                    "hidden": false
                },
                "shader-compile": {
                    "label": "着色器COMPILE",
                    "hidden": false
                },
                "specular": {
                    "label": "SPECULAR",
                    "hidden": false
                },
                "taa-alpha": {
                    "label": "TAAALPHA",
                    "hidden": false
                },
                "texture-read": {
                    "label": "纹理READ",
                    "hidden": false
                },
                "two-sided-lighting": {
                    "label": "TWOSIDEDLIGHTING",
                    "hidden": false
                },
                "xr-views": {
                    "label": "XRVIEWS",
                    "hidden": false
                }
            }
        },
        "user-interface": {
            "label": "用户界面",
            "hidden": false,
            "examples": {
                "button-basic": {
                    "label": "BUTTON基础",
                    "hidden": false
                },
                "button-sprite": {
                    "label": "BUTTONSPRITE",
                    "hidden": false
                },
                "custom-shader": {
                    "label": "CUSTOM着色器",
                    "hidden": false
                },
                "layout-group": {
                    "label": "LAYOUTGROUP",
                    "hidden": false
                },
                "panel": {
                    "label": "面板",
                    "hidden": false
                },
                "particle-system": {
                    "label": "PARTICLESYSTEM",
                    "hidden": false
                },
                "scroll-view": {
                    "label": "SCROLL视图",
                    "hidden": false
                },
                "text": {
                    "label": "文本",
                    "hidden": false
                },
                "text-auto-font-size": {
                    "label": "文本AUTOFONTSIZE",
                    "hidden": false
                },
                "text-emojis": {
                    "label": "文本表情",
                    "hidden": false
                },
                "text-localization": {
                    "label": "文本本地化",
                    "hidden": false
                },
                "text-typewriter": {
                    "label": "文本打字机",
                    "hidden": false
                },
                "world-to-screen": {
                    "label": "世界TO屏幕",
                    "hidden": false
                },
                "world-ui": {
                    "label": "世界UI",
                    "hidden": false
                }
            }
        },
        "xr": {
            "label": "XR",
            "hidden": false,
            "examples": {
                "ar-anchors-persistence": {
                    "label": "ARANCHORSPERSISTENCE",
                    "hidden": false
                },
                "ar-basic": {
                    "label": "AR基础",
                    "hidden": false
                },
                "ar-camera-color": {
                    "label": "ARCAMERACOLOR",
                    "hidden": false
                },
                "ar-camera-depth": {
                    "label": "ARCAMERA景深",
                    "hidden": false
                },
                "ar-depth-sensing-placer": {
                    "label": "AR景深SENSINGPLACER",
                    "hidden": false
                },
                "ar-hit-test": {
                    "label": "ARHITTEST",
                    "hidden": false
                },
                "ar-hit-test-anchors": {
                    "label": "ARHITTESTANCHORS",
                    "hidden": false
                },
                "ar-mesh-detection": {
                    "label": "AR网格DETECTION",
                    "hidden": false
                },
                "ar-plane-detection": {
                    "label": "ARPLANEDETECTION",
                    "hidden": false
                },
                "vr-basic": {
                    "label": "VR基础",
                    "hidden": false
                },
                "vr-controllers": {
                    "label": "VR控制器",
                    "hidden": false
                },
                "vr-movement": {
                    "label": "VR移动",
                    "hidden": false
                },
                "vr-test-bed": {
                    "label": "VRTESTBED",
                    "hidden": false
                },
                "xr-hands": {
                    "label": "XRHANDS",
                    "hidden": false
                },
                "xr-menu": {
                    "label": "XR菜单",
                    "hidden": false
                },
                "xr-picking": {
                    "label": "XR拾取",
                    "hidden": false
                },
                "xr-ui": {
                    "label": "XRUI",
                    "hidden": false
                }
            }
        }
    },
    hiddenPaths: {
        /*
        sidebar: ['/misc/hello-world'],
        menu: ['misc/hello-world']
        */
        sidebar: [],
        menu: []
    }
};

export const menuConfig = {
    sidebar: {
        title: '鼎宏元景-数字工厂、虚拟现实',
        filterPlaceholder: '筛选...'
    },
    categories: mergeCategoryTrees(buildDefaultCategories(), mergeCategoryTrees(loadCategoryOverrides(), menuOverrides.categories)),
    hiddenPaths: {
        sidebar: [],
        menu: []
    }
};

/** @param {string} categoryKebab */
export const getCategoryConfig = (categoryKebab) => menuConfig.categories?.[categoryKebab] ?? null;

/** @param {string} categoryKebab @param {string} exampleKebab */
export const getExampleConfig = (categoryKebab, exampleKebab) => {
    const cat = getCategoryConfig(categoryKebab);
    return cat?.examples?.[exampleKebab] ?? null;
};

/** @param {string} categoryKebab */
export const isCategoryHidden = (categoryKebab) => getCategoryConfig(categoryKebab)?.hidden === true;

/** @param {string} categoryKebab @param {string} exampleKebab */
export const isExampleHidden = (categoryKebab, exampleKebab) => getExampleConfig(categoryKebab, exampleKebab)?.hidden === true;

/** @param {string} categoryKebab */
export const getCategoryLabel = (categoryKebab) => getCategoryConfig(categoryKebab)?.label ?? humanizeKebab(categoryKebab);

/** @param {string} categoryKebab @param {string} exampleKebab */
export const getExampleLabel = (categoryKebab, exampleKebab) => getExampleConfig(categoryKebab, exampleKebab)?.label ?? humanizeKebab(exampleKebab);

export const DEFAULT_ORDER = 999;

/** @param {string} categoryKebab */
export const getCategoryOrder = (categoryKebab) => {
    const categories = /** @type {Record<string, any>} */ (/** @type {any} */ (menuOverrides.categories ?? {}));
    const order = categories[categoryKebab]?.order;
    return typeof order === 'number' ? order : DEFAULT_ORDER;
};

/** @param {string} categoryKebab @param {string} exampleKebab */
export const getExampleOrder = (categoryKebab, exampleKebab) => {
    const categories = /** @type {Record<string, any>} */ (/** @type {any} */ (menuOverrides.categories ?? {}));
    const order = categories[categoryKebab]?.examples?.[exampleKebab]?.order;
    return typeof order === 'number' ? order : DEFAULT_ORDER;
};

/** @param {string} a @param {string} b */
export const compareCategories = (a, b) => {
    const ao = getCategoryOrder(a);
    const bo = getCategoryOrder(b);
    if (ao !== bo) {
        return ao - bo;
    }
    return a.localeCompare(b);
};

/** @param {string} categoryKebab @param {string} a @param {string} b */
export const compareExamples = (categoryKebab, a, b) => {
    const ao = getExampleOrder(categoryKebab, a);
    const bo = getExampleOrder(categoryKebab, b);
    if (ao !== bo) {
        return ao - bo;
    }
    return a.localeCompare(b);
};

/** @param {string} pathname */
export const isSidebarHiddenForPath = (pathname) => {
    const path = normalizePath(pathname);
    return (menuConfig.hiddenPaths.sidebar ?? []).map(normalizePath).includes(path);
};

/** @param {string} pathname */
export const isMenuHiddenForPath = (pathname) => {
    const path = normalizePath(pathname);
    return (menuConfig.hiddenPaths.menu ?? []).map(normalizePath).includes(path);
};
