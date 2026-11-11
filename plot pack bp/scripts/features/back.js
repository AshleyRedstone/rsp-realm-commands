import { system, world } from "@minecraft/server";
import { reply, failure, success, getCommandPlayer } from "../utils/commands.js";

const BACK_PROPERTY = "rsp:back";
const TELEPORT_DETECTION_DISTANCE = 8;
const TELEPORT_DETECTION_DISTANCE_SQUARED = TELEPORT_DETECTION_DISTANCE ** 2;
const playerSnapshots = new Map();
function createPlayerSnapshot(player) {
    const rotation = player.getRotation();
    return {
        x: player.location.x,
        y: player.location.y,
        z: player.location.z,
        rx: rotation.x,
        ry: rotation.y,
        dimension: player.dimension.id,
    };
}
function saveBackSnapshot(player, snapshot) {
    const backLocation = {
        x: Math.round(snapshot.x),
        y: Math.round(snapshot.y),
        z: Math.round(snapshot.z),
        rx: Math.round(snapshot.rx),
        ry: Math.round(snapshot.ry),
        dimension: snapshot.dimension,
    };
    player.setDynamicProperty(BACK_PROPERTY, JSON.stringify(backLocation));
}
export function saveCurrentLocationAsBack(player) {
    saveBackSnapshot(player, createPlayerSnapshot(player));
}
system.runInterval(() => {
    const activePlayerIds = new Set();
    for (const player of world.getAllPlayers()) {
        activePlayerIds.add(player.id);
        const current = createPlayerSnapshot(player);
        const previous = playerSnapshots.get(player.id);
        if (previous !== undefined) {
            const dimensionChanged = previous.dimension !== current.dimension;
            const dx = current.x - previous.x;
            const dy = current.y - previous.y;
            const dz = current.z - previous.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            if (dimensionChanged ||
                distanceSquared >=
                    TELEPORT_DETECTION_DISTANCE_SQUARED) {
                saveBackSnapshot(player, previous);
            }
        }
        playerSnapshots.set(player.id, current);
    }
    for (const playerId of playerSnapshots.keys()) {
        if (!activePlayerIds.has(playerId)) {
            playerSnapshots.delete(playerId);
        }
    }
}, 1);

export function handleBackCommand(origin) {
    const player = getCommandPlayer(origin);
    if (player === undefined) {
        return failure();
    }
    const storedBack = player.getDynamicProperty(BACK_PROPERTY);
    if (typeof storedBack !== "string") {
        return reply(player, "rsp.back.none", [], true);
    }
    let back;
    try {
        back = JSON.parse(storedBack);
    }
    catch {
        return reply(player, "rsp.back.invalid", [], true);
    }
    system.run(() => {
        try {
            player.teleport({
                x: back.x,
                y: back.y,
                z: back.z,
            }, {
                dimension: world.getDimension(back.dimension),
                rotation: {
                    x: back.rx,
                    y: back.ry,
                },
            });
            player.sendMessage({ translate: "rsp.back.success", with: [] });
        }
        catch (error) {
            player.sendMessage({ translate: "rsp.back.failure", with: [String(error)] });
        }
    });
    return success();
}
