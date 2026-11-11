import { EntityComponentTypes } from "@minecraft/server";
import {translatedSuccess} from "../utils/commands";

function handleNameCommand(origin, name) {
    const player = origin.sourceEntity;
    if (!player) return;

    const inventory = player.getComponent(
        EntityComponentTypes.Inventory
    );
    const slot = player.selectedSlotIndex;
    const container = inventory?.container;
    if (!container) return;
    const item = container.getItem(0);
    if (!item) {
        player.sendMessage({
            translate: "rsp:nameFailure"
        });
        return;
    }
    item.nameTag = name.replaceAll("&", "§");

    container.setItem(slot, item);

    translatedSuccess(player, "rsp:nameSuccess", [${item}]);
}
