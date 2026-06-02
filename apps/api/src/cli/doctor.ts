/* Environment doctor: verifies engines + config so operators can debug setup. */
import { config } from '../config.js';
import { detectTools } from '../converters/tools.js';

function line(label: string, value: string) {
  console.log(`  ${label.padEnd(22)} ${value}`);
}

async function main() {
  console.log('\nFBX <-> GLB Converter — environment check\n');

  console.log('Config');
  line('Port', String(config.port));
  line('Storage dir', config.storageDir);
  line('Max file size', `${config.maxFileSizeMb} MB`);
  line('Retention', `${config.retentionHours} h`);
  line('Max concurrent jobs', String(config.maxConcurrentJobs));
  line('ClamAV enabled', String(config.clamavEnabled));

  console.log('\nEngines');
  const tools = await detectTools(true);
  line('FBX2glTF', tools.fbx2gltf.available ? `OK  ${tools.fbx2gltf.path}` : 'MISSING');
  if (tools.fbx2gltf.version) line('  version', tools.fbx2gltf.version);
  line('Blender', tools.blender.available ? `OK  ${tools.blender.path}` : 'MISSING');
  if (tools.blender.version) line('  version', tools.blender.version);

  console.log('\nDirections available');
  line('FBX -> GLB', tools.fbx2gltf.available ? 'yes' : 'no (install FBX2glTF)');
  line('GLB -> FBX', tools.blender.available ? 'yes' : 'no (install Blender)');

  const ready = tools.fbx2gltf.available || tools.blender.available;
  console.log(`\n${ready ? '✓ At least one conversion direction is ready.' : '✗ No engines found — see SETUP.md.'}\n`);
  process.exit(ready ? 0 : 1);
}

main();
