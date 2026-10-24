// node:fs/promises for the bundled upstream providers (see memfs.mjs).
import { promises } from './memfs.mjs';
export const { readFile, writeFile, appendFile, mkdir, stat, rm, unlink, rename, readdir, mkdtemp, access, copyFile, realpath } = promises;
export default promises;
