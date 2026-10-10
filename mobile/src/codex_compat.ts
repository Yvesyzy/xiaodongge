// The Android shell can be newer than its WebView. Install only missing APIs,
// before React and application modules execute; keep native implementations intact.
if (typeof Array.prototype.at !== "function") {
  Object.defineProperty(Array.prototype, "at", { configurable: true, writable: true,
    value: function (this: ArrayLike<unknown>, index: number) {
      if (this == null) throw new TypeError("Array.at requires an array-like value");
      const length = Math.min(Math.max(Math.trunc(this.length) || 0, 0), Number.MAX_SAFE_INTEGER);
      const integer = Math.trunc(index) || 0;
      const position = integer < 0 ? length + integer : integer;
      return position >= 0 && position < length ? this[position] : undefined;
    },
  });
}
if (typeof Object.hasOwn !== "function") {
  Object.defineProperty(Object, "hasOwn", { configurable: true, writable: true,
    value: (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key),
  });
}
if (typeof String.prototype.replaceAll !== "function") {
  Object.defineProperty(String.prototype, "replaceAll", { configurable: true, writable: true,
    value: function (this: string, search: string | RegExp, replacement: string) {
      if (this == null) throw new TypeError("String.replaceAll requires a string");
      if (search != null) {
        const object = Object(search);
        const isRegex = object[Symbol.match] === undefined ? object instanceof RegExp : !!object[Symbol.match];
        if (isRegex && !String(object.flags).includes("g")) throw new TypeError("replaceAll requires a global RegExp");
        if (object[Symbol.replace] != null) return object[Symbol.replace](String(this), replacement);
      }
      const pattern = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return String(this).replace(new RegExp(pattern, "g"), replacement);
    },
  });
}
if (typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", { configurable: true, writable: true, value: () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    return Array.from(bytes, (byte, index) => ([4, 6, 8, 10].includes(index) ? "-" : "") + byte.toString(16).padStart(2, "0")).join("");
  } });
}
if (typeof CSS === "undefined" || !CSS.supports("selector(:has(*))")) {
  document.documentElement.classList.add("codex-basic-rendering");
}

export {};
