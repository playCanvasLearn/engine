import * as Accordion from '@radix-ui/react-accordion';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Search, Sparkles, X } from 'lucide-react';
import { Component } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { exampleMetaData } from '../metadata.mjs';
import { iframe } from '../iframe.mjs';
import { jsx } from '../jsx.mjs';
import {
    compareCategories,
    compareExamples,
    getCategoryLabel,
    getExampleLabel,
    isCategoryHidden,
    isExampleHidden,
    isSidebarCategoryCollapsed,
    readSidebarCollapsed,
    isSidebarHiddenForPath,
    menuConfig,
    writeSidebarCategoryCollapsedCache,
    writeSidebarCollapsed
} from '../menu-config.mjs';
import { thumbnailPath } from '../paths.mjs';
import { getHashPath, patchState, readState } from '../url-state.mjs';
import { getLayout } from '../utils.mjs';

/** @import { ReactElement } from 'react' */

/**
 * @typedef {object} Props
 * @property {{ pathname: string, hash: string }} location - The router location.
 * @property {'mobile'|'desktop'} [layout] - Current layout.
 * @property {null|'examples'|'code'|'controls'|'description'} [mobilePanel] - Active mobile panel.
 * @property {(mobilePanel: null|'examples'|'code'|'controls'|'description') => void} [setMobilePanel] - Set active mobile panel.
 * @property {(event: PointerEvent | import('react').PointerEvent<HTMLElement>) => void} [onMobilePanelDragStart] - Start mobile panel drag.
 */

/**
 * @typedef {object} State
 * @property {Record<string, { label: string, examples: Record<string, string> }>} defaultCategories - The default categories.
 * @property {Record<string, { label: string, examples: Record<string, string> }>|null} filteredCategories - The filtered categories.
 * @property {boolean} collapsed - Collapsed or not.
 * @property {string[]} expandedCategories - Expanded category keys.
 * @property {string} filterText - The current filter.
 * @property {'mobile'|'desktop'} layout - Current layout.
 */

/**
 * @type {typeof Component<Props, State>}
 */
const TypedComponent = Component;

/**
 * @returns {Record<string, { label: string, examples: Record<string, string> }>} - The category files.
 */
function getDefaultExampleFiles() {
    /** @type {Record<string, { label: string, examples: Record<string, string> }>} */
    const categories = {};
    for (let i = 0; i < exampleMetaData.length; i++) {
        const { categoryKebab, exampleNameKebab, hidden } = exampleMetaData[i];

        // hidden examples are always built and reachable via URL, but are only listed in the
        // sidebar during development (`npm run develop`), not in production builds (`npm run build`)
        if (hidden && process.env.NODE_ENV !== 'development') {
            continue;
        }

        if (isCategoryHidden(categoryKebab) || isExampleHidden(categoryKebab, exampleNameKebab)) {
            continue;
        }

        if (!categories[categoryKebab]) {
            categories[categoryKebab] = { label: getCategoryLabel(categoryKebab), examples: {} };
        }

        categories[categoryKebab].examples[exampleNameKebab] = getExampleLabel(categoryKebab, exampleNameKebab);
    }
    return categories;
}

/**
 * Split a filter string into exact-match `category:`/`example:` tags and fuzzy free-text terms.
 *
 * @param {string} filter - Filter string.
 * @returns {{ cats: string[], exs: string[], text: string }} Parsed tags and joined free text.
 */
function parseFilter(filter) {
    /** @type {string[]} */
    const cats = [];
    /** @type {string[]} */
    const exs = [];
    /** @type {string[]} */
    const terms = [];
    filter.trim().split(/\s+/).forEach((tok) => {
        const tag = /^(category|example):(.+)$/i.exec(tok);
        if (!tag) {
            if (tok) {
                terms.push(tok);
            }
            return;
        }
        (tag[1].toLowerCase() === 'category' ? cats : exs).push(tag[2].toLowerCase());
    });
    // whitespace between free-text terms stays fuzzy, preserving the old behavior
    return { cats, exs, text: terms.join('.*') };
}

/**
 * @param {Record<string, { label: string, examples: Record<string, string> }>} defaultCategories - Default categories.
 * @param {string} filter - Filter string.
 * @returns {Record<string, { label: string, examples: Record<string, string> }> | null} Filtered categories.
 */
function filterCategories(defaultCategories, filter) {
    const { cats, exs, text } = parseFilter(filter);
    if (!cats.length && !exs.length && !text) {
        return null;
    }
    const reg = text ? new RegExp(text, 'i') : null;

    /** @type {Record<string, { label: string, examples: Record<string, string> }>} */
    const updatedCategories = {};
    Object.keys(defaultCategories).forEach((category) => {
        const categoryLabel = defaultCategories[category]?.label ?? category;
        if (category.search(reg) !== -1 || categoryLabel.search(reg) !== -1) {
            updatedCategories[category] = defaultCategories[category];
            return null;
        }
        Object.keys(defaultCategories[category].examples).forEach((example) => {
            const title = defaultCategories[category].examples[example];
            if (example.search(reg) !== -1 || title.search(reg) !== -1) {
                if (!updatedCategories[category]) {
                    updatedCategories[category] = {
                        label: defaultCategories[category].label,
                        examples: {
                            [example]: title
                        }
                    };
                } else {
                    updatedCategories[category].examples[example] = title;
                }
            }
        });
    });
    return updatedCategories;
}

/**
 * @param {Record<string, { label: string, examples: Record<string, string> }>} categories - Categories.
 * @returns {string[]} Expanded categories.
 */
function getExpandedCategories(categories) {
    return Object.keys(categories).filter(category => !isSidebarCategoryCollapsed(category));
}

const createState = () => {
    const ui = readState().ui ?? {};
    const filter = typeof ui.filter === 'string' ? ui.filter : '';
    const collapsed = typeof ui.sideBarCollapsed === 'boolean' ?
        ui.sideBarCollapsed :
        readSidebarCollapsed() || getLayout() === 'mobile';
    const defaultCategories = getDefaultExampleFiles();
    return {
        defaultCategories,
        filteredCategories: filterCategories(defaultCategories, filter),
        filterText: filter,
        collapsed,
        expandedCategories: getExpandedCategories(defaultCategories),
        layout: getLayout()
    };
};

class SideBar extends TypedComponent {
    /** @type {State} */
    state = createState();

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._onLayoutChange = this._onLayoutChange.bind(this);
        this._onClickExample = this._onClickExample.bind(this);
        this._onThumbnailError = this._onThumbnailError.bind(this);
    }

    componentDidMount() {
        this.ensureInitialScroll();
        window.addEventListener('resize', this._onLayoutChange);
        window.addEventListener('orientationchange', this._onLayoutChange);
    }

    componentDidUpdate() {
        this.ensureInitialScroll();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this._onLayoutChange);
        window.removeEventListener('orientationchange', this._onLayoutChange);
    }

    ensureInitialScroll() {
        const sideBar = document.getElementById('sideBar');
        if (!sideBar) {
            return;
        }
        sideBar.classList.add('visible');
        // @ts-ignore
        if (!window._scrolledToExample) {
            const examplePath = getHashPath().split('/');
            document.getElementById(`link-${examplePath[1]}-${examplePath[2]}`)?.scrollIntoView({ block: 'center' });
            // @ts-ignore
            window._scrolledToExample = true;
        }
    }

    /**
     * @param {Partial<State>} state - The partial state to update.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    toggleCollapse() {
        const { collapsed } = this.state;
        writeSidebarCollapsed(!collapsed);
        this.mergeState({ collapsed: !collapsed });
        patchState({ ui: { sideBarCollapsed: !collapsed } });
    }

    _onThumbnailError(event) {
        event.currentTarget.style.display = 'none';
    }

    _onLayoutChange() {
        this.mergeState({ layout: getLayout() });
    }

    /**
     * @param {string[]} nextExpandedCategories - Expanded category values from accordion.
     */
    onExpandedCategoriesChange(nextExpandedCategories) {
        const categories = this.state.filteredCategories || this.state.defaultCategories;
        const visibleCategories = Object.keys(categories);
        const visibleCategorySet = new Set(visibleCategories);
        const mergedExpandedCategories = [
            ...this.state.expandedCategories.filter(category => !visibleCategorySet.has(category)),
            ...nextExpandedCategories
        ];

        visibleCategories.forEach((category) => {
            writeSidebarCategoryCollapsedCache(category, !nextExpandedCategories.includes(category));
        });

        this.mergeState({ expandedCategories: mergedExpandedCategories });
    }

    /**
     * @param {string} filter - The filter string.
     */
    onChangeFilter(filter) {
        const { defaultCategories } = this.state;
        const filteredCategories = filterCategories(defaultCategories, filter);
        const visibleCategories = Object.keys(filteredCategories || defaultCategories);
        const expandedCategories = filter ?
            Array.from(new Set([...this.state.expandedCategories, ...visibleCategories])) :
            this.state.expandedCategories;
        this.mergeState({
            filterText: filter,
            filteredCategories,
            expandedCategories
        });
        patchState({ ui: { filter } });
    }

    clearFilter() {
        this.onChangeFilter('');
    }

    /**
     * @param {import("react").MouseEvent<HTMLAnchorElement, MouseEvent>} e - The event.
     * @param {string} path - The path of example.
     */
    _onClickExample(e, path) {
        if (path === iframe.path) {
            iframe.fire('hotReload');
        } else {
            iframe.fire('destroy');
        }
    }

    renderContents() {
        const categories = this.state.filteredCategories || this.state.defaultCategories;
        const categoryKeys = Object.keys(categories).sort(compareCategories);
        if (categoryKeys.length === 0) {
            return jsx(
                'div',
                { className: 'sidebar-empty' },
                jsx(LayoutGrid, { size: 18 }),
                jsx('span', null, '没有结果')
            );
        }
        const { pathname } = this.props.location;
        return jsx(
            Accordion.Root,
            {
                type: 'multiple',
                className: 'sidebar-accordion',
                value: categoryKeys.filter(category => this.state.expandedCategories.includes(category)),
                onValueChange: this.onExpandedCategoriesChange.bind(this)
            },
            categoryKeys.map((category) => {
                return jsx(
                    Accordion.Item,
                    {
                        key: category,
                        value: category,
                        className: 'sidebar-category'
                    },
                    jsx(
                        Accordion.Header,
                        {
                            asChild: true
                        },
                        jsx(
                            'div',
                            {
                                className: 'sidebar-category-header'
                            },
                            jsx(
                                Accordion.Trigger,
                                {
                                    className: 'sidebar-category-trigger'
                                },
                                jsx(
                                    'div',
                                    { className: 'sidebar-category-copy' },
                                    jsx('span', { className: 'sidebar-category-name' }, categories[category].label ?? category.split('-').join(' ').toUpperCase())// ,
                                    // jsx('span', { className: 'sidebar-category-count' }, `${Object.keys(categories[category].examples).length}项`)
                                ),
                                jsx(ChevronDown, {
                                    size: 16,
                                    className: 'sidebar-category-chevron'
                                })
                            )
                        )
                    ),
                    jsx(
                        Accordion.Content,
                        {
                            className: 'sidebar-category-content'
                        },
                        jsx(
                            'div',
                            {
                                className: 'sidebar-example-list'
                            },
                            Object.keys(categories[category].examples)
                            .sort((a, b) => compareExamples(category, a, b))
                            .map((example) => {
                                const path = `/${category}/${example}`;
                                const isSelected = pathname === path;
                                return jsx(
                                    Link,
                                    {
                                        key: example,
                                        to: path,
                                        onClick: e => this._onClickExample(e, path),
                                        className: `sidebar-example-link ${isSelected ? 'selected' : ''}`
                                    },
                                    jsx(
                                        'article',
                                        {
                                            className: `sidebar-example-card ${isSelected ? 'selected' : ''}`,
                                            id: `link-${category}-${example}`
                                        },
                                        jsx(
                                            'div',
                                            { className: 'sidebar-thumbnail-frame' },
                                            jsx('img', {
                                                className: 'sidebar-thumbnail',
                                                loading: 'lazy',
                                                src: `${thumbnailPath}${category}_${example}_large.webp`,
                                                onError: this._onThumbnailError
                                            }),
                                            jsx(
                                                'div',
                                                {
                                                    className: 'sidebar-example-copy'
                                                },
                                                jsx('div', { className: 'sidebar-example-title' }, categories[category].examples[example])
                                            )
                                        )
                                    )
                                );
                            })
                        )
                    )
                );
            })
        );
    }

    render() {
        const { collapsed, filterText } = this.state;
        const layout = this.props.layout ?? this.state.layout;
        if (isSidebarHiddenForPath(this.props.location.pathname)) {
            return null;
        }
        if (layout === 'mobile' && this.props.mobilePanel !== 'examples') {
            return null;
        }
        const open = layout === 'mobile' ? true : !collapsed;
        return jsx(
            Collapsible.Root,
            {
                id: 'sideBar',
                open,
                className: `sidebar-shell ${layout === 'mobile' ? 'mobile-sheet' : 'desktop-shell'} ${collapsed && layout !== 'mobile' ? 'collapsed' : ''}`
            },
            jsx(
                'div',
                {
                    className: 'sidebar-header',
                    onPointerDown: layout === 'mobile' ? this.props.onMobilePanelDragStart : undefined
                },
                jsx(
                    'div',
                    {
                        className: 'sidebar-header-copy'
                    },
                    jsx(
                        'div',
                        { className: 'sidebar-title-row' },
                        // jsx(Sparkles, { size: 16, className: 'sidebar-title-icon' }),
                        jsx('h2', { className: 'sidebar-title' }, '鼎宏元景')
                    )
                ),
                layout !== 'mobile' && jsx(
                    Collapsible.Trigger,
                    {
                        type: 'button',
                        className: 'sidebar-collapse-button',
                        'aria-label': collapsed ? '展开菜单' : '折叠菜单',
                        onClick: this.toggleCollapse.bind(this)
                    },
                    collapsed ? jsx(ChevronRight, { size: 18 }) : jsx(ChevronLeft, { size: 18 })
                )
            ),
            open && jsx(
                Collapsible.Content,
                {
                    className: 'sidebar-content'
                },
                jsx(
                    'div',
                    {
                        className: 'sidebar-filter-shell'
                    },
                    jsx(Search, { size: 16, className: 'sidebar-filter-icon' }),
                    jsx('input', {
                        type: 'text',
                        className: 'sidebar-filter-input',
                        placeholder: menuConfig.sidebar.filterPlaceholder,
                        value: filterText,
                        onChange: event => this.onChangeFilter(event.target.value)
                    }),
                    filterText ? jsx(
                        'button',
                        {
                            type: 'button',
                            className: 'sidebar-filter-clear',
                            onClick: this.clearFilter.bind(this),
                            'aria-label': '清空筛选'
                        },
                        jsx(X, { size: 14 })
                    ) : null
                ),
                jsx('div', { id: 'sideBar-contents' }, this.renderContents())
            )
        );
    }
}

/**
 * @param {Omit<Props, 'location'>} props - Component properties.
 * @returns {ReactElement} The SideBar component with router location.
 */
function SideBarWithRouter(props) {
    const location = useLocation();
    return jsx(SideBar, { ...props, location });
}

export { SideBarWithRouter as SideBar };
