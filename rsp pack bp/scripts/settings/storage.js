// Per-player dynamic-property storage, plus tag-backed boolean toggles.
export function normaliseString(value, options = {}) {
    let result = String(value ?? "").trim();
    if (options.normalise === "lowercase") result = result.toLowerCase();
    return result;
}

export function readSetting(player, setting) {
    if (setting.storage === "tag") {
        return player.hasTag(setting.tag);
    }
    const stored = player.getDynamicProperty(setting.property);
    switch (setting.type) {
        case "toggle": return typeof stored === "boolean" ? stored : (setting.default ?? false);
        case "slider": return typeof stored === "number" && Number.isFinite(stored) ? stored : (setting.default ?? setting.min ?? 0);
        case "dropdown": return typeof stored === "string" && setting.options.some(o => o.value === stored) ? stored : (setting.default ?? setting.options[0]?.value);
        case "text": return typeof stored === "string" ? stored : (setting.default ?? "");
        case "stringList": {
            if (typeof stored !== "string") return [];
            try {
                const value = JSON.parse(stored);
                if (!Array.isArray(value)) return [];
                return [...new Set(value.filter(v => typeof v === "string")
                    .map(v => normaliseString(v, setting.options))
                    .filter(v => v || setting.options?.allowEmpty))];
            } catch { return []; }
        }
        default: throw new Error(`Unknown setting type: ${setting.type}`);
    }
}

export function writeSetting(player, setting, value) {
    switch (setting.type) {
        case "toggle":
            if (typeof value !== "boolean") throw new TypeError("Expected boolean");
            break;
        case "slider":
            if (typeof value !== "number" || !Number.isFinite(value) || value < setting.min || value > setting.max)
                throw new RangeError("Slider value outside permitted range");
            break;
        case "dropdown":
            if (!setting.options.some(o => o.value === value)) throw new RangeError("Invalid dropdown option");
            break;
        case "text":
            value = normaliseString(value, setting);
            if (!setting.allowEmpty && !value) throw new Error("Value cannot be empty");
            if (setting.maxLength && value.length > setting.maxLength) throw new RangeError("Text too long");
            break;
        case "stringList":
            if (!Array.isArray(value)) throw new TypeError("Expected list");
            value = [...new Set(value.map(v => normaliseString(v, setting.options))
                .filter(v => v || setting.options?.allowEmpty))];
            break;
        default: throw new Error(`Unknown setting type: ${setting.type}`);
    }
    if (setting.storage === "tag") {
        if (value) {
            player.addTag(setting.tag);
        } else {
            player.removeTag(setting.tag);
        }
    } else {
        player.setDynamicProperty(setting.property,
            setting.type === "stringList" ? (value.length ? JSON.stringify(value) : undefined) : value);
    }
    if (typeof setting.onChange === "function") setting.onChange(player, value);
    return value;
}
