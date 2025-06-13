# Arackal Tharavadu Discord Bot

![Bot Status](https://img.shields.io/badge/status-active-green)
![Node.js](https://img.shields.io/badge/Node.js-v16.0+-blue)
![Discord.js](https://img.shields.io/badge/Discord.js-v14.15.3-blue)

A feature-rich Discord bot for the **Arackal Tharavadu** server, built with **Node.js** and **Discord.js**. This bot provides server management tools, activity tracking, custom embeds, moderation commands, and more. It also includes an Express server for basic health checks and runs on a robust architecture with error handling and persistent data storage.

## Features

- **Server Statistics**: Displays real-time server status, including online member counts and server details.
- **Activity Tracking**: Tracks user playtime for games and generates leaderboards.
- **Custom Embeds**: Create customizable embeds with buttons and images (owner-only).
- **Moderation Tools**: Commands for kicking, banning, timing out users, and clearing messages.
- **Voice Channel Support**: Join and leave voice channels on command.
- **Nickname Management**: Allows users to request nickname changes via a modal.
- **Welcome Messages**: Sends a customized welcome embed to new members.
- **Custom Status & Activity**: Set the bot's status and activity dynamically (e.g., Playing, Watching).
- **Express Server**: Runs a simple web server for health checks.
- **Persistent Data**: Stores playtime data in a JSON file with periodic saves.

## Prerequisites

- **Node.js** (v16.0 or higher)
- **npm** (Node Package Manager)
- A **Discord Bot Token** from the [Discord Developer Portal](https://discord.com/developers/applications)
- A server with the bot invited and appropriate permissions
- Environment variables configured (see `.env` setup below)

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Alan-Saji-33/arackal-tharavadu-bot.git
   cd arackal-tharavadu-bot
## Commands

The bot supports the following slash commands:

| Command                  | Description                                              | Permissions        |
|--------------------------|----------------------------------------------------------|--------------------|
| `/hi`                   | Sends a friendly greeting embed.                         | Everyone           |
| `/online_members`       | Lists online members with their statuses.                | Everyone           |
| `/help`                 | Displays all available commands with buttons.            | Everyone           |
| `/activity_leaderboard` | Shows the top 10 players by playtime.                    | Everyone           |
| `/invc`                 | Makes the bot join a specified voice channel.            | Everyone           |
| `/outvc`                | Makes the bot leave the current voice channel.           | Everyone           |
| `/embed`                | Sends a custom embed with optional buttons and images.   | Owner Only         |
| `/send_dm`              | Sends a direct message to a specified user.              | Owner Only         |
| `/send_message`         | Sends a message to the current channel with optional file attachments. | Owner Only         |
| `/activity`             | Sets or removes the bot's activity (Playing, Watching, etc.). | Owner Only         |
| `/set_status`           | Sets the bot's status (Online, Idle, DND, Invisible) with custom text. | Owner Only         |
| `/clear_status`         | Clears the bot's custom status.                         | Owner Only         |
| `/setup_activity`       | Sets up the activity tracking system with buttons.       | Owner Only         |
| `/setup_nickname`       | Sets up the nickname change system with a button.        | Owner Only         |
| `/kick`                 | Kicks a user from the server with an optional reason.    | Moderators (KickMembers) |
| `/ban`                  | Bans a user from the server with an optional reason.     | Moderators (BanMembers) |
| `/timeout`              | Times out a user for a specified duration.               | Moderators (ModerateMembers) |
| `/clear`                | Deletes a specified number of messages or messages from a user. | Moderators (ManageMessages) |

### Button Interactions
- **Help Menu Buttons**: Execute `/hi`, `/online_members`, or display server info.
- **Activity Tracker Buttons**: View personal activity stats or the server leaderboard.
- **Nickname Change Button**: Opens a modal for users to request a nickname change.
