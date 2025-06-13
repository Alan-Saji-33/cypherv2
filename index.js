const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');

// Express server setup
const app = express();
app.use(cors());
app.get('/', (req, res) => res.send('Bot is running and ready!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// Discord bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Configuration
let voiceConnection = null;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const OWNER_ID = process.env.OWNER_ID;
const STATS_CHANNEL_ID = '********8';
const ACTIVITY_CHANNEL_ID = '**********';
const WELCOME_CHANNEL_ID = '**********';
const WELCOME_IMAGE_URL = 'https://i.ibb.co/5gfHdw6J/standard.gif';

// Validate environment variables
const requiredEnvVars = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'OWNER_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Status and activity management
client.currentStatus = {
  status: 'online',
  customText: null,
};
client.currentActivity = {
  type: 'WATCHING',
  text: '[{online}/{total}] players online',
  url: null,
  containsStats: true,
};

// Playtime tracking
const userPlaytimes = new Map();
const activeSessions = new Map();

function loadPlaytimeData() {
  try {
    if (fs.existsSync('./playtimes.json')) {
      const data = fs.readFileSync('./playtimes.json', 'utf-8');
      if (!data || data.trim() === '') {
        console.warn('⚠️ playtimes.json is empty. Initializing with empty object.');
        fs.writeFileSync('./playtimes.json', JSON.stringify({}));
        return;
      }
      try {
        const parsed = JSON.parse(data);
        for (const [userId, userData] of Object.entries(parsed)) {
          if (userData && typeof userData.games === 'object' && typeof userData.total === 'number') {
            userPlaytimes.set(userId, userData);
          } else {
            console.warn(`⚠️ Invalid data for user ${userId}. Skipping.`);
          }
        }
        console.log('✅ Loaded playtime data');
      } catch (parseError) {
        console.error('❌ Error parsing playtimes.json:', parseError);
        fs.writeFileSync('./playtimes.json', JSON.stringify({}));
      }
    } else {
      console.log('ℹ️ playtimes.json does not exist. Creating empty file.');
      fs.writeFileSync('./playtimes.json', JSON.stringify({}));
    }
  } catch (err) {
    console.error('❌ Error loading playtime data:', err);
  }
}

function setupPlaytimeSaver() {
  setInterval(() => {
    const data = {};
    userPlaytimes.forEach((value, key) => {
      data[key] = value;
    });
    fs.writeFileSync('./playtimes.json', JSON.stringify(data));
    console.log('💾 Saved playtime data');
  }, 300000);
}

// Combined slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('hi')
    .setDescription('Greet the user with a custom message.'),
  new SlashCommandBuilder()
    .setName('online_members')
    .setDescription('Display a list of online members.'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands.'),
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send a custom embed message (Owner only)')
    .addStringOption(option => 
      option.setName('title')
        .setDescription('The title of the embed')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('description')
        .setDescription('The description of the embed (use \\n for new lines)')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('image')
        .setDescription('URL of the image to include')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('thumbnail')
        .setDescription('URL of the thumbnail to include')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('footer')
        .setDescription('Footer text for the embed')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('button1')
        .setDescription('First button text')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('button1url')
        .setDescription('First button URL')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('button1emoji')
        .setDescription('First button emoji (format: name:id)')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('button2')
        .setDescription('Second button text')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('button2url')
        .setDescription('Second button URL')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('button2emoji')
        .setDescription('Second button emoji (format: name:id)')
        .setRequired(false))
    .addBooleanOption(option => 
      option.setName('timestamp')
        .setDescription('Add timestamp to embed?')
        .setRequired(false))
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('Channel to send the embed to')
        .setRequired(false))
    .addRoleOption(option => 
      option.setName('mention')
        .setDescription('Role to mention (@role)')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('send_dm')
    .setDescription('Send a direct message to a user (Owner only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to send the DM to')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to send')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('send_message')
    .setDescription('Send a message to the current channel (Owner only)')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to send (use \\n for new lines)')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('Attach a PNG or JPEG file (optional)')
        .setRequired(false))
    .addRoleOption(option =>
      option.setName('mention')
        .setDescription('Role to mention (optional)')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Control the bot\'s activity (e.g., Watching, Playing)')
    .addSubcommand(subcommand =>
      subcommand.setName('set')
        .setDescription('Set a new activity')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Activity type')
            .setRequired(true)
            .addChoices(
              { name: 'Playing', value: 'PLAYING' },
              { name: 'Watching', value: 'WATCHING' },
              { name: 'Listening', value: 'LISTENING' },
              { name: 'Streaming', value: 'STREAMING' }
            ))
        .addStringOption(option =>
          option.setName('text')
            .setDescription('Activity text (use {online} and {total} for counts)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('url')
            .setDescription('Streaming URL (only for STREAMING type)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand.setName('remove')
        .setDescription('Remove the current activity'))
    .addSubcommand(subcommand =>
      subcommand.setName('view')
        .setDescription('View the current activity settings')),
  new SlashCommandBuilder()
    .setName('set_status')
    .setDescription('Set custom bot status (Owner only)')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Status type')
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' }
        ))
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Custom status text')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('clear_status')
    .setDescription('Clear the bot\'s custom status (Owner only)'),
  new SlashCommandBuilder()
    .setName('setup_activity')
    .setDescription('Setup the activity tracking system (Owner only)'),
  new SlashCommandBuilder()
    .setName('activity_leaderboard')
    .setDescription('Show top players by playtime'),
  new SlashCommandBuilder()
    .setName('setup_nickname')
    .setDescription('Setup the nickname change system (Owner only)'),
  new SlashCommandBuilder()
    .setName('invc')
    .setDescription('Make the bot join a specified voice channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The voice channel to join')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)),
  new SlashCommandBuilder()
    .setName('outvc')
    .setDescription('Make the bot leave the voice channel'),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server (Moderators only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server (Moderators only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user for a specified duration (Moderators only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration of the timeout in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages in the channel (Moderators only)')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Delete messages from a specific user')
        .setRequired(false)),
].map(command => command.toJSON());

// Server stats functionality
let lastMessageId = null;
let updateInterval;

async function updateStats() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch({ withPresences: true });

    const nonBotMembers = guild.members.cache.filter(m => !m.user.bot);
    const online = nonBotMembers.filter(
      m => m.presence?.status && ['online', 'idle', 'dnd'].includes(m.presence.status)
    ).size;

    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    const embed = {
      embeds: [
        {
          title: '**SERVER STATUS**',
          color: 0xff0000,
          fields: [
            {
              name: '**> STATUS**',
              value: '```🟢 Online\n```',
              inline: true,
            },
            {
              name: '**> PLAYERS**',
              value: `\`\`\`👥 ${online}/${nonBotMembers.size}\`\`\``,
              inline: true,
            },
            {
              name: '**> INVITE**',
              value: '```https://discord.gg/22mGfCGAqw\n```',
            },
          ],
          footer: {
            text: `Updated every 3 minutes • Today at ${formattedTime}`,
          },
          image: {
            url: 'https://i.imgur.com/yxtM4Aw.jpeg',
          },
        },
      ],
    };

    const channel = await client.channels.fetch(STATS_CHANNEL_ID);
    try {
      if (!lastMessageId) {
        const message = await channel.send(embed);
        lastMessageId = message.id;
      } else {
        try {
          await channel.messages.edit(lastMessageId, embed);
        } catch (editError) {
          const message = await channel.send(embed);
          lastMessageId = message.id;
        }
      }
    } catch (sendError) {
      console.error('Failed to send/update stats message:', sendError);
    }
  } catch (error) {
    console.error('Update failed:', error);
  }
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

async function updateBotActivity() {
  try {
    const activityTypeMap = {
      'PLAYING': ActivityType.Playing,
      'WATCHING': ActivityType.Watching,
      'LISTENING': ActivityType.Listening,
      'STREAMING': ActivityType.Streaming,
    };

    let activities = [];
    let activityText = client.currentActivity?.text;

    if (client.currentActivity) {
      if (client.currentActivity.containsStats) {
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.members.fetch({ withPresences: true });
        const online = guild.members.cache.filter(
          m => !m.user.bot && m.presence?.status && ['online', 'idle', 'dnd'].includes(m.presence.status)
        ).size;
        const total = guild.members.cache.filter(m => !m.user.bot).size;
        activityText = activityText.replace('{online}', online).replace('{total}', total);
      }

      const activityOptions = {
        name: activityText,
        type: activityTypeMap[client.currentActivity.type] || ActivityType.Watching,
      };

      if (client.currentActivity.type === 'STREAMING' && client.currentActivity.url) {
        activityOptions.url = client.currentActivity.url;
      }

      activities.push(activityOptions);
    }

    if (client.currentStatus.customText) {
      activities.push({
        name: client.currentStatus.customText,
        type: ActivityType.Custom,
      });
    }

    client.user.setPresence({
      status: client.currentStatus.status,
      activities,
    });
  } catch (error) {
    console.error('Error updating bot presence:', error);
  }
}

async function handleSetStatusCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  try {
    await interaction.deferReply({ flags: 64 });

    const status = interaction.options.getString('status');
    const customText = interaction.options.getString('text');

    client.currentStatus = {
      status,
      customText,
    };

    await updateBotActivity();

    await interaction.editReply({
      content: `✅ Status set to ${status} with text: ${customText}`,
      flags: 64,
    });
  } catch (error) {
    console.error('Error setting custom status:', error);
    await interaction.editReply({
      content: '❌ Failed to set custom status!',
      flags: 64,
    });
  }
}

async function handleClearStatusCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  try {
    await interaction.deferReply({ flags: 64 });

    client.currentStatus = {
      status: 'online',
      customText: null,
    };

    await updateBotActivity();

    await interaction.editReply({
      content: '✅ Custom status cleared!',
      flags: 64,
    });
  } catch (error) {
    console.error('Error clearing custom status:', error);
    await interaction.editReply({
      content: '❌ Failed to clear custom status!',
      flags: 64,
    });
  }
}

async function handleActivityCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    await interaction.deferReply({ flags: 64 });

    switch (subcommand) {
      case 'set':
        const type = interaction.options.getString('type');
        let text = interaction.options.getString('text');
        const url = interaction.options.getString('url');

        if (type === 'STREAMING' && !url) {
          return interaction.editReply({
            content: '❌ Streaming activity requires a URL!',
            flags: 64,
          });
        }

        client.currentActivity = {
          type,
          text,
          url,
          containsStats: text.includes('{online}') || text.includes('{total}'),
        };

        await updateBotActivity();

        await interaction.editReply({
          content: `✅ Activity set to: ${type} ${text}` + (url ? ` (URL: ${url})` : ''),
          flags: 64,
        });
        break;

      case 'remove':
        client.currentActivity = null;
        await updateBotActivity();
        await interaction.editReply({
          content: '✅ Activity removed!',
          flags: 64,
        });
        break;

      case 'view':
        if (!client.currentActivity) {
          await interaction.editReply({
            content: 'ℹ️ No activity is currently set',
            flags: 64,
          });
        } else {
          await interaction.editReply({
            content: `Current activity:\n**Type:** ${client.currentActivity.type}\n**Text:** ${client.currentActivity.text}` +
                     (client.currentActivity.url ? `\n**URL:** ${client.currentActivity.url}` : ''),
            flags: 64,
          });
        }
        break;
    }
  } catch (error) {
    console.error('Error handling activity command:', error);
    await interaction.editReply({
      content: '❌ Failed to process activity command!',
      flags: 64,
    });
  }
}

async function handleHiCommand(interaction, user) {
  try {
    const hiEmbed = new EmbedBuilder()
      .setTitle(`👋 Hello ${user.username}!`)
      .setDescription(`This is the official Discord bot of **Arackal Tharavadu**, developed by **@hyper.hawk**!\n\nFeel free to explore and interact!`)
      .setColor('#5865F2')
      .setImage('https://i.imgur.com/yxtM4Aw.jpeg')
      .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [hiEmbed], flags: 64 });
  } catch (error) {
    console.error('Error handling hi command:', error);
    await interaction.reply({ content: '❌ Failed to execute hi command!', flags: 64 });
  }
}

async function handleOnlineMembersCommand(interaction, guild) {
  try {
    await interaction.deferReply({ flags: 64 });

    if (!guild) {
      return interaction.editReply({ content: '❌ This command can only be used inside a server.', flags: 64 });
    }

    if (guild.members.cache.size < guild.memberCount) {
      await guild.members.fetch({ withPresences: true });
    }

    const onlineMembers = guild.members.cache.filter(m => 
      !m.user.bot && m.presence?.status && ['online', 'idle', 'dnd'].includes(m.presence.status)
    );

    if (onlineMembers.size === 0) {
      return interaction.editReply({ content: 'ℹ️ No online members found.', flags: 64 });
    }

    const statusGroups = {
      online: [],
      idle: [],
      dnd: [],
    };

    onlineMembers.forEach(member => {
      const status = member.presence.status;
      const nickname = member.nickname || member.user.username;
      const statusEmoji = {
        online: '🟢',
        idle: '🟡',
        dnd: '🔴',
      }[status];

      statusGroups[status].push(`${statusEmoji} **${nickname}**`);
    });

    let description = '';
    
    if (statusGroups.online.length > 0) {
      description += `### Online (${statusGroups.online.length})\n${statusGroups.online.join('\n')}\n\n`;
    }
    if (statusGroups.idle.length > 0) {
      description += `### Idle (${statusGroups.idle.length})\n${statusGroups.idle.join('\n')}\n\n`;
    }
    if (statusGroups.dnd.length > 0) {
      description += `### Do Not Disturb (${statusGroups.dnd.length})\n${statusGroups.dnd.join('\n')}\n\n`;
    }

    const totalMembers = guild.memberCount;
    const onlineCount = statusGroups.online.length;
    const idleCount = statusGroups.idle.length;
    const dndCount = statusGroups.dnd.length;
    const activeCount = onlineCount + idleCount + dndCount;
    const onlinePercentage = Math.round((activeCount / totalMembers) * 100);

    description += `### Server Activity\n`
                 + `🟢 **${onlineCount}** Online | 🟡 **${idleCount}** Idle | 🔴 **${dndCount}** DND\n`
                 + `👥 **${activeCount}/${totalMembers}** members active (${onlinePercentage}%)`;

    const onlineEmbed = new EmbedBuilder()
      .setTitle(`📊 ${guild.name} Member Status`)
      .setDescription(description)
      .setColor('#57F287')
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setFooter({ 
        text: `Requested by ${interaction.user.username}`, 
        iconURL: interaction.user.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [onlineEmbed], flags: 64 });
  } catch (error) {
    console.error('Error handling online members command:', error);
    await interaction.editReply({ content: '❌ Failed to execute online members command!', flags: 64 });
  }
}

async function handleHelpCommand(interaction) {
  try {
    const commandButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('hi_command')
          .setLabel('Say Hello')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👋'),
        new ButtonBuilder()
          .setCustomId('online_command')
          .setLabel('Online Members')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🟢'),
        new ButtonBuilder()
          .setCustomId('serverinfo_command')
          .setLabel('Server Info')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('ℹ️')
      );

    const helpEmbed = new EmbedBuilder()
      .setTitle('🤖 Bot Commands Help')
      .setDescription('Click the buttons below to execute commands or use the slash commands!\n\n' +
                      '**Note**: `/set_status` sets the bot\'s status (e.g., Online, Idle) and custom text. ' +
                      '`/activity` sets the bot\'s activity (e.g., Watching, Playing). Both can be used together.')
      .addFields(
        { name: '👋 /hi', value: 'Get a friendly greeting', inline: true },
        { name: '🟢 /online_members', value: 'See who\'s active in the server', inline: true },
        { name: '📝 /embed', value: 'Create custom embeds (Owner only)', inline: true },
        { name: '📩 /send_dm', value: 'Send DMs to users (Owner only)', inline: true },
        { name: '💬 /send_message', value: 'Send simple messages (Owner only)', inline: true },
        { name: '🎮 /activity', value: 'Set bot\'s activity (e.g., Watching)', inline: true },
        { name: '🎮 /set_status', value: 'Set custom status (Owner only)', inline: true },
        { name: '🎮 /clear_status', value: 'Clear custom status (Owner only)', inline: true },
        { name: '🎮 /setup_activity', value: 'Setup activity tracking (Owner only)', inline: true },
        { name: '🏆 /activity_leaderboard', value: 'Show top players by playtime', inline: true },
        { name: '✏️ /setup_nickname', value: 'Setup nickname change system (Owner only)', inline: true },
        { name: '🔊 /invc', value: 'Make bot join voice channel', inline: true },
        { name: '🔇 /outvc', value: 'Make bot leave voice channel', inline: true },
        { name: '👢 /kick', value: 'Kick a user (Moderators only)', inline: true },
        { name: '🚫 /ban', value: 'Ban a user (Moderators only)', inline: true },
        { name: '⏳ /timeout', value: 'Timeout a user (Moderators only)', inline: true },
        { name: '🗑️ /clear', value: 'Clear messages in a channel (Moderators only)', inline: true },
        { name: 'ℹ️ Server Info', value: 'View server statistics (button only)', inline: true }
      )
      .setColor('#5865F2')
      .setFooter({ 
        text: `${client.user.username} • Click buttons to execute commands`, 
        iconURL: client.user.displayAvatarURL() 
      });

    await interaction.reply({ 
      embeds: [helpEmbed], 
      components: [commandButtons],
      flags: 64 
    });
  } catch (error) {
    console.error('Error handling help command:', error);
    await interaction.reply({ content: '❌ Failed to execute help command!', flags: 64 });
  }
}

async function handleEmbedCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  const title = interaction.options.getString('title');
  let description = interaction.options.getString('description');
  const image = interaction.options.getString('image');
  const thumbnail = interaction.options.getString('thumbnail');
  const footer = interaction.options.getString('footer');
  const button1 = interaction.options.getString('button1');
  const button1url = interaction.options.getString('button1url');
  const button1emoji = interaction.options.getString('button1emoji');
  const button2 = interaction.options.getString('button2');
  const button2url = interaction.options.getString('button2url');
  const button2emoji = interaction.options.getString('button2emoji');
  const timestamp = interaction.options.getBoolean('timestamp') || false;
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
  const mentionRole = interaction.options.getRole('mention');

  description = description.replace(/\\n/g, '\n');

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0xd90707);

  if (image) embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (footer) embed.setFooter({ text: footer });
  if (timestamp) embed.setTimestamp();

  const row = new ActionRowBuilder();

  if (button1 && button1url) {
    if (isValidUrl(button1url)) {
      const button = new ButtonBuilder()
        .setLabel(button1)
        .setStyle(ButtonStyle.Link)
        .setURL(button1url);
      
      if (button1emoji) {
        const emojiParts = button1emoji.split(':');
        if (emojiParts.length === 2) {
          button.setEmoji({ name: emojiParts[0], id: emojiParts[1] });
        }
      }
      
      row.addComponents(button);
    }
  }

  if (button2 && button2url) {
    if (isValidUrl(button2url)) {
      const button = new ButtonBuilder()
        .setLabel(button2)
        .setStyle(ButtonStyle.Link)
        .setURL(button2url);
      
      if (button2emoji) {
        const emojiParts = button2emoji.split(':');
        if (emojiParts.length === 2) {
          button.setEmoji({ name: emojiParts[0], id: emojiParts[1] });
        }
      }
      
      row.addComponents(button);
    }
  }

  try {
    await interaction.deferReply({ flags: 64 });

    let messageContent = '';
    if (mentionRole) {
      messageContent = `${mentionRole}`;
    }

    await targetChannel.send({
      content: messageContent,
      embeds: [embed],
      components: row.components.length > 0 ? [row] : [],
      allowedMentions: { roles: mentionRole ? [mentionRole.id] : [] }
    });

    await interaction.editReply({
      content: `✅ Embed sent successfully to ${targetChannel}!` + 
               (mentionRole ? ` with ${mentionRole.name} mention` : ''),
      flags: 64
    });
  } catch (error) {
    console.error('❌ Error sending embed:', error);
    await interaction.editReply({ 
      content: '❌ There was an error sending the embed!',
      flags: 64
    });
  }
}

async function handleSendDMCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  const user = interaction.options.getUser('user');
  const message = interaction.options.getString('message');

  try {
    await interaction.deferReply({ flags: 64 });
    
    await user.send(message);
    
    await interaction.editReply({
      content: `✅ DM sent successfully to ${user.tag}!`,
      flags: 64
    });
  } catch (error) {
    console.error('❌ Error sending DM:', error);
    await interaction.editReply({ 
      content: '❌ There was an error sending the DM! The user might have DMs disabled.',
      flags: 64
    });
  }
}

async function handleSendMessageCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  const message = interaction.options.getString('message').replace(/\\n/g, '\n');
  const mentionRole = interaction.options.getRole('mention');
  const fileAttachment = interaction.options.getAttachment('file');
  const channel = interaction.channel;

  let files = [];
  if (fileAttachment) {
    const allowedExtensions = ['png', 'jpg', 'jpeg'];
    const extension = fileAttachment.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return interaction.reply({
        content: '❌ Only PNG and JPEG files are allowed!',
        flags: 64
      });
    }
    files = [{ attachment: fileAttachment.url, name: fileAttachment.name }];
  }

  try {
    await interaction.deferReply({ flags: 64 });
    
    let messageContent = message;
    if (mentionRole) {
      messageContent = `${mentionRole}\n${message}`;
    }
    
    await channel.send({
      content: messageContent,
      files: files.length > 0 ? files : undefined,
      allowedMentions: { roles: mentionRole ? [mentionRole.id] : [] }
    });
    
    await interaction.editReply({
      content: `✅ Message sent successfully to ${channel}!` + 
               (mentionRole ? ` with ${mentionRole.name} mention` : '') +
               (fileAttachment ? ` with file ${fileAttachment.name}` : ''),
      flags: 64
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    await interaction.editReply({ 
      content: '❌ There was an error sending the message or file!',
      flags: 64
    });
  }
}

async function handleSetupActivityCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('view_activity')
        .setLabel('View Your Activity')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎮'),
      new ButtonBuilder()
        .setCustomId('view_leaderboard')
        .setLabel('View Leaderboard')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏆')
    );

  const embed = new EmbedBuilder()
    .setTitle('🎮 Game Activity Tracker')
    .setDescription(
      'Track your playtime automatically while playing games!\n\n' +
      '🏆 **View Leaderboard** \n\n' +
      '📊 View your stats or check out the server leaderboard.\n\n'
    )
    .setColor('#5865F2')
    .setImage('https://i.imgur.com/yxtM4Aw.jpeg')
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'Tracking playtime • Arackal Tharavadu' });

  try {
    const channel = await client.channels.fetch(ACTIVITY_CHANNEL_ID);
    await channel.send({ 
      embeds: [embed], 
      components: [row] 
    });
    await interaction.reply({ content: '✅ Activity tracker setup complete!', flags: 64 });
  } catch (error) {
    console.error('Error setting up activity tracker:', error);
    await interaction.reply({ content: '❌ Failed to setup activity tracker!', flags: 64 });
  }
}

async function handleActivityLeaderboard(interaction) {
  try {
    const players = Array.from(userPlaytimes.entries())
      .map(([userId, data]) => {
        const time = data.total;
        return { userId, time, games: data.games };
      })
      .filter(p => p.time > 0)
      .sort((a, b) => b.time - a.time)
      .slice(0, 10);

    if (players.length === 0) {
      return interaction.reply({
        content: 'No activity data available yet!',
        flags: 64
      });
    }

    let description = '';
    players.forEach((player, index) => {
      const hours = Math.floor(player.time / 3600);
      const minutes = Math.floor((player.time % 3600) / 60);
      const topGame = Object.entries(player.games)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1)
        .map(([game]) => game)[0] || 'None';
      description += `**${index + 1}.** <@${player.userId}> - ${hours}h ${minutes}m (Most played: ${topGame})\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 Overall Playtime Leaderboard')
      .setDescription(description)
      .setColor('#FEE75C')
      .setFooter({ text: 'Updated every 5 minutes' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  } catch (error) {
    console.error('Error handling activity leaderboard:', error);
    await interaction.reply({ content: '❌ Failed to execute activity leaderboard command!', flags: 64 });
  }
}

async function handleSetupNicknameCommand(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '⛔️ You do not have permission to use this command.', flags: 64 });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('change_nickname')
        .setLabel('Change Now')
        .setStyle(ButtonStyle.Primary)
    );

  try {
    await interaction.channel.send({ 
      components: [row] 
    });
    await interaction.reply({ content: '✅ Name change system setup complete!', flags: 64 });
  } catch (error) {
    console.error('Error setting up nickname change system:', error);
    await interaction.reply({ content: '❌ Failed to setup name change system!', flags: 64 });
  }
}

async function handleNicknameButton(interaction) {
  try {
    const modal = new ModalBuilder()
      .setCustomId('nickname_modal')
      .setTitle('Change Name');

    const nicknameInput = new TextInputBuilder()
      .setCustomId('new_nickname')
      .setLabel('Enter your new name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Type your desired name')
      .setRequired(true)
      .setMaxLength(32);

    const actionRow = new ActionRowBuilder().addComponents(nicknameInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error showing nickname modal:', error);
    await interaction.reply({ content: '❌ Failed to show nickname modal!', flags: 64 });
  }
}

async function handleNicknameModal(interaction) {
  try {
    const newNickname = interaction.fields.getTextInputValue('new_nickname');

    await interaction.reply({
      content: '✅ Your request has been submitted for review.',
      flags: 64
    });

    const owner = await client.users.fetch(OWNER_ID);
    await owner.send(`Nickname change request from ${interaction.user.tag} (${interaction.user.id}):\nNew nickname: ${newNickname}`);

    setTimeout(async () => {
      try {
        await interaction.member.setNickname(newNickname);
        await interaction.user.send(`✅ Your name has been successfully changed to **${newNickname}**!`);
      } catch (error) {
        console.error('Error changing nickname:', error);
        await interaction.user.send('❌ Failed to change your name. Please contact an admin.');
      }
    }, 5000);
  } catch (error) {
    console.error('Error handling nickname modal:', error);
    await interaction.reply({
      content: '❌ An error occurred while processing your request.',
      flags: 64
    });
  }
}

async function handleInVcCommand(interaction) {
  try {
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.options.getChannel('channel');

    if (channel.type !== ChannelType.GuildVoice) {
      return await interaction.editReply({
        content: '❌ Please select a valid voice channel!',
        flags: 64
      });
    }

    const existingConnection = getVoiceConnection(interaction.guildId);
    if (existingConnection) {
      return await interaction.editReply({
        content: '❌ The bot is already in a voice channel!',
        flags: 64
      });
    }

    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`✅ Bot joined voice channel: ${channel.name}`);
    });

    voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      voiceConnection = null;
      console.log('ℹ️ Bot disconnected from voice channel');
    });

    await interaction.editReply({
      content: `✅ Bot has joined the voice channel: ${channel.name}!`,
      flags: 64
    });
  } catch (error) {
    console.error('Error joining voice channel:', error);
    await interaction.editReply({
      content: '❌ Failed to join the voice channel!',
      flags: 64
    });
  }
}

async function handleOutVcCommand(interaction) {
  try {
    await interaction.deferReply({ flags: 64 });

    const existingConnection = getVoiceConnection(interaction.guildId);
    if (!existingConnection) {
      return await interaction.editReply({
        content: '❌ The bot is not in a voice channel!',
        flags: 64
      });
    }

    existingConnection.destroy();
    voiceConnection = null;

    await interaction.editReply({
      content: '✅ Bot has left the voice channel!',
      flags: 64
    });
  } catch (error) {
    console.error('Error leaving voice channel:', error);
    await interaction.editReply({
      content: '❌ Failed to leave the voice channel!',
      flags: 64
    });
  }
}

async function handleKickCommand(interaction) {
  if (!interaction.member.permissions.has('KickMembers')) {
    return interaction.reply({ content: '⛔️ You do not have permission to kick members.', flags: 64 });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: '❌ User not found in the server.', flags: 64 });
  }

  if (!member.kickable) {
    return interaction.reply({ 
      content: '❌ I cannot kick this user (e.g., they have a higher role or I lack permissions).', 
      flags: 64 
    });
  }

  try {
    await interaction.deferReply({ flags: 64 });

    const kickEmbed = new EmbedBuilder()
      .setTitle('You Have Been Kicked')
      .setDescription(`You were kicked from **${interaction.guild.name}**.`)
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setColor('#FF0000')
      .setImage('https://i.ibb.co/Jw0Z2Lkq/standard-1.gif')
      .setTimestamp();

    await user.send({ embeds: [kickEmbed] }).catch(err => {
      console.error(`Failed to DM ${user.tag} about kick:`, err);
    });

    await member.kick(reason);

    await interaction.editReply({
      content: `✅ Successfully kicked ${user.tag} for: ${reason}`,
      flags: 64
    });
  } catch (error) {
    console.error('Error kicking user:', error);
    await interaction.editReply({
      content: '❌ Failed to kick the user!',
      flags: 64
    });
  }
}

async function handleBanCommand(interaction) {
  if (!interaction.member.permissions.has('BanMembers')) {
    return interaction.reply({ content: '⛔️ You do not have permission to ban members.', flags: 64 });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: '❌ User not found in the server.', flags: 64 });
  }

  if (!member.bannable) {
    return interaction.reply({ 
      content: '❌ I cannot ban this user (e.g., they have a higher role or I lack permissions).', 
      flags: 64 
    });
  }

  try {
    await interaction.deferReply({ flags: 64 });

    const banEmbed = new EmbedBuilder()
      .setTitle('You Have Been Banned')
      .setDescription(`You were banned from **${interaction.guild.name}**.`)
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setColor('#FF0000')
      .setImage('https://i.ibb.co/Jw0Z2Lkq/standard-1.gif')
      .setTimestamp();

    await user.send({ embeds: [banEmbed] }).catch(err => {
      console.error(`Failed to DM ${user.tag} about ban:`, err);
    });

    await interaction.guild.members.ban(user, { reason });

    await interaction.editReply({
      content: `✅ Successfully banned ${user.tag} for: ${reason}`,
      flags: 64
    });
  } catch (error) {
    console.error('Error banning user:', error);
    await interaction.editReply({
      content: '❌ Failed to ban the user!',
      flags: 64
    });
  }
}

async function handleTimeoutCommand(interaction) {
  if (!interaction.member.permissions.has('ModerateMembers')) {
    return interaction.reply({ content: '⛔️ You do not have permission to timeout members.', flags: 64 });
  }

  const user = interaction.options.getUser('user');
  const duration = interaction.options.getInteger('duration');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: '❌ User not found in the server.', flags: 64 });
  }

  if (!member.moderatable) {
    return interaction.reply({ 
      content: '❌ I cannot timeout this user (e.g., they have a higher role or I lack permissions).', 
      flags: 64 
    });
  }

  try {
    await interaction.deferReply({ flags: 64 });

    const timeoutUntil = new Date(Date.now() + duration * 60 * 1000);
    const timeoutEmbed = new EmbedBuilder()
      .setTitle('You Have Been Timed Out')
      .setDescription(`You were timed out in **${interaction.guild.name}**.`)
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Duration', value: `${duration} minutes`, inline: true },
        { name: 'Timeout Ends', value: `<t:${Math.floor(timeoutUntil / 1000)}:R>`, inline: true }
      )
      .setColor('#FFA500')
      .setImage('https://i.ibb.co/Z1MVQrb7/standard-2.gif')
      .setTimestamp();

    await user.send({ embeds: [timeoutEmbed] }).catch(err => {
      console.error(`Failed to DM ${user.tag} about timeout:`, err);
    });

    await member.timeout(duration * 60 * 1000, reason);

    await interaction.editReply({
      content: `✅ Successfully timed out ${user.tag} for ${duration} minutes. Reason: ${reason}`,
      flags: 64
    });
  } catch (error) {
    console.error('Error timing out user:', error);
    await interaction.editReply({
      content: '❌ Failed to timeout the user!',
      flags: 64
    });
  }
}

async function handleClearCommand(interaction) {
  if (!interaction.member.permissions.has('ManageMessages')) {
    return interaction.reply({ content: '⛔️ You do not have permission to manage messages.', flags: 64 });
  }

  const amount = interaction.options.getInteger('amount');
  const user = interaction.options.getUser('user');

  try {
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.channel;
    let messages;

    if (user) {
      messages = await channel.messages.fetch({ limit: 100 });
      messages = messages.filter(msg => msg.author.id === user.id);
      if (amount) {
        messages = messages.first(amount);
      }
    } else if (amount) {
      messages = await channel.messages.fetch({ limit: amount });
    } else {
      messages = await channel.messages.fetch({ limit: 100 });
    }

    if (messages.size === 0) {
      return interaction.editReply({
        content: '❌ No messages found to delete.',
        flags: 64
      });
    }

    await channel.bulkDelete(messages, true);

    await interaction.editReply({
      content: `✅ Successfully deleted ${messages.size} messages${user ? ` from ${user.tag}` : ''}.`,
      flags: 64
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    await interaction.editReply({
      content: '❌ Failed to clear messages! Ensure I have the correct permissions.',
      flags: 64
    });
  }
}

async function handleButtonInteraction(interaction) {
  try {
    switch(interaction.customId) {
      case 'hi_command':
        await handleHiCommand(interaction, interaction.user);
        break;
      case 'online_command':
        await handleOnlineMembersCommand(interaction, interaction.guild);
        break;
      case 'serverinfo_command':
        if (!interaction.guild) {
          await interaction.reply({ content: '❌ This command only works in servers!', flags: 64 });
          return;
        }
        const guild = interaction.guild;
        const serverEmbed = new EmbedBuilder()
          .setTitle(guild.name)
          .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
          .addFields(
            { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp/1000)}:D>`, inline: true },
            { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
            { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
            { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
            { name: '✨ Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
          )
          .setColor('#5865F2')
          .setFooter({ text: `Server ID: ${guild.id}` });
        await interaction.reply({ embeds: [serverEmbed], flags: 64 });
        break;
      case 'view_activity': {
        const userId = interaction.user.id;
        const userData = userPlaytimes.get(userId) || { games: {}, total: 0 };

        let description = '**Your Game Activity:**\n\n';

        if (Object.keys(userData.games).length === 0) {
          description += 'No tracked game activity found.\nPlay some games to see your stats here!';
        } else {
          for (const [game, seconds] of Object.entries(userData.games)) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            description += `**${game}**: ${hours}h ${minutes}m\n`;
          }

          const totalHours = Math.floor(userData.total / 3600);
          const totalMinutes = Math.floor((userData.total % 3600) / 60);
          description += `\n**Total Playtime**: ${totalHours}h ${totalMinutes}m`;
        }

        const activityEmbed = new EmbedBuilder()
          .setTitle(`🎮 ${interaction.user.username}'s Activity`)
          .setDescription(description)
          .setColor('#5865F2')
          .setThumbnail(interaction.user.displayAvatarURL())
          .setTimestamp();

        await interaction.reply({ embeds: [activityEmbed], flags: 64 });
        break;
      }
      case 'view_leaderboard': {
        const topPlayers = Array.from(userPlaytimes.entries())
          .map(([userId, data]) => ({ userId, time: data.total }))
          .filter(p => p.time > 0)
          .sort((a, b) => b.time - a.time)
          .slice(0, 10);

        if (topPlayers.length === 0) {
          return interaction.reply({
            content: 'No activity data available yet!',
            flags: 64
          });
        }

        let leaderboard = '';
        topPlayers.forEach((player, index) => {
          const hours = Math.floor(player.time / 3600);
          const minutes = Math.floor((player.time % 3600) / 60);
          leaderboard += `**${index + 1}.** <@${player.userId}> - ${hours}h ${minutes}m\n`;
        });

        const leaderboardEmbed = new EmbedBuilder()
          .setTitle('🏆 Top Players by Playtime')
          .setDescription(leaderboard)
          .setColor('#5865F2')
          .setFooter({ text: 'Updated every 5 minutes' })
          .setTimestamp();

        await interaction.reply({ embeds: [leaderboardEmbed], flags: 64 });
        break;
      }
      case 'change_nickname':
        await handleNicknameButton(interaction);
        break;
    }
  } catch (error) {
    console.error('Button interaction error:', error);
    await interaction.reply({
      content: '❌ An error occurred while processing your request',
      flags: 64
    });
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (!newPresence || !newPresence.member || newPresence.member.user.bot) return;

  const userId = newPresence.member.user.id;
  const now = Date.now();

  if (!userPlaytimes.has(userId)) {
    userPlaytimes.set(userId, {
      lastUpdate: now,
      games: {},
      total: 0,
    });
  }

  const userData = userPlaytimes.get(userId);
  const currentGames = new Set(newPresence.activities
    .filter(activity => activity.type === ActivityType.Playing)
    .map(activity => activity.name));

  const previousSession = activeSessions.get(userId) || {};

  for (const [game, startTime] of Object.entries(previousSession)) {
    if (currentGames.has(game)) {
      const timeElapsed = (now - startTime) / 1000;
      if (timeElapsed > 0) {
        userData.games[game] = (userData.games[game] || 0) + timeElapsed;
        userData.total += timeElapsed;
        previousSession[game] = now;
      }
    } else {
      const timeElapsed = (now - startTime) / 1000;
      if (timeElapsed > 0) {
        userData.games[game] = (userData.games[game] || 0) + timeElapsed;
        userData.total += timeElapsed;
      }
      delete previousSession[game];
    }
  }

  const newSession = { ...previousSession };
  currentGames.forEach(game => {
    if (!previousSession[game]) {
      newSession[game] = now;
    }
  });

  if (Object.keys(newSession).length > 0) {
    activeSessions.set(userId, newSession);
  } else {
    activeSessions.delete(userId);
  }

  userData.lastUpdate = now;
  userPlaytimes.set(userId, userData);

  updateStats();
  updateBotActivity();
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    if (newState.channelId && (!oldState.channelId || oldState.channelId !== newState.channelId)) {
      const user = newState.member.user;
      if (user.bot) return;
      if (user.id === OWNER_ID) return;

      const channel = newState.guild.channels.cache.get(newState.channelId);
      const owner = await client.users.fetch(OWNER_ID);

      const voiceEmbed = new EmbedBuilder()
        .setTitle('Voice Channel Activity')
        .setDescription(`${user.tag} has joined a voice channel.`)
        .addFields(
          { name: 'User', value: `<@${user.id}>`, inline: true },
          { name: 'Channel', value: channel.name, inline: true }
        )
        .setColor('#5d00ff')
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Join Voice Channel')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${newState.guild.id}/${newState.channelId}`)
        );

      await owner.send({ embeds: [voiceEmbed], components: [row] }).catch(err => {
        console.error(`Failed to DM owner about voice channel activity for ${user.tag}:`, err);
      });
    }
  } catch (error) {
    console.error('Error in voiceStateUpdate:', error);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);

    if (!welcomeChannel) {
      console.error('Welcome channel not found');
      return;
    }

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Welcome!`)
      .setDescription(`Hey ${member}, welcome to Arackal Tharavadu!`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setImage(WELCOME_IMAGE_URL)
      .addFields(
        { name: '\u200B', value: '<#1360132549757636780> Server Status' },
        { name: '', value: '<#1375516948548554752> Change Your Name' },
        { name: '', value: '<#1374273022940286977> View Your Activity' },
        { name: '\u200B', value: '\u200B' },
        { name: 'Name', value: `${member.user.username}`, inline: true },
        { name: 'Joined Date', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: 'Arackal Tharavadu' })
      .setTimestamp();

    await welcomeChannel.send({
      content: `${member}`,
      embeds: [welcomeEmbed]
    });
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isCommand()) {
      switch (interaction.commandName) {
        case 'hi':
          await handleHiCommand(interaction, interaction.user);
          break;
        case 'online_members':
          await handleOnlineMembersCommand(interaction, interaction.guild);
          break;
        case 'help':
          await handleHelpCommand(interaction);
          break;
        case 'embed':
          await handleEmbedCommand(interaction);
          break;
        case 'send_dm':
          await handleSendDMCommand(interaction);
          break;
        case 'send_message':
          await handleSendMessageCommand(interaction);
          break;
        case 'activity':
          await handleActivityCommand(interaction);
          break;
        case 'set_status':
          await handleSetStatusCommand(interaction);
          break;
        case 'clear_status':
          await handleClearStatusCommand(interaction);
          break;
        case 'setup_activity':
          await handleSetupActivityCommand(interaction);
          break;
        case 'activity_leaderboard':
          await handleActivityLeaderboard(interaction);
          break;
        case 'setup_nickname':
          await handleSetupNicknameCommand(interaction);
          break;
        case 'invc':
          await handleInVcCommand(interaction);
          break;
        case 'outvc':
          await handleOutVcCommand(interaction);
          break;
        case 'kick':
          await handleKickCommand(interaction);
          break;
        case 'ban':
          await handleBanCommand(interaction);
          break;
        case 'timeout':
          await handleTimeoutCommand(interaction);
          break;
        case 'clear':
          await handleClearCommand(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown command',
            flags: 64
          });
      }
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'nickname_modal') {
        await handleNicknameModal(interaction);
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred while processing your command!', flags: 64 });
    } else {
      await interaction.followUp({ content: '❌ An error occurred while processing your command!', flags: 64 });
    }
  }
});

// Global error handlers to prevent crashes
// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}}`);
  
  loadPlaytimeData();
  setupPlaytimeSaver();
  updateBotActivity();
  registerCommands();
  updateStats();
  updateInterval = setInterval(() => {
    updateStats();
    updateBotActivity();
  }, 180000);
});

client.login(BOT_TOKEN);
