import { world, system, Player, EntityComponentTypes } from "@minecraft/server";
import { success, failure } from "../utils/commands";

const LINK = "rsp:wireless_input";
const DIMENSION = "rsp:wireless_dimension";
const RISING = "rsp:input_cooldown_rising";
const FALLING = "rsp:input_cooldown_falling";
const LAST_RISING = "rsp:input_last_rising";
const LAST_FALLING = "rsp:input_last_falling";
const COOLDOWN_KEYS = [RISING, FALLING, LAST_RISING, LAST_FALLING];
const validBlock = block => block && (block.typeId === "minecraft:lever" || block.typeId.endsWith("_button"));
const validLocation = value => value && typeof value === "object" &&
    ["x", "y", "z"].every(key => typeof value[key] === "number");

function getHeldItem(player) {
    const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
    const slot = player.selectedSlotIndex;
    return { container, slot, item: container?.getItem(slot) };
}

function sameLocation(a, b) {
    return validLocation(a) && validLocation(b) &&
        a.x === b.x && a.y === b.y && a.z === b.z;
}

function clearCooldowns(item) {
    for (const key of COOLDOWN_KEYS) item.setDynamicProperty(key, undefined);
}

function clearWirelessInputData(item) {
    item.setDynamicProperty(LINK, undefined);
    item.setDynamicProperty(DIMENSION, undefined);
    clearCooldowns(item);
}

export function handleInputCommand(origin, mode, edge, ticks) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) return failure("Only players can use this command.");

    if (mode === "wireless") {
        const block = player.getBlockFromViewDirection({ maxDistance: 10 })?.block;
        if (!validBlock(block)) return failure("Look at a lever or button within 10 blocks.");
        const location = { ...block.location };
        const dimensionId = block.dimension.id;
        system.run(() => {
            const { container, slot, item } = getHeldItem(player);
            if (!item || !container) {
                player.sendMessage("Hold an item to link it.");
                return;
            }
            // A new link is a new input: discard cooldowns from the previous link.
            clearCooldowns(item);
            item.setDynamicProperty(LINK, location);
            item.setDynamicProperty(DIMENSION, dimensionId);
            container.setItem(slot, item);
            player.sendMessage({ translate: "rsp.handleInputsSuccess" });
        });
        return success();
    }

    if (mode === "cooldown") {
        if (edge === undefined || ticks === undefined)
            return failure("Usage: /input cooldown <rising|falling> <ticks>");
        if (!Number.isSafeInteger(ticks) || ticks < 0)
            return failure("Cooldown must be a non-negative whole number of ticks.");
        system.run(() => {
            const { container, slot, item } = getHeldItem(player);
            if (!item || !container || !validLocation(item.getDynamicProperty(LINK)) ||
                typeof item.getDynamicProperty(DIMENSION) !== "string") {
                player.sendMessage({ translate: "rsp.noInputFailure" });
                return;
            }
            const property = edge === "rising" ? RISING : FALLING;
            item.setDynamicProperty(property, ticks === 0 ? undefined : ticks);
            // Changing a cooldown starts a fresh cooldown window.
            item.setDynamicProperty(edge === "rising" ? LAST_RISING : LAST_FALLING, undefined);
            container.setItem(slot, item);
            player.sendMessage(`${edge} cooldown ${ticks === 0 ? "disabled" : `set to ${ticks} ticks`}.`);
        });
        return success();
    }
    return failure("Unknown input mode.");
}

world.beforeEvents.itemUse.subscribe(event => {
    const location = event.itemStack.getDynamicProperty(LINK);
    const dimensionId = event.itemStack.getDynamicProperty(DIMENSION);
    if (!validLocation(location) || typeof dimensionId !== "string") return;
    const player = event.source;
    if (!(player instanceof Player)) return;
    const usedLocation = { ...location };
    system.run(() => {
        try {
            const { container, slot, item } = getHeldItem(player);
            if (!container || !item ||
                !sameLocation(item.getDynamicProperty(LINK), usedLocation) ||
                item.getDynamicProperty(DIMENSION) !== dimensionId) return;
            // If the linked block has been removed or replaced, unlink the item
            // and discard its cooldowns as well.
            let block;
            try {
                block = world.getDimension(dimensionId).getBlock(usedLocation);
            } catch (error) {
                console.warn(`[Wireless Input] Cannot resolve linked block: ${String(error)}`);
            }
            if (!validBlock(block)) {
                clearWirelessInputData(item);
                container.setItem(slot, item);
                player.sendMessage({ translate: "rsp.inputRemoved" });
                return;
            }
            const stateName = block.typeId === "minecraft:lever" ? "open_bit" : "button_pressed_bit";
            const powered = block.permutation.getState(stateName);
            if (typeof powered !== "boolean") return;
            if (block.typeId.endsWith("_button") && powered) return;
            const edge = powered ? "falling" : "rising";
            const cooldownKey = edge === "rising" ? RISING : FALLING;
            const lastKey = edge === "rising" ? LAST_RISING : LAST_FALLING;
            const cooldown = item.getDynamicProperty(cooldownKey);
            const last = item.getDynamicProperty(lastKey);
            const now = system.currentTick;
            if (typeof cooldown === "number" && cooldown > 0 &&
                typeof last === "number" && now >= last && now - last < cooldown) return;
            if (!activateWirelessInput(block)) return;
            if (typeof cooldown === "number" && cooldown > 0) {
                item.setDynamicProperty(lastKey, now);
                container.setItem(slot, item);
            }
        } catch (error) {
            console.warn(`[Wireless Input] ${error?.stack ?? String(error)}`);
        }
    });
});

function activateWirelessInput(block) {
    if (!validBlock(block)) return false;
    const typeId = block.typeId;
    const stateName = typeId === "minecraft:lever" ? "open_bit" : "button_pressed_bit";
    const states = block.permutation.getAllStates();
    if (typeof states[stateName] !== "boolean") return false;
    if (typeId.endsWith("_button") && states[stateName]) return false;
    const { x, y, z } = block.location;
    const dimension = block.dimension;

    function setState(powered) {
        const updatedStates = { ...states, [stateName]: powered };
        const stateString = Object.entries(updatedStates)
            .map(([key, value]) => `"${key}"=${JSON.stringify(value)}`).join(",");
        dimension.runCommand(`setblock ${x} ${y} ${z} ${typeId} [${stateString}] destroy`);
        system.runTimeout(() => {
            dimension.runCommand(`kill @e[type=item,x=${x},y=${y},z=${z},r=2]`);
        }, 1);
    }

    if (typeId.endsWith("_button")) {
        setState(true);
        const duration = typeId === "minecraft:stone_button" ||
        typeId === "minecraft:polished_blackstone_button" ? 20 : 30;
        system.runTimeout(() => {
            const current = dimension.getBlock({ x, y, z });
            if (current?.typeId === typeId && current.permutation.getState(stateName) === true)
                setState(false);
        }, duration);
    } else {
        setState(!states[stateName]);
    }
    return true;
}
