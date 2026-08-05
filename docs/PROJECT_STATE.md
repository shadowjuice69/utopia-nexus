# Utopia Nexus - Project State

## Overview
Utopia Nexus is a Discord bot + Supabase backend + dashboard system for Utopia game intelligence, war tracking, ops analysis, and automation.

## Current State
- Discord bot is deployed through Railway.
- Supabase is connected and stores game intelligence data.
- Dashboard exists for viewing attacks, ops, and intel.
- Firefox extension: Utopia Nexus Intel has been created and submitted to Mozilla Add-ons.
- OpenRouter integration is working.

## Current Focus
Debug and complete the intel pipeline:
Firefox Extension -> Railway API -> Bot/backend -> Supabase -> Dashboard

## Last Known Issue
Science intel was submitted but dashboard showed old update date (8/2/2026). Need verify whether data reaches Railway and whether Supabase tables update correctly.

## Last Session
Created and submitted Firefox extension with data collection permissions added to manifest.

