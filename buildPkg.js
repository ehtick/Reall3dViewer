import * as fs from 'fs';
import * as path from 'path';

const srcFile1 = './src/reall3d/sorter/SetupSorter.ts';
const bakFile1 = './pkg/SetupSorter.ts';
const srcFile2 = './src/reall3d/modeldata/worker/SetupFetcher.ts';
const bakFile2 = './pkg/SetupFetcher.ts';
const assetsDir = './pkg/dist/assets';
const descFile = './pkg/dist/pkg.d.ts';
const faviconFile = './pkg/dist/favicon.ico';

if (process.argv.length > 2) {
    process.argv[2] === '--before' && beforeBuildPkg();
    process.argv[2] === '--after' && afterBuildPkg();
}

function afterBuildPkg() {
    fixDescFile(); // 修复 .d.ts
    write(srcFile1, read(bakFile1)); // 从备份文件中恢复SetupSorter.ts
    write(srcFile2, read(bakFile2)); // 从备份文件中恢复SetupSorter.ts
    fs.unlinkSync(faviconFile); // 删除多余文件
    fs.unlinkSync(bakFile1); // 删除备份文件
    fs.unlinkSync(bakFile2); // 删除备份文件
}

function fixDescFile() {
    const lines = read(descFile).split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('declare interface')) {
            lines[i] = 'export ' + lines[i];
        }
    }
    write(descFile, lines.join('\n'));
}

function beforeBuildPkg() {
    beforeBuildPkg1();
    beforeBuildPkg2();
}

function beforeBuildPkg1() {
    write(bakFile1, read(srcFile1));

    const SorterFile = findTargetFile(assetsDir, 'Sorter');
    const base64String = fs.readFileSync(SorterFile).toString('base64');

    const devLines = read(srcFile1).split('\n');
    const pkgLines = [];
    for (let i = 0; i < devLines.length; i++) {
        if (devLines[i].includes(`new URL('./Sorter.ts', import.meta.url)`)) {
            pkgLines.push(`    const SorterBase64 = '';` + '\r');
            pkgLines.push(`    const workerUrl = URL.createObjectURL(new Blob([atob(SorterBase64)], { type: 'text/javascript' }));` + '\r');
            pkgLines.push(`    const worker = new Worker(new URL(workerUrl, import.meta.url), { type: 'module' });` + '\r');
        } else {
            pkgLines.push(devLines[i]);
        }
    }
    for (let i = 0; i < pkgLines.length; i++) {
        if (pkgLines[i].includes('const SorterBase64 =')) {
            if (pkgLines[i].trim() === 'const SorterBase64 =') {
                pkgLines[i + 1] = `        '${base64String}';` + '\r';
            } else {
                pkgLines[i] = `    const SorterBase64 = '${base64String}';` + '\r';
            }
        }
    }
    write(srcFile1, pkgLines.join('\n'));
}

function beforeBuildPkg2() {
    write(bakFile2, read(srcFile2));

    const FetcherFile = findTargetFile(assetsDir, 'Fetcher');
    const base64String = fs.readFileSync(FetcherFile).toString('base64');

    const devLines = read(srcFile2).split('\n');
    const pkgLines = [];
    for (let i = 0; i < devLines.length; i++) {
        if (devLines[i].includes(`new URL('./Fetcher.ts', import.meta.url)`)) {
            pkgLines.push(`    const FetcherBase64 = '';` + '\r');
            pkgLines.push(`    const workerUrl = URL.createObjectURL(new Blob([atob(FetcherBase64)], { type: 'text/javascript' }));` + '\r');
            pkgLines.push(`    const worker = new Worker(new URL(workerUrl, import.meta.url), { type: 'module' });` + '\r');
        } else {
            pkgLines.push(devLines[i]);
        }
    }
    for (let i = 0; i < pkgLines.length; i++) {
        if (pkgLines[i].includes('const FetcherBase64 =')) {
            if (pkgLines[i].trim() === 'const FetcherBase64 =') {
                pkgLines[i + 1] = `        '${base64String}';` + '\r';
            } else {
                pkgLines[i] = `    const FetcherBase64 = '${base64String}';` + '\r';
            }
        }
    }
    write(srcFile2, pkgLines.join('\n'));
}

function read(file, encoding = 'utf-8') {
    return fs.readFileSync(file, encoding);
}

function write(file, text = '', encoding = 'utf-8') {
    fs.writeFileSync(file, text, encoding);
}

function findTargetFile(directoryPath, name = 'Sorter') {
    const files = fs.readdirSync(directoryPath);
    const tgtFiles = files.filter(file => file.startsWith(name) && file.endsWith('.js'));
    return path.join(directoryPath, tgtFiles[0]);
}
