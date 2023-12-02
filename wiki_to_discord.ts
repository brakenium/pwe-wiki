import Discord, { ClientOptions, Events, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

function getSubDirsOfDir(filepath: fs.PathLike) {
  const filesInChannel = fs.readdirSync(filepath, {
    recursive: true,
    encoding: 'utf-8',
  });

  let subdirs: fs.PathLike[] = [];
  for (const file of filesInChannel) {
    const filePath = `${filepath}/${file}`;
    const isDirectory = fs.lstatSync(filePath).isDirectory();

    if (isDirectory) {
      subdirs.push(filePath);
      break;
    }
  }

  return subdirs;
}

async function getChannelFromFolderName(client: Discord.Client, folderName: string, channelFilter: (channel: Discord.Channel) => boolean) {
  const lastUnderscoreIndex = folderName.lastIndexOf('_');
  const channelId = folderName.substring(lastUnderscoreIndex + 1);
  console.log(`Processing folder ${folderName} with channel id ${channelId}`);
  let channel = await client.channels.fetch(channelId).catch(() => undefined);

  if (!channel) {
    const channelName = folderName.substring(0, lastUnderscoreIndex);
    // Get guild channels
    const guild = await client.guilds.fetch(argv.guildId);
    const channels = await guild.channels.fetch();

    // Find channel by name
    channel = channels.find(
      channel => {
        if (!channel || channel.isDMBased()) return false;
        return channel.guildId === argv.guildId && channel.name === channelName && channelFilter(channel);
      },
    );
  }

  return channel;
}

async function createRequiredMessages(client: Discord.Client, channel: Discord.TextChannel | Discord.ThreadChannel, messages: Discord.Collection<string, Discord.Message<true>>, posts: fs.PathLike[]) {
  // Filter for .md files
  posts = posts
    .filter(post => path.extname(post.toString()) === '.md')
    .sort();
  const messagesByBot = messages
    .filter(message => message.author.id === client.user?.id)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  // Make sure messagesByBot is the same length as posts
  // If not, create new messages
  // If there is too many messages, delete them
  if (messagesByBot.size > posts.length) {
    console.log(`Too many messages in channel ${channel.name}. Deleting messages...`);

    for (let messageIndex = posts.length; messageIndex < messagesByBot.size; messageIndex++) {
      const message = messagesByBot.at(messageIndex);
      await message?.delete();
    }
  }
  else if (messagesByBot.size < posts.length) {
    console.log(`Not enough messages in channel ${channel.name}. Creating messages...`);

    for (let messageIndex = messagesByBot.size; messageIndex < posts.length; messageIndex++) {
      const post = posts[messageIndex];
      const postContent = fs.readFileSync(post, {
        encoding: 'utf-8',
      });

      const messages = await channel.send(postContent);

      messagesByBot.set(messages.id, messages);
    }
  }

  const messagesByBotIter = messagesByBot.values();

  for (let postIndexString in posts) {
    // Make sure postIndex is a number
    const postIndex = parseInt(postIndexString);
    if (isNaN(postIndex)) continue;

    const post = posts[postIndex];
    const postName = path.basename(post.toString());
    const postContent = fs.readFileSync(post, {
      encoding: 'utf-8',
    });

    console.log(postContent);

    let message = messagesByBotIter.next().value;

    if (message) {
      console.log(`Message ${postName} already exists. Editing existing message...`);

      message.edit(postContent);
    }
    else {
      console.log(`Message ${postName} does not exist. Creating new message...`);

      if (!channel) {
        console.log(`Channel ${postName} not found. Skipping message ${postName}`);
        continue;
      }

      await channel.send(postContent);
    }
  }
}

async function processWikiFolder(client: Discord.Client) {
  const filesInWiki = fs.readdirSync(argv.folder, {
    recursive: true,
    encoding: 'utf-8',
  });

  for (const channelFolder of filesInWiki) {
    const channelFolderPath = path.join(argv.folder, channelFolder);
    const isDirectory = fs.lstatSync(channelFolderPath).isDirectory();

    if (!isDirectory) continue;

    // Check if channelFolder has a folder inside it
    // If so, it's a forum post
    // Like: wiki/forumchannel/forumpost
    const subdirsOfChannel = getSubDirsOfDir(channelFolderPath);

    if (subdirsOfChannel.length > 0) {
      // Handle forum channel
      const channel = await getChannelFromFolderName(client, channelFolder, channel => channel.isThread());

      if (!channel || channel.type !== Discord.ChannelType.GuildForum) {
        console.log(`Forum channel ${channelFolder} not found. Skipping folder ${channelFolder}`);
        continue;
      }

      const existingDiscordThreads = await channel.threads.fetch();
      const forumPostsToCreate = fs.readdirSync(channelFolderPath, {
        encoding: 'utf-8',
      })
        .map(post => path.join(channelFolderPath, post))
        .sort();

      // Delete threads that belong to the bot
      for (const thread of existingDiscordThreads.threads.values()) {
        if (thread.ownerId === client.user?.id) {
          await thread.delete();
        }
      }

      for (const forumPostIndex in forumPostsToCreate) {
        const forumPost = forumPostsToCreate[forumPostIndex];
        const forumPostName = path.basename(forumPost.toString());
        console.log(`Creating forum post ${forumPostName}...`);
        const forumMesssages = fs.readdirSync(forumPost, {
          encoding: 'utf-8',
        })
          .map(post => path.join(forumPost, post))
          .sort();


        let thread: Discord.ThreadChannel<true> | undefined = undefined;

        for (const forumMessageIndex in forumMesssages) {
          const forumMessage = forumMesssages[forumMessageIndex];
          const forumMessageContent = fs.readFileSync(forumMessage, {
            encoding: 'utf-8',
          });

          if (forumMessageIndex === '0') {
            // Create new thread
            thread = await channel.threads.create({
              name: forumPostName,
              message: {
                content: forumMessageContent,
              },
            });
          }
          else {
            // Reply to existing thread
            await thread?.send(forumMessageContent);
          }
        }
      }
    }
    else {
      // Check if folder is suffixed with a channel id after the last underscore
      // If not find the channel by name
      const channel = await getChannelFromFolderName(client, channelFolder, _ => true);

      if (!channel || channel.type !== Discord.ChannelType.GuildText) {
        console.log(`Channel ${channelFolder} not found. Skipping folder ${channelFolder}`);
        continue;
      }

      const messages = await channel.messages.fetch();
      const posts = fs.readdirSync(channelFolderPath, {
        encoding: 'utf-8',
      })
        .map(post => path.join(channelFolderPath, post));

      await createRequiredMessages(client, channel, messages, posts);
    }
  }
}

const argv = await yargs(hideBin(process.argv))
  .option('discordtoken', {
    alias: 'd',
    demandOption: true,
    type: 'string',
    description: 'Discord bot token',
  })
  .option('guildId', {
    alias: 'g',
    demandOption: true,
    type: 'string',
    description: 'Discord guild/server id',
  })
  .option('folder', {
    alias: 'f',
    type: 'string',
    default: './wiki',
    description: 'Path to wiki folder',
  })
  .help()
  .alias('help', 'h')
  .argv;

const discordOptions: ClientOptions = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
};

const client = new Discord.Client(discordOptions);

client.once(Events.ClientReady, async client => {
  console.log('Bot is ready!');
  await processWikiFolder(client);

  setTimeout(() => {
    console.log("Finished processing wiki folder. Shutting down bot...");
    process.exit(0);
  }, 5000);
});

client.login(argv.discordtoken);
