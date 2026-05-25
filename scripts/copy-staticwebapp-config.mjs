import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.resolve('staticwebapp.config.json');
const outputPath = path.resolve('dist/staticwebapp.config.json');

await mkdir(path.dirname(outputPath), { recursive: true });
await copyFile(sourcePath, outputPath);

console.log('Copied staticwebapp.config.json to dist.');
