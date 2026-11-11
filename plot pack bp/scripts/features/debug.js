import { system, world } from "@minecraft/server";
import { sendTranslationNow, success } from "../utils/commands.js";

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
        sendTranslationNow(player, "rsp.debug.header");
        sendTranslationNow(player, "rsp.debug.property_count", [String(propertyIds.length)]);
        sendTranslationNow(player, "rsp.debug.total_storage", [
            formatBytes(totalBytes),
            String(totalBytes),
        ]);
        if (propertyIds.length === 0) {
            sendTranslationNow(player, "rsp.debug.empty");
        }
        else {
            sendTranslationNow(player, "rsp.debug.properties_header");
            for (const id of propertyIds) {
                const value = world.getDynamicProperty(id);
                sendTranslationNow(player, "rsp.debug.property", [
                    id,
                    formatDynamicPropertyValue(value),
                ]);
            }
        }
        const playerPropertyIds = player
            .getDynamicPropertyIds()
            .sort();
        const playerBytes = player.getDynamicPropertyTotalByteCount();
        sendTranslationNow(player, "rsp.debug.player_header");
        sendTranslationNow(player, "rsp.debug.player_property_count", [String(playerPropertyIds.length)]);
        sendTranslationNow(player, "rsp.debug.player_total_storage", [
            formatBytes(playerBytes),
            String(playerBytes),
        ]);
        if (playerPropertyIds.length === 0) {
            sendTranslationNow(player, "rsp.debug.player_empty");
        }
        else {
            for (const id of playerPropertyIds) {
                const value = player.getDynamicProperty(id);
                sendTranslationNow(player, "rsp.debug.player_property", [
                    id,
                    formatDynamicPropertyValue(value),
                ]);
            }
        }
    });
    return success();
}
