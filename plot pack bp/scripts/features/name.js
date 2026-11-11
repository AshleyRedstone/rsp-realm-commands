import { system, EntityComponentTypes } from "@minecraft/server";
import { success } from "../utils/commands.js";

export default function handleNameCommand(origin, name) {
    const player = origin.sourceEntity;
    if (!player) return;

    system.run(() => {
        if (!player.isValid) return;

        const inventory = player.getComponent(
            EntityComponentTypes.Inventory
        );

        const container = inventory?.container;
        if (!container) return;
        const slot = player.selectedSlotIndex;
        const item = container.getItem(slot);
        if (!item) {
            player.sendMessage({
                translate: "rsp.nameFailure"
            });
            return;
        }

        item.nameTag = name.replaceAll("&", "§");

        container.setItem(slot, item);

        player.sendMessage({ translate: "rsp.nameSuccess", with: [
            item.nameTag
        ] });
    });
    return success();
}
