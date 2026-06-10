// localStorage 기반 저장소.
// - 대시보드 레이아웃: "lifedash.layout"
// - 플러그인 인스턴스별 데이터: "lifedash.plugin.<instanceId>"
//   플러그인은 자기 네임스페이스 밖의 데이터에 접근할 수 없다.

const LAYOUT_KEY = "lifedash.layout";
const PLUGIN_PREFIX = "lifedash.plugin.";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadLayout() {
  return read(LAYOUT_KEY, null);
}

export function saveLayout(instances) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(instances));
}

/** 플러그인 인스턴스에 주입되는 네임스페이스 저장소 */
export function createPluginStorage(instanceId) {
  const key = PLUGIN_PREFIX + instanceId;
  return {
    get(field, fallback = null) {
      const data = read(key, {});
      return field in data ? data[field] : fallback;
    },
    set(field, value) {
      const data = read(key, {});
      data[field] = value;
      localStorage.setItem(key, JSON.stringify(data));
    },
    remove(field) {
      const data = read(key, {});
      delete data[field];
      localStorage.setItem(key, JSON.stringify(data));
    },
  };
}

/** 인스턴스 제거 시 해당 플러그인 데이터도 함께 삭제 */
export function clearPluginStorage(instanceId) {
  localStorage.removeItem(PLUGIN_PREFIX + instanceId);
}
