// 플러그인 자동 발견 레지스트리.
// src/plugins/<dir>/index.jsx + manifest.json 쌍을 빌드 타임에 수집한다.
// 새 플러그인은 폴더만 추가하면 등록 코드 없이 자동으로 인식된다.

const modules = import.meta.glob("../plugins/*/index.jsx", { eager: true });
const manifests = import.meta.glob("../plugins/*/manifest.json", { eager: true });

function dirOf(path) {
  // "../plugins/timer/index.jsx" → "timer"
  return path.split("/").at(-2);
}

const registry = {};

for (const [path, module] of Object.entries(modules)) {
  const dir = dirOf(path);
  const manifestModule = Object.entries(manifests).find(([p]) => dirOf(p) === dir);
  if (!manifestModule) {
    console.warn(`[PluginRegistry] manifest.json 누락: plugins/${dir}`);
    continue;
  }
  const manifest = manifestModule[1].default;
  const Component = module.default;
  Component.manifest = manifest;
  registry[manifest.id] = Component;
}

export function getPlugin(id) {
  return registry[id] ?? null;
}

export function getAllPlugins() {
  return Object.values(registry);
}
