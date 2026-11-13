import { system, world } from "@minecraft/server";
import { success } from "../utils/commands.js";

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KiB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
function formatDynamicPropertyValue(value) {
    if (value === undefined) {
        return "undefined";
    }
    if (typeof value === "string") {
        const preview = value.length > 100
            ? `${value.slice(0, 100)}…`
            : value;
        return `"${preview}"`;
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}
export function dumpDynamicPropertyUsage(player) {
    const propertyIds = world
        .getDynamicPropertyIds()
        .sort();
    const totalBytes = world.getDynamicPropertyTotalByteCount();
    system.run(() => {
        player.sendMessage({ translate: "rsp.debug.header", with: [] });
        player.sendMessage({ translate: "rsp.debug.property_count", with: [String(propertyIds.length)] });
        player.sendMessage({ translate: "rsp.debug.total_storage", with: [
            formatBytes(totalBytes),
            String(totalBytes),
        ] });
        if (propertyIds.length === 0) {
            player.sendMessage({ translate: "rsp.debug.empty", with: [] });
        }
        else {
            player.sendMessage({ translate: "rsp.debug.properties_header", with: [] });
            for (const id of propertyIds) {
                const value = world.getDynamicProperty(id);
                player.sendMessage({ translate: "rsp.debug.property", with: [
                    id,
                    formatDynamicPropertyValue(value),
                ] });
            }
        }
        const playerPropertyIds = player
            .getDynamicPropertyIds()
            .sort();
        const playerBytes = player.getDynamicPropertyTotalByteCount();
        player.sendMessage({ translate: "rsp.debug.player_header", with: [] });
        player.sendMessage({ translate: "rsp.debug.player_property_count", with: [String(playerPropertyIds.length)] });
        player.sendMessage({ translate: "rsp.debug.player_total_storage", with: [
            formatBytes(playerBytes),
            String(playerBytes),
        ] });
        if (playerPropertyIds.length === 0) {
            player.sendMessage({ translate: "rsp.debug.player_empty", with: [] });
        }
        else {
            for (const id of playerPropertyIds) {
                const value = player.getDynamicProperty(id);
                player.sendMessage({ translate: "rsp.debug.player_property", with: [
                    id,
                    formatDynamicPropertyValue(value),
                ] });
            }
        }
    });
    return success();
}
