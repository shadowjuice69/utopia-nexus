# Utopia Nexus Architecture

## Overview
Utopia Nexus is a Utopia game intelligence platform.

## Components

- Discord Bot: Collects war activity, ops, intel, and commands.
- Supabase: Stores structured game data.
- Railway: Hosts backend services.
- Dashboard: Displays kingdom intelligence and analysis.
- Firefox Extension: Captures intel from Utopia pages and sends it to Nexus.
- OpenRouter: Provides AI model access for analysis features.

## Data Flow

Utopia / Discord / Extension -> Backend -> Supabase -> Dashboard / AI Analysis

## Current Focus

Maintain reliable data syncing between collectors, backend, and database.
