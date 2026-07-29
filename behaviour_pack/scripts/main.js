import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, world, } from "@minecraft/server";
const STORAGE_KEY = "plots:destinations";
const defaultDestinations = {
    spawn: { x: 0, y: 64, z: 0 },
};
function normaliseName(name) {
    return name.trim().toLowerCase();
}
function loadDestinations() {
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
function saveDestinations(destinations) {
    world.setDynamicProperty(STORAGE_KEY, JSON.stringify(destinations));
}
function success(message) {
    return {
        status: CustomCommandStatus.Success,
        message,
    };
}
function failure(message) {
    return {
        status: CustomCommandStatus.Failure,
        message,
    };
}
system.beforeEvents.startup.subscribe((event) => {
    const registry = event.customCommandRegistry;
    registry.registerEnum("plots:plot_mode", ["visit", "home", "list", "admin"]);
    registry.registerEnum("plots:short_mode", ["v", "h", "l", "a"]);
    registry.registerEnum("plots:admin_action", ["set", "remove"]);
    const plotCommand = {
        name: "plots:plot",
        description: "Visit or manage plot destinations",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [
            {
                name: "plots:plot_mode",
                type: CustomCommandParamType.Enum,
            },
        ],
        optionalParameters: [
            {
                name: "argument",
                type: CustomCommandParamType.String,
            },
            {
                name: "destination",
                type: CustomCommandParamType.String,
            },
            {
                name: "x",
                type: CustomCommandParamType.Float,
            },
            {
                name: "y",
                type: CustomCommandParamType.Float,
            },
            {
                name: "z",
                type: CustomCommandParamType.Float,
            },
        ],
    };
    const shortPlotCommand = {
        name: "plots:p",
        description: "Short alias for /plot",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [
            {
                name: "plots:short_mode",
                type: CustomCommandParamType.Enum,
            },
        ],
        optionalParameters: [
            {
                name: "argument",
                type: CustomCommandParamType.String,
            },
            {
                name: "destination",
                type: CustomCommandParamType.String,
            },
            {
                name: "x",
                type: CustomCommandParamType.Float,
            },
            {
                name: "y",
                type: CustomCommandParamType.Float,
            },
            {
                name: "z",
                type: CustomCommandParamType.Float,
            },
        ],
    };
    registry.registerCommand(plotCommand, handlePlotCommand);
    registry.registerCommand(shortPlotCommand, handleShortPlotCommand);
});
function handlePlotCommand(origin, mode, argument, destinationName, x, y, z) {
    switch (mode.toLowerCase()) {
        case "visit":
            return visitDestination(origin, argument);
        case "home":
            return handleHomeCommand(origin, argument, destinationName);
        case "list":
            return listDestinations();
        case "admin":
            return handleAdminCommand(origin, argument, destinationName, x, y, z);
        default:
            return failure(`Unknown plot subcommand "${mode}".`);
    }
}
function handleShortPlotCommand(origin, mode, argument, destinationName, x, y, z) {
    switch (mode.toLowerCase()) {
        case "v":
            return visitDestination(origin, argument);
        case "h":
            return handleHomeCommand(origin, argument, destinationName);
        case "l":
            return listDestinations();
        case "a":
            return handleAdminCommand(origin, argument, destinationName, x, y, z);
        default:
            return failure(`Unknown plot alias "${mode}".`);
    }
}
function visitDestination(origin, destinationName) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return failure("This command can only be used by a player.");
    }
    if (destinationName === undefined) {
        return failure("Usage: /plot visit <destination>");
    }
    const key = normaliseName(destinationName);
    const destinations = loadDestinations();
    const destination = destinations[key];
    if (!destination) {
        return failure(`Unknown destination "${key}".`);
    }
    system.run(() => {
        player.teleport(destination);
        player.sendMessage(`§aTeleported to §f${key}§a.`);
    });
    return success();
}
function listDestinations() {
    const destinations = loadDestinations();
    const names = Object.keys(destinations).sort();
    if (names.length === 0) {
        return success("There are no plot destinations.");
    }
    const list = names
        .map((name) => {
        const location = destinations[name];
        return (`${name} ` +
            `(${location.x.toFixed(2)}, ` +
            `${location.y.toFixed(2)}, ` +
            `${location.z.toFixed(2)})`);
    })
        .join(", ");
    return success(`Destinations: ${list}`);
}
const HOME_PROPERTY = "plots:home";
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
            return failure("Usage: /plot home set <destination>");
        }
        return setHome(player, destinationName);
    }
    return failure(`Unknown home action "${action}". ` +
        "Usage: /plot home [set <destination>]");
}
function setHome(player, destinationName) {
    const key = normaliseName(destinationName);
    const destinations = loadDestinations();
    if (!destinations[key]) {
        return failure(`Unknown destination "${key}".`);
    }
    system.run(() => {
        player.setDynamicProperty(HOME_PROPERTY, key);
    });
    return success(`Your home has been set to "${key}".`);
}
function teleportHome(player) {
    const storedHome = player.getDynamicProperty(HOME_PROPERTY);
    if (typeof storedHome !== "string") {
        return failure("You have not selected a home. " +
            "Use /plot home set <destination>.");
    }
    const key = normaliseName(storedHome);
    const destinations = loadDestinations();
    const destination = destinations[key];
    if (!destination) {
        return failure(`Your home destination "${key}" no longer exists. ` +
            "Choose another with /plot home set <destination>.");
    }
    system.run(() => {
        player.teleport(destination);
        player.sendMessage(`§aTeleported home to §f${key}§a.`);
    });
    return success();
}
function handleAdminCommand(origin, action, destinationName, x, y, z) {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return failure("This command can only be used by a player.");
    }
    if (!player.hasTag("plot_admin")) {
        return failure("You do not have permission to manage plots.");
    }
    if (action === undefined) {
        return failure("Usage: /plot admin <set|remove>");
    }
    const destinations = loadDestinations();
    switch (action.toLowerCase()) {
        case "set": {
            if (destinationName === undefined) {
                return failure("Usage: /plot admin set <destination> [x] [y] [z]");
            }
            const location = player.location;
            const finalX = x ?? location.x;
            const finalY = y ?? location.y;
            const finalZ = z ?? location.z;
            const key = normaliseName(destinationName);
            const alreadyExists = destinations[key] !== undefined;
            destinations[key] = {
                x: finalX,
                y: finalY,
                z: finalZ,
            };
            system.run(() => {
                saveDestinations(destinations);
            });
            return success(`${alreadyExists ? "Updated" : "Added"} ` +
                `"${key}" at ` +
                `${finalX.toFixed(2)}, ` +
                `${finalY.toFixed(2)}, ` +
                `${finalZ.toFixed(2)}.`);
        }
        case "remove": {
            if (destinationName === undefined) {
                return failure("Usage: /plot admin remove <destination>");
            }
            const key = normaliseName(destinationName);
            if (!destinations[key]) {
                return failure(`Destination "${key}" does not exist.`);
            }
            delete destinations[key];
            system.run(() => {
                saveDestinations(destinations);
            });
            return success(`Removed destination "${key}".`);
        }
        default:
            return failure(`Unknown admin action "${action}".`);
    }
}
