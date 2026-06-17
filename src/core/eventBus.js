// 플러그인 간 이벤트 통신용 전역 이벤트 버스 (pub/sub).
// 이벤트 이름 컨벤션: "<pluginId>:<event>" 예) "timer:finished"
import { log } from "./logger";

const handlers = new Map();

export const eventBus = {
  /** 구독. 반환값을 호출하면 구독 해제된다. */
  on(event, handler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(handler);
    return () => {
      handlers.get(event)?.delete(handler);
    };
  },

  /** 발행. 구독자 하나가 던진 에러가 다른 구독자를 막지 않는다. */
  emit(event, payload) {
    log.debug(`[bus] ${event}`, payload);
    handlers.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        log.error(`[eventBus] handler error on "${event}"`, err);
        console.error(`[eventBus] handler error on "${event}"`, err);
      }
    });
  },
};
