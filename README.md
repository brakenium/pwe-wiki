# Wiki source for VCBC

This repository contains the markdown source for the VCBC wiki. The wiki is
hosted on Discord and deployed using [wiki_to_discord.ts](wiki_to_discord.ts).
This allows multiple people to edit the wiki at the same time, and allows
version control.

## How to use

The wiki is split into channels, which are folders in the [wiki](wiki) folder.
Each channel folder can contains multiple messages, represented by markdown.
A channel can have an arbitrary number of messages, but each message must have
content. The content of a message may use any markdown/formatting supported by
Discord.

There are two types of channels, text channels and forum channels. Text
channels are the simplest, and allow any arbitrary folder name as long as
it is suffixed with `_<channel_id>`. Forum channels are basically the same,
except they have a subfolder inside of them. This subfolder describes the
forum post title and does not require an ID suffix. Inside this folder,
messages are represented in the same way as text channels.

Whenever a push is made to the main branch, the wiki is updated. This means
that the wiki is always up to date with the latest changes. However, Whenever
a push is made, messages are recreated. This means that people may receive
notifications for messages that they have already seen. This is a limitation
of the script and might be fixed in the future by editing the messages instead.

Just check out the structure of the [wiki](wiki) folder to get a better idea
of how this tool works.
