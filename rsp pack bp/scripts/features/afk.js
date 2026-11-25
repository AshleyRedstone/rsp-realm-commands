import {system, world} from "@minecraft/server";

const afkTimer = 20 * 60 * 5;
const lastRotations = new Map();

world.afterEvents.playerButtonInput.subscribe(event => {
    const player = event.player;
    resetAfkTimer(player);
});

world.afterEvents.playerLeave.subscribe(event => {
    lastRotations.delete(event.playerId);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (hasCameraMoved(player)) {
            resetAfkTimer(player);
            continue;
        }
        const currentTimer = player.getDynamicProperty("rsp:afkTimer") ?? 0;
        if (currentTimer < afkTimer) {
            player.setDynamicProperty("rsp:afkTimer", currentTimer+1);
        } else if (currentTimer === afkTimer) {
            if (player.hasTag("afk")) { continue; }
            player.sendMessage("You are now afk!");
            player.addTag("afk");
        }
    }
}, 1);

function hasCameraMoved(player) {
    const current = player.getRotation();
    const previous = lastRotations.get(player.id);

    lastRotations.set(player.id, current);

    if (!previous) return false;

    return current.x !== previous.x ||
        current.y !== previous.y;
}

function resetAfkTimer(player) {
    player.setDynamicProperty("rsp:afkTimer", 0);
    if (player.hasTag("afk")) {
        player.sendMessage("You are no longer afk!");
        player.removeTag("afk");
    }
}