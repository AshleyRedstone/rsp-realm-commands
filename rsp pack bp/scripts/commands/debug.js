import { Player, system, world } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { success, failure } from "../utils/helper_functions.js";

const dimensions = ["overworld", "nether", "the_end"];
const valid = player => player?.isValid;
const later = callback => system.run(() => { try { callback(); } catch (error) { console.warn(`[Debug] ${error}`); } });
const show = (form, player, callback) => {
    form.show(player).then(result => {
        if (valid(player) && !result.canceled) later(() => callback(result));
    }).catch(error => console.warn(`[Debug] Form failed: ${error}`));
};
const bytes = n => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KiB`;
const label = value => {
    if (typeof value === "string") return `String (${value.length} characters)`;
    if (typeof value === "number") return "Number";
    if (typeof value === "boolean") return "Boolean";
    if (value && typeof value === "object") return "Vector3";
    return typeof value;
};
const display = value => {
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch { return String(value); }
};

export function handleDebugCommand(origin) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) return failure();
    later(() => openDebug(player));
    return success();
}

function openDebug(player) {
    const form = new ActionFormData().title("Dynamic Property Debugger")
        .body("Inspect or delete stored dynamic properties.")
        .button("World properties")
        .button("Player properties (online)")
        .button("Dimension properties");
    show(form, player, ({ selection }) => {
        if (selection === 0) openProperties(player, world, "World", () => openDebug(player));
        if (selection === 1) openPlayers(player);
        if (selection === 2) openDimensions(player);
    });
}

function openPlayers(player) {
    const players = world.getAllPlayers().sort((a, b) => a.name.localeCompare(b.name));
    const form = new ActionFormData().title("Player properties")
        .body("Online players only. Offline player properties cannot be read directly.");
    for (const target of players) form.button(target.name);
    form.button("Back");
    show(form, player, ({ selection }) => {
        if (selection === players.length) return openDebug(player);
        const target = players[selection];
        if (!target || !valid(target)) return openPlayers(player);
        openProperties(player, target, `Player: ${target.name}`, () => openPlayers(player));
    });
}

function openDimensions(player) {
    const form = new ActionFormData().title("Dimension properties");
    for (const id of dimensions) form.button(id);
    form.button("Back");
    show(form, player, ({ selection }) => {
        if (selection === dimensions.length) return openDebug(player);
        const id = dimensions[selection];
        if (id) openProperties(player, world.getDimension(id), `Dimension: ${id}`, () => openDimensions(player));
    });
}

function openProperties(player, owner, title, back) {
    let ids, total;
    try {
        ids = owner.getDynamicPropertyIds().sort();
        total = owner.getDynamicPropertyTotalByteCount();
    } catch (error) {
        player.sendMessage(`§cUnable to inspect ${title}: ${error}`);
        return back();
    }
    const form = new ActionFormData().title(title)
        .body(`${ids.length} properties • ${bytes(total)} total storage`);
    for (const id of ids) {
        const value = owner.getDynamicProperty(id);
        form.button(`${id}\n${label(value)}`);
    }
    form.button("Back");
    show(form, player, ({ selection }) => {
        if (selection === ids.length) return back();
        const id = ids[selection];
        if (id !== undefined) openProperty(player, owner, title, id, () => openProperties(player, owner, title, back));
    });
}

function openProperty(player, owner, title, id, back) {
    let value;
    try { value = owner.getDynamicProperty(id); }
    catch (error) { player.sendMessage(`§c${error}`); return back(); }
    if (value === undefined) return back();
    const raw = display(value);
    const form = new ActionFormData().title(id)
        .body(`Owner: ${title}\nType: ${label(value)}\n\nValue:\n${raw.slice(0, 3000)}${raw.length > 3000 ? '\n… (truncated)' : ''}`)
        .button("Delete property")
        .button("Back");
    show(form, player, ({ selection }) => {
        if (selection === 0) confirmDelete(player, owner, title, id, back);
        else back();
    });
}

function confirmDelete(player, owner, title, id, back) {
    const form = new MessageFormData().title("Confirm deletion")
        .body(`Permanently delete '${id}' from ${title}?\nThis cannot be undone.`)
        .button1("Cancel")
        .button2("Delete");
    show(form, player, ({ selection }) => {
        if (selection === 1) {
            try {
                owner.setDynamicProperty(id, undefined);
                player.sendMessage(`§aDeleted ${id} from ${title}.`);
            } catch (error) {
                player.sendMessage(`§cCould not delete ${id}: ${error}`);
            }
        }
        back();
    });
}
