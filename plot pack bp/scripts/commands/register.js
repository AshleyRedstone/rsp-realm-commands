import { CommandPermissionLevel, CustomCommandParamType, system } from "@minecraft/server";
import { handlePlaceCommand } from "../features/place.js";
import { handleBackCommand } from "../features/back.js";
import { handlePingCommand } from "../features/ping.js";
import { handlePlotCommand, handleShortPlotCommand } from "../features/plots.js";
import { handleGamemodeCommand } from "../features/gamemode.js";

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
