import { world, system, Player, EntityComponentTypes } from "@minecraft/server";
import {failure, success} from "../utils/commands";

const LINK = "rsp:wireless_input";
const DIMENSION = "rsp:wireless_dimension";
const STORAGE = "rsp:input_block_cooldowns";
const validBlock = block => !!block && (block.typeId === "minecraft:lever" || block.typeId.endsWith("_button"));
const isLocation = value => value && ["x", "y", "z"].every(k => Number.isFinite(value[k]));
const blockKey = (dimension, location) => `${dimension}|${location.x},${location.y},${location.z}`;
const keyFor = block => blockKey(block.dimension.id, block.location);
const getHeld = player => {
    const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
    const slot = player.selectedSlotIndex;
    return { container, slot, item: container?.getItem(slot) };
};
const stateName = block => block.typeId === "minecraft:lever" ? "open_bit" : "button_pressed_bit";
const powered = block => block.permutation.getState(stateName(block)) === true;
const nextEdge = block => block.typeId === "minecraft:lever" && powered(block) ? "falling" : "rising";

let records = {};
function loadRecords() {
    try {
        const stored = world.getDynamicProperty(STORAGE);
        const parsed = typeof stored === "string" ? JSON.parse(stored) : {};
        records = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.warn(`[Input] Failed to load cooldowns: ${error}`);
        records = {};
    }
}
function saveRecords() {
    world.setDynamicProperty(STORAGE, Object.keys(records).length ? JSON.stringify(records) : undefined);
}
function getRecord(block) { return records[keyFor(block)]; }
function remaining(block, edge) {
    const record = getRecord(block);
    if (!record) return 0;
    const duration = record[edge] ?? 0;
    const until = record[`until_${edge}`] ?? 0;
    return duration > 0 ? Math.max(0, until - system.currentTick) : 0;
}
function feedback(player, ticks) {
    const seconds = (ticks / 20).toFixed(2);
    player.sendMessage(`§cInput on cooldown! §7Remaining: §e${ticks} ticks §7(${seconds}s)`);
}
function startCooldown(block, edge) {
    const record = getRecord(block);
    if (!record || !record[edge]) return;
    record[`until_${edge}`] = system.currentTick + record[edge];
    saveRecords();
}
function deleteRecord(key) {
    if (records[key]) { delete records[key]; saveRecords(); }
}
function clearItemLink(item) {
    item.setDynamicProperty(LINK, undefined);
    item.setDynamicProperty(DIMENSION, undefined);
    // Remove old item-based cooldown properties from previous versions.
    for (const name of ["rsp:input_cooldown_rising", "rsp:input_cooldown_falling", "rsp:input_last_rising", "rsp:input_last_falling"])
        item.setDynamicProperty(name, undefined);
}
function updateBlock(block, value) {
    const name = stateName(block);
    block.setPermutation(block.permutation.withState(name, value));
}
function activate(block) {
    if (!validBlock(block)) return false;
    const button = block.typeId.endsWith("_button");
    if (button && powered(block)) return false;
    const newState = button ? true : !powered(block);
    updateBlock(block, newState);
    if (button) {
        const id = block.typeId;
        const dimension = block.dimension;
        const position = { ...block.location };
        const duration = id === "minecraft:stone_button" || id === "minecraft:polished_blackstone_button" ? 20 : 30;
        system.runTimeout(() => {
            try {
                const current = dimension.getBlock(position);
                if (current?.typeId === id && powered(current)) updateBlock(current, false);
            } catch (error) { console.warn(`[Input] Button release: ${error}`); }
        }, duration);
    }
    return true;
}

export function handleInputCommand(origin, mode, edge, ticks) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) return failure("Only players can use this command.");
    const target = player.getBlockFromViewDirection({ maxDistance: 10 })?.block;
    if (mode === "wireless") {
        if (!validBlock(target)) return failure("Look at a lever or button within 10 blocks.");
        const location = { ...target.location };
        const dimension = target.dimension.id;
        system.run(() => {
            const { container, slot, item } = getHeld(player);
            if (!container || !item) return player.sendMessage("Hold an item to link it.");
            clearItemLink(item);
            item.setDynamicProperty(LINK, location);
            item.setDynamicProperty(DIMENSION, dimension);
            container.setItem(slot, item);
            player.sendMessage({ translate: "rsp.handleInputsSuccess" });
        });
        return success();
    }
    if (mode === "cooldown") {
        if (edge !== "rising" && edge !== "falling") return reply(player, "rsp.unknownInputMode", [], false);
        if (!Number.isSafeInteger(ticks) || ticks < 0) return reply(player, "rsp.noNegativeCooldown", [], false);
        if (!validBlock(target)) return failure("Look at a lever or button within 10 blocks.");
        const key = keyFor(target);
        const type = target.typeId;
        system.run(() => {
            // Confirm the block still exists before writing its record.
            const current = world.getDimension(target.dimension.id).getBlock(target.location);
            if (!current || current.typeId !== type) return player.sendMessage({ translate: "rsp.inputRemoved" });
            const record = records[key] ?? { type };
            record[edge] = ticks;
            record[`until_${edge}`] = 0;
            if (!record.rising && !record.falling) delete records[key];
            else records[key] = record;
            saveRecords();
            player.sendMessage({
                translate: "rsp.input.cooldown.set",
                with: [
                    { translate: `rsp.input.edge.${edge}` },
                    ticks
                        ? { translate: "rsp.input.cooldown.enabled", with: [String(ticks)] }
                        : { translate: "rsp.input.cooldown.disabled" }
                ]
            });
        });
        return success();
    }
    return player.sendMessage({ translate: "rsp.unknownInputMode" });
}

const pendingManual = new Map();

// Cancel manual lever/button interaction before Minecraft changes the state.
world.beforeEvents.playerInteractWithBlock.subscribe(event => {
    if (event.isFirstEvent === false || !validBlock(event.block)) return;
    const left = remaining(event.block, nextEdge(event.block));
    if (left <= 0) {
        pendingManual.set(event.player.id, { key: keyFor(event.block), state: powered(event.block) });
        return;
    }
    pendingManual.delete(event.player.id);
    event.cancel = true;
    system.run(() => feedback(event.player, left));
});

// Record a successful manual activation after the vanilla block state changes.
world.afterEvents.playerInteractWithBlock.subscribe(event => {
    if (event.isFirstEvent === false || !validBlock(event.block)) return;
    const key = keyFor(event.block);
    const previous = pendingManual.get(event.player.id);
    pendingManual.delete(event.player.id);
    if (!records[key] || previous?.key !== key) return;
    const dimension = event.block.dimension;
    const location = { ...event.block.location };
    const oldState = previous.state;
    system.run(() => {
        const block = dimension.getBlock(location);
        if (!validBlock(block) || !records[key]) return;
        const newState = powered(block);
        if (oldState === newState) return;
        const edge = newState ? "rising" : "falling";
        startCooldown(block, edge);
    });
});

world.beforeEvents.itemUse.subscribe(event => {
    const location = event.itemStack?.getDynamicProperty(LINK);
    const dimensionId = event.itemStack?.getDynamicProperty(DIMENSION);
    if (!isLocation(location) || typeof dimensionId !== "string") return;
    if (!(event.source instanceof Player)) return;
    const player = event.source;
    const targetLocation = { ...location };
    system.run(() => {
        try {
            const { container, slot, item } = getHeld(player);
            if (!container || !item || item.getDynamicProperty(DIMENSION) !== dimensionId ||
                JSON.stringify(item.getDynamicProperty(LINK)) !== JSON.stringify(targetLocation)) return;
            const block = world.getDimension(dimensionId).getBlock(targetLocation);
            if (!validBlock(block)) {
                deleteRecord(blockKey(dimensionId, targetLocation));
                clearItemLink(item);
                container.setItem(slot, item);
                player.sendMessage("§cWireless input no longer exists. Item link cleared.");
                return;
            }
            const edge = nextEdge(block);
            const left = remaining(block, edge);
            if (left > 0) return feedback(player, left);
            if (activate(block)) startCooldown(block, edge);
        } catch (error) { console.warn(`[Input] Wireless activation failed: ${error?.stack ?? error}`); }
    });
});

// Remove cooldown records when players destroy a linked input block.
world.afterEvents.playerBreakBlock.subscribe(event => {
    const key = blockKey(event.dimension.id, event.block.location);
    deleteRecord(key);
});

// Also clean up records for inputs removed by commands, explosions, etc.
// This is a periodic sweep rather than an immediate removal event.
system.run(() => {
    loadRecords();
    system.runInterval(() => {
        let dirty = false;
        for (const [key, record] of Object.entries(records)) {
            const separator = key.indexOf("|");
            if (separator < 0) { delete records[key]; dirty = true; continue; }
            const dimensionId = key.slice(0, separator);
            const coordinates = key.slice(separator + 1).split(",").map(Number);
            if (coordinates.length !== 3 || coordinates.some(n => !Number.isFinite(n))) {
                delete records[key]; dirty = true; continue;
            }
            try {
                const block = world.getDimension(dimensionId).getBlock({ x: coordinates[0], y: coordinates[1], z: coordinates[2] });
                if (block && (!validBlock(block) || block.typeId !== record.type)) {
                    delete records[key]; dirty = true;
                }
            } catch { /* Unloaded chunks cannot be checked yet. */ }
        }
        if (dirty) saveRecords();
    }, 1200);
});