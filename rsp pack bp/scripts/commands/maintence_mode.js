import { beforeEvents } from "@minecraft/server-admin";
import {getCommandPlayer} from "../utils/helper_functions";
import {system} from "@minecraft/server";

let maintenanceMode = true;

export function handleMaintenanceModeCommand(origin) {
    const player = getCommandPlayer(origin);
    if (maintenanceMode === true) {
        maintenanceMode = false;
        system.run(() => {
            player.sendMessage("Server is no longer in maintenance mode.");
        })
    } else {
        maintenanceMode = true;
        system.run(() => {
            player.sendMessage("Server is now in maintenance mode.");
        })
    }
}

beforeEvents.asyncPlayerJoin.subscribe(async event => {
    if (maintenanceMode) {
        event.disallowJoin(
            "§cServer under maintenance!§r\n\n" +
            "Please try again later."
        );

        return;
    }

    event.allowJoin();
});