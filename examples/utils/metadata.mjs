import fs from 'node:fs';
import path from 'node:path';

import { parseConfig } from './example-source.mjs';
import { bold, createdLog, startLog, writeLog, YELLOW } from './log.mjs';
import { toKebabCase } from '../src/app/strings.mjs';

const ROOT_PATH = 'src/examples';
const OUTPUT = 'cache/metadata.mjs';
const APP_OUTPUT = 'src/app/metadata.mjs';
const APP_DIR = 'src/app/metadata';
const APP_PREFIX = `${APP_DIR}/metadata.`;
const LOG_HIDDEN_EXAMPLES = process.env.NODE_ENV === 'production';

/**
 * @typedef {object} ExampleMetadata
 * @property {string} path - The example directory.
 * @property {string} categoryKebab - The category name.
 * @property {string} exampleNameKebab - The example name.
 * @property {boolean} hidden - True if hidden from the production sidebar.
 */

/**
 * @param {object} obj - The object.
 * @returns {string} - The stringified object
 */
const objStringify = (obj) => {
    return JSON.stringify(obj, null, 4).replace(/"(\w+)":/g, '$1:');
};

const stableSort = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

const createAppIndex = (categories) => {
    const imports = categories.map((categoryKebab) => {
        const name = categoryKebab.replace(/-/g, '_');
        return `import { exampleMetaData as ${name} } from './metadata/metadata.${categoryKebab}.mjs';`;
    }).join('\n');
    const list = categories.map((categoryKebab) => categoryKebab.replace(/-/g, '_')).join(',\n    ');
    return `${imports}\n\nexport const exampleMetaData = [\n    ${list}\n].flat();\n`;
};

/**
 * @param {string} dir - The directory path.
 * @returns {string[]} - The file names in the directory.
 */
const getDirFiles = (dir) => {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
        return [];
    }
    return fs.readdirSync(dir);
};

/**
 * @returns {void} no return value.
 */
export const buildMetadata = () => {
    startLog('metadata', OUTPUT);
    const start = performance.now();
    const categories = getDirFiles(ROOT_PATH);
    /** @type {ExampleMetadata[]} */
    const exampleMetaData = [];
    const hiddenExamples = [];

    categories.forEach((category) => {
        const categoryPath = path.normalize(`${ROOT_PATH}/${category}`);
        const examplesFiles = getDirFiles(categoryPath);
        const categoryKebab = toKebabCase(category);

        examplesFiles.forEach((exampleFile) => {
            if (!/example.mjs$/.test(exampleFile)) {
                return;
            }
            const examplePath = path.normalize(`${categoryPath}/${exampleFile}`);
            const exampleName = exampleFile.split('.').shift() ?? '';
            const exampleNameKebab = toKebabCase(exampleName);
            const config = parseConfig(fs.readFileSync(examplePath, 'utf-8'));
            const hidden = !!config.HIDDEN;

            if (hidden) {
                hiddenExamples.push(`${categoryKebab}/${exampleNameKebab}`);
            }

            exampleMetaData.push({
                path: categoryPath,
                categoryKebab,
                exampleNameKebab,
                hidden
            });
        });
    });

    fs.mkdirSync('cache', { recursive: true });
    fs.writeFileSync(OUTPUT, `export const exampleMetaData = ${objStringify(exampleMetaData)};\n`);

    const perCategory = new Map();
    for (const item of exampleMetaData) {
        if (!perCategory.has(item.categoryKebab)) {
            perCategory.set(item.categoryKebab, []);
        }
        perCategory.get(item.categoryKebab).push(item);
    }
    const categoryKeys = [...perCategory.keys()].sort(stableSort);
    fs.mkdirSync(APP_DIR, { recursive: true });
    for (const categoryKebab of categoryKeys) {
        const items = perCategory.get(categoryKebab).sort((a, b) => stableSort(a.exampleNameKebab, b.exampleNameKebab));
        const outFile = `${APP_PREFIX}${categoryKebab}.mjs`;
        fs.writeFileSync(outFile, `export const exampleMetaData = ${objStringify(items)};\n`);
    }
    fs.writeFileSync(APP_OUTPUT, createAppIndex(categoryKeys));

    if (LOG_HIDDEN_EXAMPLES && hiddenExamples.length) {
        writeLog(process.stderr, YELLOW, `hidden examples (${bold(hiddenExamples.length)})`);
        hiddenExamples.forEach(example => writeLog(process.stderr, YELLOW, `  ${example}`));
    }

    createdLog(OUTPUT, performance.now() - start);
};
