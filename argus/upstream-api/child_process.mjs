// node:child_process for the bundled upstream providers: only the OpenAI login uses it, and it is off here.
const no = () => { throw new Error('not available in the Worker') };
export const spawn = no, execFile = no, exec = no, execSync = no, spawnSync = no, execFileSync = no, fork = no;
export default { spawn, execFile, exec, execSync, spawnSync, execFileSync, fork };
