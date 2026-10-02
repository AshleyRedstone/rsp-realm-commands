import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, world, } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
const playerSnapshots = new Map();
const TELEPORT_DETECTION_DISTANCE = 8;
const TELEPORT_DETECTION_DISTANCE_SQUARED = TELEPORT_DETECTION_DISTANCE * TELEPORT_DETECTION_DISTANCE;
const STORAGE_KEY = "rsp:destinations";
const HOME_PROPERTY = "rsp:home";
const BACK_PROPERTY = "rsp:back";
const PING_WHITELIST_PROPERTY = "rsp:ping_whitelist";
const PING_BLACKLIST_PROPERTY = "rsp:ping_blacklist";
const PING_ENABLED_PROPERTY = "rsp:ping_enabled";
const defaultDestinations = {
    spawn: {
        x: 0,
        y: 64,
        z: 0,
        rx: 0,
        ry: 0,
    },
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
function sendTranslation(player, key, parameters = []) {
    system.run(() => {
        player.sendMessage({
            translate: key,
            with: parameters,
        });
    });
}
function translatedSuccess(player, key, parameters = []) {
    sendTranslation(player, key, parameters);
    return success();
}
function translatedFailure(player, key, parameters = []) {
    sendTranslation(player, key, parameters);
    return success();
}
function translatedOriginFailure(origin, key, parameters = []) {
    const player = origin.sourceEntity;
    if (player instanceof Player) {
        return translatedFailure(player, key, parameters);
    }
    return failure(key);
}
function sendTranslationNow(player, key, parameters = []) {
    player.sendMessage({
        translate: key,
        with: parameters,
    });
}
system.beforeEvents.startup.subscribe((event) => {
    const registry = event.customCommandRegistry;
    registry.registerEnum("rsp:plot_mode", ["visit", "home", "list", "admin"]);
    registry.registerEnum("rsp:short_mode", ["v", "h", "l", "a"]);
    registry.registerEnum("rsp:admin_action", ["set", "remove", "debug"]);
    registry.registerEnum("rsp:rod_direction", [
        "down",
        "up",
        "north",
        "south",
        "west",
        "east",
    ]);
    registry.registerEnum("rsp:ping_mode", [
        "whitelist",
        "blacklist",
        "toggle",
    ]);
    registry.registerEnum("rsp:ping_action", [
        "add",
        "remove",
        "list",
        "clear",
    ]);
    registry.registerEnum("rsp:gamemode", [
        "survival",
        "creative",
        "adventure",
        "spectator",
        "s",
        "c",
        "a",
        "sp",
        "0",
        "1",
        "2",
        "3",
    ]);
    const placeCommand = {
    name: "rsp:place",
    description: "Place plot objects",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
};

registry.registerCommand(placeCommand, handlePlaceCommand);
    const backCommand = {
        name: "rsp:back",
        description: "Return to your previous location",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
    };
    const shortBackCommand = {
        name: "rsp:b",
        description: "Short alias for /back",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
    };
    registry.registerCommand(backCommand, handleBackCommand);
    registry.registerCommand(shortBackCommand, handleBackCommand);
    const pingCommand = {
        name: "rsp:ping",
        description: "Manage your ping settings",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [
            {
                name: "rsp:ping_mode",
                type: CustomCommandParamType.Enum,
            },
        ],
        optionalParameters: [
            {
                name: "rsp:ping_action",
                type: CustomCommandParamType.Enum,
            },
            {
                name: "phrase",
                type: CustomCommandParamType.String,
            },
        ],
    };
    registry.registerCommand(pingCommand, handlePingCommand);
    const plotCommand = {
        name: "rsp:plot",
        description: "Visit or manage plot destinations",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [
            {
                name: "rsp:plot_mode",
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
        name: "rsp:p",
        description: "Short alias for /plot",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [
            {
                name: "rsp:short_mode",
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
    const gamemodeCommand = {
        name: "rsp:gm",
        description: "Shorthand for /gamemode",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: true,
        mandatoryParameters: [
            {
                name: "rsp:gamemode",
                type: CustomCommandParamType.Enum,
            },
        ],
    };
    registry.registerCommand(gamemodeCommand, handleGamemodeCommand);
});
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
function saveCurrentLocationAsBack(player) {
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
function getCommandPlayer(origin) {
    const source = origin.sourceEntity;
    if (source instanceof Player) {
        return source;
    }
    return undefined;
}
function handlePingCommand(origin, modeArgument, actionArgument, phraseArgument) {
    const player = getCommandPlayer(origin);
    if (player === undefined) {
        return failure("This command can only be used by a player.");
    }
    const mode = modeArgument.toLowerCase();
    if (mode === "toggle") {
        const stored = player.getDynamicProperty(PING_ENABLED_PROPERTY);
        const currentlyEnabled = typeof stored === "boolean"
            ? stored
            : true;
        const newValue = !currentlyEnabled;
        system.run(() => {
            player.setDynamicProperty(PING_ENABLED_PROPERTY, newValue);
        });
        return translatedSuccess(player, newValue
            ? "rsp.ping.enabled"
            : "rsp.ping.disabled");
    }
    if (mode !== "whitelist" &&
        mode !== "blacklist") {
        return translatedFailure(player, "rsp.ping.unknown_list", [modeArgument]);
    }
    if (actionArgument === undefined) {
        return translatedFailure(player, "rsp.ping.action_required");
    }
    const action = actionArgument.toLowerCase();
    const propertyId = mode === "whitelist"
        ? PING_WHITELIST_PROPERTY
        : PING_BLACKLIST_PROPERTY;
    const values = loadPingList(player, propertyId);
    switch (action) {
        case "add": {
            if (phraseArgument === undefined) {
                return translatedFailure(player, "rsp.ping.phrase_required");
            }
            const phrase = normalisePingPhrase(phraseArgument);
            if (phrase.length === 0) {
                return translatedFailure(player, "rsp.ping.phrase_required");
            }
            if (values.includes(phrase)) {
                return translatedFailure(player, "rsp.ping.already_exists", [phrase, mode]);
            }
            system.run(() => {
                savePingList(player, propertyId, [
                    ...values,
                    phrase,
                ]);
            });
            return translatedSuccess(player, "rsp.ping.added", [phrase, mode]);
        }
        case "remove": {
            if (phraseArgument === undefined) {
                return translatedFailure(player, "rsp.ping.phrase_required");
            }
            const phrase = normalisePingPhrase(phraseArgument);
            if (!values.includes(phrase)) {
                return translatedFailure(player, "rsp.ping.not_found", [phrase, mode]);
            }
            system.run(() => {
                savePingList(player, propertyId, values.filter((value) => value !== phrase));
            });
            return translatedSuccess(player, "rsp.ping.removed", [phrase, mode]);
        }
        case "list": {
            if (values.length === 0) {
                return translatedSuccess(player, "rsp.ping.list_empty", [mode]);
            }
            return translatedSuccess(player, "rsp.ping.list", [
                mode,
                values.join(", "),
            ]);
        }
        case "clear": {
            system.run(() => {
                player.setDynamicProperty(propertyId, undefined);
            });
            return translatedSuccess(player, "rsp.ping.cleared", [mode]);
        }
        default:
            return translatedFailure(player, "rsp.ping.unknown_action", [actionArgument]);
    }
}
function handlePlotCommand(origin, mode, argument, destinationName, x, y, z) {
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
function handleShortPlotCommand(origin, mode, argument, destinationName, x, y, z) {
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
function dumpDynamicPropertyUsage(player) {
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
function handleBackCommand(origin) {
    const player = getCommandPlayer(origin);
    if (player === undefined) {
        return failure("This command can only be used by a player.");
    }
    const storedBack = player.getDynamicProperty(BACK_PROPERTY);
    if (typeof storedBack !== "string") {
        return translatedFailure(player, "rsp.back.none");
    }
    let back;
    try {
        back = JSON.parse(storedBack);
    }
    catch {
        return translatedFailure(player, "rsp.back.invalid");
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
            sendTranslationNow(player, "rsp.back.success");
        }
        catch (error) {
            sendTranslationNow(player, "rsp.back.failure", [String(error)]);
        }
    });
    return success();
}
// ============================================================
// /place
// ============================================================

function handlePlaceCommand(origin) {
    const player = getCommandPlayer(origin);

    if (player === undefined) {
        return failure("This command can only be used by a player.");
    }

    system.run(() => {
        showPlaceMenu(player);
    });

    return success();
}


// ============================================================
// Place menu
// ============================================================

function showPlaceMenu(player) {
    const form = new ActionFormData()
        .title("Place")
        .body("Select what you want to place.")
        .button("Lectern")
        .button("Strider")
        .button("Powered Lightning Rod");

    form.show(player).then((response) => {
        if (
            response.canceled ||
            response.selection === undefined
        ) {
            return;
        }

        system.run(() => {
            switch (response.selection) {
                case 0:
                    placeLectern(player);
                    break;

                case 1:
                    placeStrider(player);
                    break;

                case 2:
                    showRodDirectionMenu(player);
                    break;
            }
        });
    }).catch((error) => {
        console.warn(
            `[Place Menu] Failed to show form: ${error}`
        );
    });
}


// ============================================================
// Lectern
// ============================================================

function placeLectern(player) {
    try {
        player.runCommand(
            "structure load lecturn ~ ~-1 ~"
        );

        sendTranslationNow(
            player,
            "plots.lectern.success"
        );
    }
    catch (error) {
        sendTranslationNow(
            player,
            "plots.lectern.failure",
            [String(error)]
        );
    }
}

function placeStrider(player) {
    try {
        player.runCommand(
            "structure load strider ~ ~-1 ~"
        );

        sendTranslationNow(
            player,
            "plots.strider.success"
        );
    }
    catch (error) {
        sendTranslationNow(
            player,
            "plots.strider.failure",
            [String(error)]
        );
    }
}

function placeRodFromPlayerDirection(player) {
    const yaw = player.getRotation().y;

    let direction;

    if (yaw >= -45 && yaw < 45) {
        direction = "south";
    }
    else if (yaw >= 45 && yaw < 135) {
        direction = "west";
    }
    else if (yaw >= -135 && yaw < -45) {
        direction = "east";
    }
    else {
        direction = "north";
    }

    placeRod(player, direction);
}

function showRodDirectionMenu(player) {
    const form = new ActionFormData()
        .title("Lightning Rod")
        .body("Select the direction the rod should face.")
        .button("Player Direction")
        .button("Up")
        .button("Down")
        .button("North")
        .button("South")
        .button("West")
        .button("East")
        .button("Back");

    form.show(player).then((response) => {
        if (
            response.canceled ||
            response.selection === undefined
        ) {
            return;
        }

        system.run(() => {
            switch (response.selection) {
                case 0:
                    placeRodFromPlayerDirection(player);
                    break;

                case 1:
                    placeRod(player, "up");
                    break;

                case 2:
                    placeRod(player, "down");
                    break;

                case 3:
                    placeRod(player, "north");
                    break;

                case 4:
                    placeRod(player, "south");
                    break;

                case 5:
                    placeRod(player, "west");
                    break;

                case 6:
                    placeRod(player, "east");
                    break;

                case 7:
                    showPlaceMenu(player);
                    break;
            }
        });
    }).catch((error) => {
        console.warn(
            `[Place Menu] Failed to show rod direction form: ${error}`
        );
    });
}

function placeRod(player, direction) {
    const directionNumbers = {
        down: 0,
        up: 1,
        north: 2,
        south: 3,
        west: 4,
        east: 5,
    };

    const directionNumber =
        directionNumbers[direction];

    try {
        player.runCommand(
            `setblock ~ ~-1 ~ minecraft:lightning_rod` +
            `["powered_bit"=true,"facing_direction"=${directionNumber}]`
        );

        player.sendMessage({
            translate: "plots.rod.success",
            with: [direction],
        });
    }
    catch (error) {
        player.sendMessage({
            translate: "plots.rod.failure",
            with: [String(error)],
        });
    }
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
const PING_SOUND = "random.orb";
function normalisePingPhrase(phrase) {
    return phrase.trim().toLowerCase();
}
function loadPingList(player, propertyId) {
    const stored = player.getDynamicProperty(propertyId);
    if (typeof stored !== "string") {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((value) => typeof value === "string")
            .map(normalisePingPhrase)
            .filter((value) => value.length > 0);
    }
    catch {
        return [];
    }
}
function savePingList(player, propertyId, values) {
    const uniqueValues = [...new Set(values
            .map(normalisePingPhrase)
            .filter((value) => value.length > 0))];
    if (uniqueValues.length === 0) {
        player.setDynamicProperty(propertyId, undefined);
        return;
    }
    player.setDynamicProperty(propertyId, JSON.stringify(uniqueValues));
}
function getPingListProperty(listType) {
    return listType === "whitelist"
        ? PING_WHITELIST_PROPERTY
        : PING_BLACKLIST_PROPERTY;
}
function getPingRules(player) {
    return {
        whitelist: loadPingList(player, PING_WHITELIST_PROPERTY),
        blacklist: loadPingList(player, PING_BLACKLIST_PROPERTY),
    };
}
world.beforeEvents.chatSend.subscribe((event) => {
    const sender = event.sender;
    const originalMessage = event.message;
    event.cancel = true;
    system.run(() => {
        let formattedMessage = originalMessage;
        for (const target of world.getAllPlayers()) {
            if (!arePingsEnabled(target)) {
                continue;
            }
            const rules = getPingRules(target);
            const matchedTerms = getMatchedPingTerms(originalMessage, target, rules);
            if (matchedTerms.length === 0) {
                continue;
            }
            for (const term of matchedTerms) {
                formattedMessage = highlightPingTerm(formattedMessage, term);
            }
            if (target.id !== sender.id) {
                target.runCommand("playsound random.orb @s ~ ~ ~ 1 1");
            }
        }
        world.sendMessage(`<${sender.name}> ${formattedMessage}`);
    });
});
function getMatchedPingTerms(message, target, rules) {
    const matchedTerms = [];
    const containsBlacklistedTerm = rules.blacklist.some((term) => containsPingTerm(message, term));
    if (containsBlacklistedTerm) {
        return matchedTerms;
    }
    const playerMention = `@${target.name}`;
    if (containsPingTerm(message, playerMention)) {
        matchedTerms.push(playerMention);
    }
    for (const term of rules.whitelist) {
        if (containsPingTerm(message, term)) {
            matchedTerms.push(term);
        }
    }
    return matchedTerms;
}
function highlightPingTerm(message, term) {
    const cleanedTerm = term.trim();
    if (cleanedTerm.length === 0) {
        return message;
    }
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])` +
        `(${escapePingRegex(cleanedTerm)})` +
        `(?=$|[^\\p{L}\\p{N}_])`, "giu");
    return message.replace(pattern, `$1§e$2§r`);
}
function processPings(sender, message) {
    for (const target of world.getAllPlayers()) {
        if (target.id === sender.id) {
            continue;
        }
        if (!arePingsEnabled(target)) {
            continue;
        }
        const rules = getPingRules(target);
        if (!shouldPingPlayer(message, target, rules)) {
            continue;
        }
        target.runCommand("playsound random.orb @s ~ ~ ~ 1 1");
    }
}
function arePingsEnabled(player) {
    const stored = player.getDynamicProperty(PING_ENABLED_PROPERTY);
    return typeof stored === "boolean"
        ? stored
        : true;
}
function shouldPingPlayer(message, target, rules) {
    const containsBlacklistedTerm = rules.blacklist.some((term) => containsPingTerm(message, term));
    if (containsBlacklistedTerm) {
        return false;
    }
    if (containsPingTerm(message, `@${target.name}`)) {
        return true;
    }
    return rules.whitelist.some((term) => containsPingTerm(message, term));
}
function containsPingTerm(message, term) {
    const cleanedTerm = term.trim();
    if (cleanedTerm.length === 0) {
        return false;
    }
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])` +
        `${escapePingRegex(cleanedTerm)}` +
        `(?=$|[^\\p{L}\\p{N}_])`, "iu");
    return pattern.test(message);
}
function escapePingRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function handleGamemodeCommand(origin, mode) {
    const player = getCommandPlayer(origin);
    if (player === undefined) {
        return failure("This command can only be used by a player.");
    }
    const modes = {
        survival: "survival",
        s: "survival",
        "0": "survival",
        creative: "creative",
        c: "creative",
        "1": "creative",
        adventure: "adventure",
        a: "adventure",
        "2": "adventure",
        spectator: "spectator",
        sp: "spectator",
        "3": "spectator",
    };
    const gamemode = modes[mode.toLowerCase()];
    if (gamemode === undefined) {
        return failure(`Unknown gamemode "${mode}".`);
    }
    system.run(() => {
        player.runCommand(`gamemode ${gamemode} @s`);
    });
    return success();
}
