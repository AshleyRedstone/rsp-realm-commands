# RSP Server Packs

a collection of behaviour packs and scripts used by the RSP server

## Custom Commands
- /plot <visit|list|home|admin> <set|remove> <string>
<br>Aliases: /p <v|l|h|a>
<br>*sets a teleportation point for your plot, early in development and subject to change*
- /back
<br>*teleport to your previous location*
- /structures
<br>*lists all world structures with a search field and load/delete options*
- /name
<br>*name a held item, use & for colour codes*
- /gm
<br>*shorthand /gamemode command*
- /input <wireless|cooldown> <rising|falling> <ticks>
<br>*allows you to use a non stackable item as a wireless input or set a cooldown on an input for rising or falling edge*
- /spawn
<br>*teleports you to spawn*
<br>*currently hardcoded with no config option, change it in ./rsp plot bp/scripts/commands/spawn.js*
- /place
<br>*opens a menu to place glitched lectern, powered lightning rod, or the strider minecart setup*
- /settings
<br>*experimental personal player settings featuring ping settings and the nodrops feature*
- /debug
<br>*view and manage world and player dynamic properties and view how much space they take*

## /settings Options
### Ping Options
*set ping terms to blacklist or whitelist*
<br>*add or remove ping terms*

***

### Gameplay Settings
#### No Drops
*deletes any items you drop, including items inside broken container blocks*
#### Auto Cauldron
*automatically fills placed cauldrons*
#### Auto Burnt out Torch
*removes redstone torches placed on redstone blocks after they burn out*
#### Auto Slab
*converts bottom slabs to top slabs when placed*
#### Item Pickup
*enable or disable items from being picked up*

***

### Chat Settings
#### Death Messages
*allows you to enable or disable death messages*

***

This project is translated using [Weblate](https://hosted.weblate.org/projects/rsp-realm-commands/), a libre web-based translation platform. If you'd like to help translate it into your language, head over to our [Weblate project](https://hosted.weblate.org/projects/rsp-realm-commands/).

<p>
  <a href="https://hosted.weblate.org/engage/rsp-realm-commands/">
    <img alt="Translation status" title="Weblate translation status" src="https://hosted.weblate.org/widget/rsp-realm-commands/multi-auto.svg">
  </a>
</p>
