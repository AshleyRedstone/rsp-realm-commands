import { world } from "@minecraft/server";

const STORAGE_KEY = "rsp:destinations";
const defaultDestinations = {
    spawn: {
        x: 0,
        y: 64,
        z: 0,
        rx: 0,
        ry: 0,
    },
};
export function normaliseName(name) {
    return name.trim().toLowerCase();
}
export function loadDestinations() {
    const stored = world.getDynamicProperty(STORAGE_KEY);
    if (typeof stored !== "string") {
        return { ...defaultDestinations };
    }
    try {
        return JSON.parse(stored);
    }
    catch {
        return { ...defaultDestinations };
    }
}
export function saveDestinations(destinations) {
    world.setDynamicProperty(STORAGE_KEY, JSON.stringify(destinations));
}
