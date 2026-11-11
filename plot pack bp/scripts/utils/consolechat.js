import { world } from "@minecraft/server"

world.beforeEvents.chatSend.subscribe(event => {
    const player = event.sender;
    const message = event.message;
    console.log(`[CHAT] (${player}): ${message}`);
});