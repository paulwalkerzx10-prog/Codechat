// Patch to prevent polyfills like formdata-polyfill from attempting to write to window.fetch.
// Since window.fetch is a non-configurable, read-only getter in our sandboxed iframe environment, 
// any assignment like global.fetch = ... will crash the page.
// We intercept this by ensuring that native/global FormData matches the checker's expectations
// so that the polyfill detects it as complete and completely skips execution.

try {
  const targets: any[] = [];
  if (typeof window !== 'undefined') targets.push(window);
  if (typeof globalThis !== 'undefined') targets.push(globalThis);
  if (typeof self !== 'undefined') targets.push(self);

  for (const target of targets) {
    if (!target) continue;

    // formdata-polyfill checks: typeof Blob !== 'undefined' && (typeof FormData === 'undefined' || !FormData.prototype.keys)
    // If FormData and FormData.prototype.keys exist, the entire polyfill execution is skipped.
    if (typeof target.FormData === 'undefined') {
      target.FormData = class FakeFormData {};
    }
    
    if (target.FormData && !target.FormData.prototype) {
      target.FormData.prototype = {};
    }
    
    if (target.FormData && target.FormData.prototype && !target.FormData.prototype.keys) {
      target.FormData.prototype.keys = function() {
        return {
          next: () => ({ done: true, value: undefined }),
          [Symbol.iterator]() { return this; }
        };
      };
    }

    if (target.FormData && target.FormData.prototype && !target.FormData.prototype.values) {
      target.FormData.prototype.values = function() {
        return {
          next: () => ({ done: true, value: undefined }),
          [Symbol.iterator]() { return this; }
        };
      };
    }

    if (target.FormData && target.FormData.prototype && !target.FormData.prototype.entries) {
      target.FormData.prototype.entries = function() {
        return {
          next: () => ({ done: true, value: undefined }),
          [Symbol.iterator]() { return this; }
        };
      };
    }
    
    if (target.FormData && target.FormData.prototype && !target.FormData.prototype[Symbol.iterator]) {
      target.FormData.prototype[Symbol.iterator] = function() {
        return this.entries();
      };
    }
  }
} catch (e) {
  console.error("Failed to patch fetch/formdata check:", e);
}

export {};
