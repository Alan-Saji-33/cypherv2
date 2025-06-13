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
