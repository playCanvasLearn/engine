import * as PCUI from '@playcanvas/pcui';
import * as ReactPCUI from '@playcanvas/pcui/react';
import { Panel, Container, Button } from '@playcanvas/pcui/react';
import React, { Component } from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { useParams } from 'react-router-dom';
const APP_LOGO_DATA_URL = 'data:image/png;base64,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';

import { CodeEditorMobile } from './code-editor/CodeEditorMobile.mjs';
import { DeviceSelector } from './DeviceSelector.mjs';
import { ErrorBoundary } from './ErrorBoundary.mjs';
import { SelectInput as OverlaySelectInput } from './OverlaySelectInput.mjs';
import { COLOR_NAMES, INLINE_MD_PATTERN, SAFE_URL_PATTERN } from '../../../utils/inline-markdown.mjs';
import { CLOSE_SELECTS_EVENT } from '../constants.mjs';
import { iframe } from '../iframe.mjs';
import { jsx, fragment } from '../jsx.mjs';
import { exampleMetaData } from '../metadata.mjs';
import { iframePath } from '../paths.mjs';
import {
    isRecord,
    isVolatileControlPath,
    patchState,
    readState,
    sanitizeControlValue,
    valuesEqual
} from '../url-state.mjs';
import { getLayout } from '../utils.mjs';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ComponentType, ReactElement } from 'react'
 * @import { Credit, ErrorEvent as ExampleErrorEvent, LoadingEvent, StateEvent } from '../events.js'
 */

const SETTLE_WINDOW_MS = 2000;
const MIN_LOADING_MS = 3000;

/** @typedef {{ categoryKebab: string, exampleNameKebab: string, externalUrl?: string }} ExampleMetaItem */

/**
 * @param {string} categoryKebab
 * @param {string} exampleNameKebab
 * @returns {string}
 */
const getExternalUrl = (categoryKebab, exampleNameKebab) => {
    const list = /** @type {ExampleMetaItem[]} */ (/** @type {unknown} */ (exampleMetaData));
    const item = list.find(meta =>
        meta.categoryKebab === categoryKebab && meta.exampleNameKebab === exampleNameKebab
    );
    const url = item?.externalUrl;
    return typeof url === 'string' && url ? url : '';
};

/**
 * Walk a nested controls object, writing each leaf to a flat dot-path map.
 * Arrays are treated as leaf values, not records.
 *
 * @param {any} value - Source value.
 * @param {string} prefix - Current dot-path.
 * @param {Record<string, any>} out - Flat map being built.
 */
const flattenLeaves = (value, prefix, out) => {
    if (isRecord(value)) {
        for (const key of Object.keys(value)) {
            flattenLeaves(value[key], prefix ? `${prefix}.${key}` : key, out);
        }
        return;
    }
    if (prefix) {
        out[prefix] = value;
    }
};

/**
 * Recursive leaf-level diff. Walks both objects in parallel and emits any leaf
 * where current differs from baseline as a flat dot-path entry in `out`.
 *
 * @param {any} baseline - Baseline value at this path.
 * @param {any} current - Current value at this path.
 * @param {string} prefix - Current dot-path.
 * @param {Record<string, any>} out - Diff being built.
 */
const diffLeaves = (baseline, current, prefix, out) => {
    if (isRecord(current) && isRecord(baseline)) {
        for (const key of Object.keys(current)) {
            diffLeaves(baseline[key], current[key], prefix ? `${prefix}.${key}` : key, out);
        }
        return;
    }
    if (isRecord(current)) {
        for (const key of Object.keys(current)) {
            diffLeaves(undefined, current[key], prefix ? `${prefix}.${key}` : key, out);
        }
        return;
    }
    if (!prefix || valuesEqual(baseline, current)) {
        return;
    }
    const safe = sanitizeControlValue(current, prefix);
    if (safe !== undefined) {
        out[prefix] = safe;
    }
};

const CONTROLS_REACT_PCUI = /** @satisfies {typeof ReactPCUI} */ ({
    ...ReactPCUI,
    SelectInput: OverlaySelectInput
});
/**
 * Maps the bare specifiers a controls module imports to the app's own instances, so the compiled
 * (CommonJS) controls resolve them via require() — shared React/PCUI singletons and the SelectInput
 * override, without bundling or a global.
 *
 * @param {string} spec - The module specifier.
 * @returns {any} The resolved module.
 */
const controlsRequire = (spec) => {
    switch (spec) {
        case 'react': return React;
        case 'react/jsx-runtime': return ReactJsxRuntime;
        case '@playcanvas/pcui/react': return CONTROLS_REACT_PCUI;
        case '@playcanvas/pcui': return PCUI;
        case 'playcanvas': return /** @type {any} */ (window).pc;
    }
    throw new Error(`Unknown module: ${spec}`);
};

/** @type {Promise<any> | undefined} - lazily-loaded @babel/standalone, for transpiling controls JSX in the browser */
let babelPromise;
const URL_IN_TEXT_PATTERN = /(https?:\/\/[^\s)]+)/;

/**
 * Renders a plain-text description with a markdown-lite inline subset:
 * `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, and `{color:text}`.
 * Output is a React node array, never an HTML string, so the text content
 * is always auto-escaped by React. Link URLs are restricted to http(s) and
 * mailto. Color names are restricted to a fixed whitelist mapped to CSS
 * classes; unknown names are passed through as literal text.
 *
 * @param {string} text - The source text.
 * @returns {(string | ReactElement)[]} The rendered nodes.
 */
const renderInlineMarkdown = (text) => {
    const nodes = [];
    let lastIndex = 0;
    let key = 0;
    INLINE_MD_PATTERN.lastIndex = 0;
    let match;
    while ((match = INLINE_MD_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }
        if (match[1] !== undefined) {
            nodes.push(jsx('strong', { key: key++ }, match[1]));
        } else if (match[2] !== undefined) {
            nodes.push(jsx('em', { key: key++ }, match[2]));
        } else if (match[3] !== undefined) {
            nodes.push(jsx('code', { key: key++ }, match[3]));
        } else if (match[4] !== undefined) {
            const href = SAFE_URL_PATTERN.test(match[5]) ? match[5] : '#';
            nodes.push(jsx('a', {
                key: key++,
                href,
                target: '_blank',
                rel: 'noopener'
            }, match[4]));
        } else if (COLOR_NAMES.has(match[6])) {
            nodes.push(jsx('span', {
                key: key++,
                className: `example-color-${match[6]}`
            }, match[7]));
        } else {
            nodes.push(match[0]);
        }
        lastIndex = INLINE_MD_PATTERN.lastIndex;
    }
    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }
    return nodes;
};

/** @type {Record<string, string>} */
const MOBILE_PANEL_TITLES = {
    examples: 'EXAMPLES',
    code: 'SOURCE',
    controls: 'CONTROLS',
    description: 'INFO'
};

/** @returns {State} */
const createState = () => {
    const layout = getLayout();
    const ui = readState().ui ?? {};
    const collapsed = typeof ui.controlPanelCollapsed === 'boolean' ? ui.controlPanelCollapsed : layout === 'mobile';
    return {
        layout,
        collapsed,
        loadingVisible: false,
        exampleLoaded: false,
        loadedPath: '',
        loadError: null,
        loadProgress: 0,
        loadStage: '',
        controls: () => null,
        showDeviceSelector: true,
        files: { 'example.mjs': '// loading' },
        observer: null,
        description: '',
        credits: []
    };
};

/**
 * @template {Record<string, string>} [FILES=Record<string, string>]
 * @typedef {object} ExampleOptions
 * @property {HTMLCanvasElement} canvas - The canvas.
 * @property {string} deviceType - The device type.
 * @property {Observer} data - The data.
 * @property {FILES} files - The files.
 */

/**
 * @typedef {object} ControlOptions
 * @property {Observer} observer - The PCUI observer.
 * @property {typeof PCUI} PCUI - The PCUI vanilla module.
 * @property {typeof ReactPCUI} ReactPCUI - The PCUI React module.
 * @property {typeof React} React - The PCUI React module.
 * @property {typeof jsx} jsx - Shortcut for creating a React JSX Element.
 * @property {typeof fragment} fragment - Shortcut for creating a React JSX fragment.
 */

/**
 * @typedef {ComponentType<ControlOptions>} Control
 */

/**
 * @typedef {object} Props
 * @property {{params: {category: string, example: string}}} match - The match object.
 * @property {'mobile'|'desktop'} [layout] - Current layout.
 * @property {null|'examples'|'code'|'controls'|'description'} [mobilePanel] - Active mobile panel.
 * @property {(mobilePanel: null|'examples'|'code'|'controls'|'description') => void} [setMobilePanel] - Set active mobile panel.
 * @property {boolean} [showCredits] - Whether the desktop credits overlay is visible.
 * @property {(event: PointerEvent | import('react').PointerEvent<HTMLElement>) => void} [onMobilePanelDragStart] - Start mobile panel drag.
 */

/**
 * @typedef {object} State
 * @property {'mobile' | 'desktop'} layout - The layout.
 * @property {boolean} collapsed - Collapsed or not.
 * @property {boolean} loadingVisible - Whether the loading overlay is visible.
 * @property {boolean} exampleLoaded - Example is loaded or not.
 * @property {string} loadedPath - The loaded iframe path.
 * @property {{ path: string, message: string } | null} loadError - The current loading error.
 * @property {number} loadProgress - Loading progress in range [0..1].
 * @property {''|'engine'|'fetch'|'config'|'device'|'module'|'load'|'ready'|'error'} loadStage - Loading stage.
 * @property {Control | null} controls - Controls function from example.
 * @property {Observer | null} observer - The PCUI observer
 * @property {boolean} showDeviceSelector - Show device selector.
 * @property {Record<string, string>} files - Files of example (controls, shaders, example itself)
 * @property {string} description - Description of example.
 * @property {Credit[]} credits - Credits for the example.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Example extends TypedComponent {
    /** @type {State} */
    state = createState();

    /** @type {HTMLElement | null} */
    _controlPanelScrollRegion = null;

    /** @type {{ unbind: () => void } | null} */
    _observerHandle = null;

    /** @type {Record<string, any>} */
    _baseline = {};

    /** @type {Record<string, any>} */
    _loadControls = {};

    /** @type {ReturnType<typeof setTimeout> | null} */
    _settleTimer = null;

    /** @type {ReturnType<typeof setTimeout> | null} */
    _loadingHideTimer = null;

    _loadingToken = 0;

    _loadingStartAt = 0;

    _applying = 0;

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._onLayoutChange = this._onLayoutChange.bind(this);
        this._handleRequestedFiles = this._handleRequestedFiles.bind(this);
        this._handleExampleLoading = this._handleExampleLoading.bind(this);
        this._handleExampleProgress = this._handleExampleProgress.bind(this);
        this._handleExampleLoad = this._handleExampleLoad.bind(this);
        this._handleExampleHotReload = this._handleExampleHotReload.bind(this);
        this._handleExampleError = this._handleExampleError.bind(this);
        this._handleUpdateFiles = this._handleUpdateFiles.bind(this);
        this._handleControlPanelScroll = this._handleControlPanelScroll.bind(this);
        this._handleControlSet = this._handleControlSet.bind(this);
        this._captureBaseline = this._captureBaseline.bind(this);
        this._reloadIframe = this._reloadIframe.bind(this);
        this._handleIframeLoad = this._handleIframeLoad.bind(this);
    }

    _startLoading() {
        this._loadingToken++;
        this._loadingStartAt = performance.now();
        if (this._loadingHideTimer) {
            clearTimeout(this._loadingHideTimer);
            this._loadingHideTimer = null;
        }
        this.mergeState({ loadingVisible: true });
    }

    _finishLoading() {
        const token = this._loadingToken;
        const elapsed = performance.now() - this._loadingStartAt;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        if (remaining <= 0) {
            this.mergeState({ loadingVisible: false });
            return;
        }
        this._loadingHideTimer = setTimeout(() => {
            if (token !== this._loadingToken) {
                return;
            }
            if (this.state.loadError) {
                return;
            }
            this.mergeState({ loadingVisible: false });
        }, remaining);
    }

    /**
     * @param {string} src - The controls JSX source.
     * @returns {Promise<Control>} - The controls component.
     */
    async _buildControls(src) {
        // transpile the (possibly edited) JSX in the browser to CommonJS, then run it with the
        // require() shim so it shares the app's React/PCUI/pc instances (and the SelectInput
        // override). Babel is lazy-loaded so it only costs anything the first time controls build.
        const mod = { exports: /** @type {any} */ ({}) };
        try {
            // @ts-ignore - @babel/standalone ships no type declarations
            babelPromise ??= import('@babel/standalone');
            const babel = await babelPromise;
            const { code } = (babel.default ?? babel).transform(src, {
                presets: [['react', { runtime: 'automatic' }]],
                plugins: ['transform-modules-commonjs']
            });
            // eslint-disable-next-line no-new-func
            new Function('require', 'module', 'exports', code)(controlsRequire, mod, mod.exports);
            return mod.exports.Controls ?? mod.exports.controls;
        } catch (e) {
            return () => jsx('pre', null, /** @type {any} */ (e).message);
        }
    }

    /**
     * @param {StateEvent} event - The event.
     */
    _handleRequestedFiles(event) {
        const { files } = event.detail;
        this.mergeState({ files });
    }

    /**
     * Called for resizing and changing layout.
     */
    _onLayoutChange() {
        this.mergeState({ layout: getLayout() });
    }

    /**
     * @param {LoadingEvent} event - The event
     */
    _handleExampleLoading(event) {
        this._startLoading();
        const { showDeviceSelector } = event.detail;
        this.bindObserver(null);
        this.mergeState({
            loadingVisible: true,
            exampleLoaded: false,
            loadedPath: '',
            loadError: null,
            loadProgress: 0,
            loadStage: 'load',
            controls: null,
            showDeviceSelector: showDeviceSelector,
            description: '',
            credits: []
        });
    }

    /**
     * @param {CustomEvent<{ value: number, stage?: string }>} event - The event.
     */
    _handleExampleProgress(event) {
        const value = event.detail?.value;
        const stage = event.detail?.stage;
        if (typeof value !== 'number') {
            return;
        }
        /** @type {State['loadStage']} */
        const safeStage = stage === 'engine' || stage === 'fetch' || stage === 'config' || stage === 'device' || stage === 'module' ||
            stage === 'load' || stage === 'ready' || stage === 'error' ? stage : '';
        this.mergeState({
            loadProgress: Math.min(1, Math.max(0, value)),
            loadStage: safeStage
        });
    }

    /**
     * @param {StateEvent} event - The event.
     */
    async _handleExampleLoad(event) {
        const path = this.iframePath;
        const { files, observer, description, credits = [] } = event.detail;
        const controlsSrc = files['controls.jsx'];
        if (!description && !credits.length && this.props.mobilePanel === 'description') {
            this.props.setMobilePanel?.(null);
        }
        if (controlsSrc) {
            this.bindObserver(observer);
            this.applyControlState(observer);
            const controls = await this._buildControls(controlsSrc);
            this.mergeState({
                loadingVisible: true,
                exampleLoaded: true,
                loadedPath: path,
                loadError: null,
                loadProgress: 1,
                loadStage: 'ready',
                controls,
                observer,
                files,
                description,
                credits
            });
                this._finishLoading();
        } else {
            // When switching examples from one with controls to one without controls...
            this.mergeState({
                    loadingVisible: true,
                exampleLoaded: true,
                loadedPath: path,
                loadError: null,
                loadProgress: 1,
                loadStage: 'ready',
                controls: null,
                observer: null,
                files,
                description,
                credits
            });
            this.bindObserver(null);
            patchState({ controls: {} });
                this._finishLoading();
        }
    }

    _handleExampleHotReload() {
        this._startLoading();
        this.mergeState({
            loadingVisible: true,
            exampleLoaded: false,
            loadedPath: '',
            loadError: null
        });
    }

    _reloadIframe() {
        this._startLoading();
        this.setState({
            loadingVisible: true,
            exampleLoaded: false,
            loadedPath: '',
            loadError: null
        }, () => requestAnimationFrame(() => iframe.reload()));
    }

    /**
     * @param {ExampleErrorEvent} event - The event.
     */
    _handleExampleError(event) {
        this._startLoading();
        const { exampleLoaded, loadedPath } = this.state;
        if (exampleLoaded && loadedPath === this.iframePath) {
            return;
        }
        const { name, message } = event.detail;
        this.mergeState({
            loadingVisible: true,
            exampleLoaded: false,
            loadError: {
                path: this.iframePath,
                message: `${name}: ${message}`
            }
        });
    }

    /**
     * @param {StateEvent} event - The event.
     */
    async _handleUpdateFiles(event) {
        const path = this.iframePath;
        const { files, observer, description, credits = [] } = event.detail;
        const controlsSrc = files['controls.jsx'] ?? '';
        if (!files['controls.jsx']) {
            this.mergeState({
                exampleLoaded: true,
                loadedPath: path,
                loadError: null,
                controls: null,
                observer: null,
                description,
                credits
            });
            this.bindObserver(null);
            patchState({ controls: {} });
            window.dispatchEvent(new CustomEvent('resetErrorBoundary'));
            return;
        }
        this.bindObserver(observer);
        this.applyControlState(observer);
        const controls = await this._buildControls(controlsSrc);
        this.mergeState({
            exampleLoaded: true,
            loadedPath: path,
            loadError: null,
            controls,
            observer,
            description,
            credits
        });
        window.dispatchEvent(new CustomEvent('resetErrorBoundary'));
    }

    /**
     * @param {Partial<State>} state - The partial state to update.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    _handleControlPanelScroll() {
        window.dispatchEvent(new Event(CLOSE_SELECTS_EVENT));
    }

    setupControlPanel() {
        const controlPanel = document.getElementById('controlPanel');
        if (!controlPanel) {
            this._controlPanelScrollRegion?.removeEventListener('scroll', this._handleControlPanelScroll);
            this._controlPanelScrollRegion = null;
            return;
        }

        const scrollRegion = document.getElementById('controlPanel-scroll-region');
        if (this._controlPanelScrollRegion !== scrollRegion) {
            this._controlPanelScrollRegion?.removeEventListener('scroll', this._handleControlPanelScroll);
            this._controlPanelScrollRegion = scrollRegion;
            this._controlPanelScrollRegion?.addEventListener('scroll', this._handleControlPanelScroll, { passive: true });
        }

        // PCUI should just have a "onHeaderClick" but can't find anything
        const controlPanelHeader = /** @type {HTMLElement | null} */ (
            /** @type {unknown} */ (controlPanel.querySelector('.pcui-panel-header'))
        );
        if (!controlPanelHeader) {
            return;
        }

        if (controlPanel.classList.contains('mobile')) {
            const drag = this.props.onMobilePanelDragStart;
            controlPanel.onpointerdown = drag ? event => drag(event) : null;
            controlPanelHeader.onclick = null;
            controlPanelHeader.onpointerdown = null;
            return;
        }

        controlPanel.onpointerdown = null;
        controlPanelHeader.onpointerdown = null;
        controlPanelHeader.onclick = () => this.toggleCollapse();
    }

    componentDidMount() {
        this.setupControlPanel();
        window.addEventListener('resize', this._onLayoutChange);
        window.addEventListener('requestedFiles', this._handleRequestedFiles);
        window.addEventListener('orientationchange', this._onLayoutChange);
        window.addEventListener('exampleLoading', this._handleExampleLoading);
        window.addEventListener('exampleProgress', this._handleExampleProgress);
        window.addEventListener('exampleLoad', this._handleExampleLoad);
        window.addEventListener('exampleHotReload', this._handleExampleHotReload);
        window.addEventListener('exampleError', this._handleExampleError);
        window.addEventListener('updateFiles', this._handleUpdateFiles);
        if (this.externalUrl) {
            this._beginExternalLoading();
        } else {
            iframe.fire('requestFiles');
        }
    }

    /**
     * @param {Props} prevProps - Previous component properties.
     */
    componentDidUpdate(prevProps) {
        const prevParams = prevProps.match.params;
        const params = this.props.match.params;
        if (prevParams.category !== params.category || prevParams.example !== params.example) {
            window.dispatchEvent(new Event(CLOSE_SELECTS_EVENT));
            this.bindObserver(null);
            if (this.externalUrl) {
                this._beginExternalLoading();
            } else {
                iframe.fire('requestFiles');
            }
        }

        this.setupControlPanel();
    }

    componentWillUnmount() {
        window.dispatchEvent(new Event(CLOSE_SELECTS_EVENT));
        this.bindObserver(null);
        this._controlPanelScrollRegion?.removeEventListener('scroll', this._handleControlPanelScroll);
        this._controlPanelScrollRegion = null;
        if (this._loadingHideTimer) {
            clearTimeout(this._loadingHideTimer);
            this._loadingHideTimer = null;
        }
        window.removeEventListener('resize', this._onLayoutChange);
        window.removeEventListener('requestedFiles', this._handleRequestedFiles);
        window.removeEventListener('orientationchange', this._onLayoutChange);
        window.removeEventListener('exampleLoading', this._handleExampleLoading);
        window.removeEventListener('exampleProgress', this._handleExampleProgress);
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
        window.removeEventListener('exampleHotReload', this._handleExampleHotReload);
        window.removeEventListener('exampleError', this._handleExampleError);
        window.removeEventListener('updateFiles', this._handleUpdateFiles);
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    get externalUrl() {
        const categoryKebab = this.props.match.params.category;
        const exampleNameKebab = this.props.match.params.example;
        return getExternalUrl(categoryKebab, exampleNameKebab);
    }

    get iframePath() {
        const externalUrl = this.externalUrl;
        if (externalUrl) {
            return externalUrl;
        }
        const categoryKebab = this.props.match.params.category;
        const exampleNameKebab = this.props.match.params.example;
        return `${iframePath}${categoryKebab}_${exampleNameKebab}.html`;
    }

    _beginExternalLoading() {
        this._startLoading();
        this.bindObserver(null);
        this.mergeState({
            loadingVisible: true,
            exampleLoaded: false,
            loadedPath: '',
            loadError: null,
            loadProgress: 0,
            loadStage: 'load',
            controls: null,
            observer: null,
            showDeviceSelector: false,
            files: {},
            description: '',
            credits: []
        });
    }

    _handleIframeLoad() {
        if (!this.externalUrl) {
            return;
        }
        const path = this.iframePath;
        this.mergeState({
            loadingVisible: true,
            exampleLoaded: true,
            loadedPath: path,
            loadError: null,
            loadProgress: 1,
            loadStage: 'ready',
            controls: null,
            observer: null,
            showDeviceSelector: false,
            files: {},
            description: '',
            credits: []
        });
        this._finishLoading();
    }

    renderDeviceSelector() {
        const { showDeviceSelector } = this.state;

        if (!showDeviceSelector) {
            return null;
        }

        return jsx(DeviceSelector, {
            onSelect: this._reloadIframe
        });
    }

    renderControls() {
        const { exampleLoaded, controls, observer } = this.state;
        const ready = exampleLoaded && controls && observer && iframe.ready;
        if (!ready) {
            return;
        }
        return jsx(
            ErrorBoundary,
            null,
            jsx(controls, {
                observer,
                PCUI,
                ReactPCUI: CONTROLS_REACT_PCUI,
                React,
                jsx,
                fragment
            })
        );
    }

    /**
     * @param {string} href - link href.
     * @param {ReactElement | string} content - link content.
     * @returns {ReactElement} rendered link.
     */
    renderCreditLink(href, content) {
        return jsx('a', {
            href,
            target: '_blank',
            rel: 'noopener'
        }, content);
    }

    /**
     * @param {string} license - license value.
     * @returns {ReactElement | string} rendered license.
     */
    renderLicenseLink(license) {
        const match = URL_IN_TEXT_PATTERN.exec(license);
        if (!match) {
            return license;
        }

        const label = license.slice(0, match.index).trim().replace(/\s*\($/, '').trim();
        return this.renderCreditLink(match[1], label || 'License');
    }

    /**
     * @param {Credit} credit - credit data.
     * @param {number} index - credit index.
     * @returns {ReactElement} rendered credit row.
     */
    renderCredit(credit, index) {
        const source = credit.source ? URL_IN_TEXT_PATTERN.exec(credit.source) : null;
        const label = fragment(
            jsx('span', { className: 'example-credit-title' }, credit.title),
            ' by ',
            jsx('span', { className: 'example-credit-author' }, credit.author)
        );
        /** @type {(ReactElement | string)[]} */
        const children = [source ? this.renderCreditLink(source[1], label) : label];
        if (!source && credit.source) {
            children.push(' \u00b7 ', credit.source);
        }
        if (credit.license) {
            children.push(' \u00b7 ', this.renderLicenseLink(credit.license));
        }
        return jsx(
            'p',
            {
                className: 'example-credit',
                key: index
            },
            ...children
        );
    }

    renderCredits() {
        const { credits } = this.state;
        if (!credits.length) {
            return null;
        }

        return jsx(
            Panel,
            {
                class: ['example-info-subpanel'],
                headerText: 'Credits'
            },
            jsx(
                Container,
                {
                    class: ['example-credits']
                },
                credits.map((credit, index) => this.renderCredit(credit, index))
            )
        );
    }

    /**
     * @param {string} id - The info content id.
     * @param {boolean} [includeDescription] - Whether to include the description block.
     * @returns {ReactElement} rendered info content.
     */
    renderInfoContent(id, includeDescription = false) {
        const { description } = this.state;
        return jsx(
            Container,
            {
                id,
                class: ['example-info-content']
            },
            includeDescription && description ?
                jsx(
                    'div',
                    {
                        className: 'example-description-body example-info-description'
                    },
                    renderInlineMarkdown(description)
                ) :
                null,
            this.renderCredits()
        );
    }

    renderDescription() {
        const { exampleLoaded, description } = this.state;
        if (!exampleLoaded || !description || !iframe.ready) {
            return null;
        }
        return jsx(
            'div',
            {
                id: 'exampleDescription',
                className: 'example-description-body'
            },
            renderInlineMarkdown(description)
        );
    }

    renderCreditsOverlay() {
        const { exampleLoaded, credits } = this.state;
        const { showCredits, layout } = this.props;
        if (layout !== 'desktop' || !showCredits || !exampleLoaded || !iframe.ready || !credits.length) {
            return null;
        }
        return jsx(
            'div',
            { id: 'exampleCredits' },
            credits.map((credit, index) => this.renderCredit(credit, index))
        );
    }

    /**
     * Not the nicest way to fetch UI state from a CSS class, but we are
     * lacking a onHeaderClick panel callback which could hand us the state.
     * This is still better than:
     * 1) Hoping that the toggle functionality just happens to be calibrated
     * to the on/off toggling.
     * 2) Setting "collapsed" state everywhere via informed guesses.
     *
     * @type {boolean}
     */
    get collapsed() {
        const controlPanel = document.getElementById('controlPanel');
        if (!controlPanel) {
            return false;
        }
        const collapsed = controlPanel.classList.contains('pcui-collapsed');
        return collapsed;
    }

    toggleCollapse() {
        const collapsed = !this.collapsed;
        this.mergeState({ collapsed });
        patchState({ ui: { controlPanelCollapsed: collapsed } });
    }

    /**
     * Apply URL-provided control overrides to the observer and arm the settle window.
     * Baseline is captured once at the end of the window so async-init `data.set` calls
     * don't pollute it.
     *
     * @param {Observer} observer - Example observer.
     */
    applyControlState(observer) {
        /** @type {Record<string, any>} */
        const flat = {};
        flattenLeaves(readState().controls, '', flat);
        this._loadControls = flat;
        this._baseline = {};
        if (this._settleTimer) {
            clearTimeout(this._settleTimer);
        }
        this._settleTimer = setTimeout(this._captureBaseline, SETTLE_WINDOW_MS);
        this._applying++;
        for (const path of Object.keys(this._loadControls)) {
            if (observer.has(path)) {
                observer.set(path, this._loadControls[path]);
            }
        }
        this._applying--;
    }

    _captureBaseline() {
        this._settleTimer = null;
        const { observer } = this.state;
        if (!observer) {
            return;
        }
        const snap = sanitizeControlValue(observer.json());
        this._baseline = isRecord(snap) ? /** @type {Record<string, any>} */ (snap) : {};
    }

    /**
     * @param {Observer | null} observer - Example observer.
     */
    bindObserver(observer) {
        this._observerHandle?.unbind();
        this._observerHandle = null;
        if (!observer) {
            this._baseline = {};
            this._loadControls = {};
            if (this._settleTimer) {
                clearTimeout(this._settleTimer);
                this._settleTimer = null;
            }
        }
        if (observer) {
            this._observerHandle = observer.on('*:set', this._handleControlSet);
        }
    }

    /**
     * Within the settle window the example is still doing async init; observer
     * mutations during that window are ignored except when they would clobber a
     * URL-provided override (parent set or exact path). After the window closes,
     * mutations are diffed against the captured baseline and written to the URL.
     *
     * @param {string} path - Observer path.
     */
    _handleControlSet(path) {
        if (isVolatileControlPath(path) || this._applying > 0) {
            return;
        }
        const { observer } = this.state;
        if (!observer) {
            return;
        }
        if (this._settleTimer !== null) {
            for (const urlPath of Object.keys(this._loadControls)) {
                const touched = urlPath === path ||
                    urlPath.startsWith(`${path}.`) ||
                    path.startsWith(`${urlPath}.`);
                if (touched && !valuesEqual(observer.get(urlPath), this._loadControls[urlPath])) {
                    this._applying++;
                    observer.set(urlPath, this._loadControls[urlPath]);
                    this._applying--;
                }
            }
            return;
        }
        this._writeControlsDiff(observer);
    }

    /**
     * @param {Observer} observer - Example observer.
     */
    _writeControlsDiff(observer) {
        const current = sanitizeControlValue(observer.json());
        /** @type {Record<string, any>} */
        const diff = {};
        diffLeaves(this._baseline, isRecord(current) ? current : {}, '', diff);
        patchState({ controls: diff });
    }

    renderMobilePanel() {
        const { mobilePanel } = this.props;
        const { files } = this.state;

        if (mobilePanel === 'code') {
            return jsx(CodeEditorMobile, {
                key: 'code',
                files,
                category: this.props.match.params.category,
                example: this.props.match.params.example
            });
        }

        if (mobilePanel === 'description') {
            return this.renderInfoContent('mobileInfoPanel', true);
        }

        if (mobilePanel === 'controls') {
            return jsx(
                Container,
                {
                    key: 'controls',
                    id: 'mobileControlsPanel'
                },
                this.renderDeviceSelector(),
                jsx(
                    Container,
                    {
                        id: 'controlPanel-scroll-region'
                    },
                    jsx(
                        Container,
                        {
                            id: 'controlPanel-controls'
                        },
                        this.renderControls()
                    )
                )
            );
        }
    }

    renderMobileDock() {
        const { mobilePanel, setMobilePanel } = this.props;
        const { description, credits } = this.state;
        const hasInfo = description || credits.length;
        return jsx(
            Container,
            {
                id: 'mobileDock'
            },
            jsx(Button, {
                key: 'examples',
                text: 'Examples',
                class: mobilePanel === 'examples' ?
                    ['mobile-dock-button', 'mobile-dock-examples', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-examples'],
                onClick: () => setMobilePanel?.('examples')
            }),
            jsx(Button, {
                key: 'code',
                text: 'Source',
                class: mobilePanel === 'code' ?
                    ['mobile-dock-button', 'mobile-dock-code', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-code'],
                onClick: () => setMobilePanel?.('code')
            }),
            jsx(Button, {
                key: 'controls',
                text: 'Controls',
                class: mobilePanel === 'controls' ?
                    ['mobile-dock-button', 'mobile-dock-controls', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-controls'],
                onClick: () => setMobilePanel?.('controls')
            }),
            jsx(Button, {
                key: 'description',
                text: 'Info',
                enabled: Boolean(hasInfo),
                class: mobilePanel === 'description' ?
                    ['mobile-dock-button', 'mobile-dock-description', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-description'],
                onClick: () => setMobilePanel?.('description')
            })
        );
    }

    renderMobile() {
        const { mobilePanel } = this.props;
        const activePanel = mobilePanel && mobilePanel !== 'examples' ? mobilePanel : null;
        return jsx(
            Container,
            {
                id: 'mobileUi'
            },
            activePanel && jsx(
                Panel,
                {
                    key: activePanel,
                    id: 'controlPanel',
                    class: ['mobile', `${activePanel}-sheet`],
                    headerText: MOBILE_PANEL_TITLES[activePanel],
                    collapsible: false
                },
                this.renderMobilePanel()
            ),
            this.renderMobileDock()
        );
    }

    renderDesktop() {
        const { collapsed } = this.state;
        return jsx(
            'div',
            { style: { display: 'contents' } },
            jsx(
                'div',
                {
                    id: 'desktopPanelStack'
                },
                jsx(
                    Panel,
                    {
                        id: 'controlPanel',
                        class: ['desktop'],
                        resizable: 'top',
                        headerText: 'CONTROLS',
                        collapsible: true,
                        collapsed
                    },
                    this.renderDeviceSelector(),
                    jsx(
                        Container,
                        {
                            id: 'controlPanel-scroll-region'
                        },
                        this.renderControls()
                    )
                )
            )
        );
    }

    render() {
        const { iframePath } = this;
        const external = !!this.externalUrl;
        const { loadingVisible, exampleLoaded, loadedPath, loadError, loadProgress, loadStage } = this.state;
        const error = loadError?.path === iframePath ? loadError : null;
        const loading = !!error || loadingVisible || (!exampleLoaded || loadedPath !== iframePath);
        const layout = this.props.layout ?? this.state.layout;
        const mobilePanel = layout === 'mobile' ? this.props.mobilePanel : null;
        const className = mobilePanel ? 'mobile-panel-open' : undefined;
        const stageLabels = /** @type {Record<string, string>} */ ({
            engine: '初始化引擎',
            fetch: '加载资源',
            config: '解析配置',
            device: '初始化设备',
            module: '启动场景',
            load: '加载中',
            ready: '完成',
            error: '加载失败'
        });
        const stageLabel = stageLabels[loadStage] ?? '加载中';
        const progressText = `${Math.round(loadProgress * 100)}%`;
        const currentLabel = `${this.props.match.params.category}/${this.props.match.params.example}`;
        return jsx(
            Container,
            {
                id: 'canvas-container',
                class: className
            },
            (loading || error) && jsx(
                'div',
                {
                    id: 'exampleLoading',
                    className: error ? 'error' : undefined
                },
                jsx(
                    'div',
                    { id: 'application-splash-wrapper' },
                    jsx(
                        'div',
                        { className: 'contentWrapper' },
                        jsx(
                            'div',
                            { className: 'logoSection' },
                            jsx('img', { className: 'appLogo', src: APP_LOGO_DATA_URL, alt: '' }),
                            jsx('h1', { className: 'appName' }, '鼎宏元景-数字工厂、虚拟现实')
                        ),
                        !error && jsx(
                            'div',
                            { className: 'gearbox' },
                            jsx('div', { className: 'overlay' }),
                            jsx(
                                'div',
                                { className: 'gear one' },
                                jsx(
                                    'div',
                                    { className: 'gearInner' },
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' })
                                )
                            ),
                            jsx(
                                'div',
                                { className: 'gear two' },
                                jsx(
                                    'div',
                                    { className: 'gearInner' },
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' })
                                )
                            ),
                            jsx(
                                'div',
                                { className: 'gear three' },
                                jsx(
                                    'div',
                                    { className: 'gearInner' },
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' })
                                )
                            ),
                            jsx(
                                'div',
                                { className: 'gear four large' },
                                jsx(
                                    'div',
                                    { className: 'gearInner' },
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' }),
                                    jsx('div', { className: 'bar' })
                                )
                            )
                        ),
                        !error && jsx(
                            'div',
                            { id: 'progress-bar-container' },
                            jsx('div', { id: 'progress-bar', style: { width: `${Math.round(loadProgress * 100)}%` } })
                        ),
                        error ? fragment(
                            jsx('div', { className: 'example-loading-title' }, '场景加载失败'),
                            jsx('div', { className: 'example-loading-message' }, error.message)
                        ) : fragment(
                            jsx('div', { className: 'example-loading-title' }, stageLabel),
                            jsx('div', { className: 'example-loading-message' }, progressText)
                        )
                    )
                )
            ),
            jsx('iframe', {
                id: 'exampleIframe',
                key: iframePath,
                src: iframePath,
                onLoad: this._handleIframeLoad
            }),
            !external && layout !== 'mobile' && this.renderDescription(),
            !external && layout !== 'mobile' && this.renderCreditsOverlay(),
            !external && (layout === 'mobile' ? this.renderMobile() : this.renderDesktop())
        );
    }
}

/**
 * @param {Omit<Props, 'match'>} props - Component properties.
 * @returns {ReactElement} The Example component with router params.
 */
function ExampleWithRouter(props) {
    const params = useParams();
    // @ts-ignore
    return jsx(Example, { ...props, match: { params } });
}

export { ExampleWithRouter as Example };
