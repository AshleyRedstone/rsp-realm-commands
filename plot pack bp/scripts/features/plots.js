import { Player } from "@minecraft/server";
import { failure, translatedFailure, translatedSuccess, translatedOriginFailure } from "../utils/commands.js";
import { normaliseName, loadDestinations, saveDestinations } from "../utils/destinations.js";
import { saveCurrentLocationAsBack } from "./back.js";
import { dumpDynamicPropertyUsage } from "./debug.js";

const HOME_PROPERTY = "rsp:home";
export function handlePlotCommand(origin, mode, argument, destinationName, x, y, z) {
    switch (mode.toLowerCase()) {
        case "visit":
            return visitDestination(origin, argument);
        case "home":
            return handleHomeCommand(origin, argument, destinationName);
        case "list":
            return listDestinations(origin);
        case "admin":
            return handleAdminCommand(origin, argument, destinationName, x, y, z);
        default:
            return translatedOriginFailure(origin, "rsp.command.unknown", [mode]);
    }
}
export function handleShortPlotCommand(origin, mode, argument, destinationName, x, y, z) {
    switch (mode.toLowerCase()) {
        case "v":
            return visitDestination(origin, argument);
        case "h":
            return handleHomeCommand(origin, argument, destinationName);
        case "l":
            return listDestinations(origin);
        case "a":
            return handleAdminCommand(origin, argument, destinationName, x, y, z);
        default:
            return translatedOriginFailure(origin, "rsp.command.unknown_alias", [mode]);
    }
}
function visitDestination(origin, destinationName) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return failure("This command can only be used by a player.");
    }
    if (destinationName === undefined) {
        return translatedFailure(player, "rsp.visit.usage");
    }
    const key = normaliseName(destinationName);
    const destinations = loadDestinations();
    const destination = destinations[key];
    if (!destination) {
        return translatedFailure(player, "rsp.visit.unknown", [key]);
    }
    system.run(() => {
        saveCurrentLocationAsBack(player);
        player.teleport({
            x: destination.x,
            y: destination.y,
            z: destination.z,
        }, {
            rotation: {
                x: destination.rx ?? 0,
                y: destination.ry ?? 0,
            },
        });
        player.sendMessage({
            translate: "rsp.visit.success",
            with: [key],
        });
    });
    return {
        status: CustomCommandStatus.Success,
    };
}
function listDestinations(origin) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return failure("This command can only be used by a player.");
    }
    const destinations = loadDestinations();
    const names = Object.keys(destinations).sort();
    if (names.length === 0) {
        return translatedSuccess(player, "rsp.list.empty");
    }
    const list = names
        .map((name) => {
        const destination = destinations[name];
        return (`${name} ` +
            `(${destination.x}, ` +
            `${destination.y}, ` +
            `${destination.z}) ` +
            `[${destination.rx ?? 0}, ` +
            `${destination.ry ?? 0}]`);
    })
        .join(", ");
    return translatedSuccess(player, "rsp.list.header", [list]);
}
function handleHomeCommand(origin, action, destinationName) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return failure("This command can only be used by a player.");
    }
    if (action === undefined) {
        return teleportHome(player);
    }
    if (action.toLowerCase() === "set") {
        if (destinationName === undefined) {
            return translatedFailure(player, "rsp.home.usage");
        }
        return setHome(player, destinationName);
    }
    return translatedFailure(player, "rsp.home.unknown_action", [action]);
}
function setHome(player, destinationName) {
    const key = normaliseName(destinationName);
    const destinations = loadDestinations();
    if (!destinations[key]) {
        return translatedFailure(player, "rsp.visit.unknown", [key]);
    }
    system.run(() => {
        player.setDynamicProperty(HOME_PROPERTY, key);
        player.sendMessage({
            translate: "rsp.home.set",
            with: [key],
        });
    });
    return {
        status: CustomCommandStatus.Success,
    };
}
function teleportHome(player) {
    const storedHome = player.getDynamicProperty(HOME_PROPERTY);
    if (typeof storedHome !== "string") {
        return translatedFailure(player, "rsp.home.not_set");
    }
    const key = normaliseName(storedHome);
    const destinations = loadDestinations();
    const destination = destinations[key];
    if (!destination) {
        return translatedFailure(player, "rsp.home.deleted", [key]);
    }
    system.run(() => {
        saveCurrentLocationAsBack(player);
        player.teleport({
            x: destination.x,
            y: destination.y,
            z: destination.z,
        }, {
            rotation: {
                x: destination.rx ?? 0,
                y: destination.ry ?? 0,
            },
        });
        player.sendMessage({
            translate: "rsp.home.teleported",
            with: [key],
        });
    });
    return {
        status: CustomCommandStatus.Success,
    };
}

function handleAdminCommand(origin, action, destinationName, x, y, z) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return failure("This command can only be used by a player.");
    }
    if (!player.hasTag("plot_admin")) {
        return translatedFailure(player, "rsp.error.no_permission");
    }
    if (action === undefined) {
        return translatedFailure(player, "rsp.admin.usage");
    }
    const destinations = loadDestinations();
    switch (action.toLowerCase()) {
        case "set": {
            if (destinationName === undefined) {
                return translatedFailure(player, "rsp.admin.set_usage");
            }
            const location = player.location;
            const rotation = player.getRotation();
            const finalX = Math.round(x ?? location.x);
            const finalY = Math.round(y ?? location.y);
            const finalZ = Math.round(z ?? location.z);
            const finalRotationX = Math.round(rotation.x);
            const finalRotationY = Math.round(rotation.y);
            const key = normaliseName(destinationName);
            const alreadyExists = destinations[key] !== undefined;
            destinations[key] = {
                x: finalX,
                y: finalY,
                z: finalZ,
                rx: finalRotationX,
                ry: finalRotationY,
            };
            system.run(() => {
                saveDestinations(destinations);
            });
            return translatedSuccess(player, alreadyExists
                ? "rsp.admin.updated"
                : "rsp.admin.added", [
                key,
                String(finalX),
                String(finalY),
                String(finalZ),
            ]);
        }
        case "remove": {
            if (destinationName === undefined) {
                return translatedFailure(player, "rsp.admin.remove_usage");
            }
            const key = normaliseName(destinationName);
            if (!destinations[key]) {
                return translatedFailure(player, "rsp.admin.missing", [key]);
            }
            delete destinations[key];
            system.run(() => {
                saveDestinations(destinations);
            });
            return translatedSuccess(player, "rsp.admin.removed", [key]);
        }
        case "debug":
            return dumpDynamicPropertyUsage(player);
        default:
            return translatedFailure(player, "rsp.admin.unknown_action", [action]);
    }
}
