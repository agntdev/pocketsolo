# Pocket Option Trading Bot — Bot specification

**Archetype:** finance

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that allows a single owner to place and monitor binary-option-style trades on Pocket Option using a single owner-controlled account. The bot provides trade execution, account status checks, trade history, and notifications within Telegram.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Single owner/operator of a Pocket Option account

## Success criteria

- Owner can securely place trades through Telegram commands
- Owner receives real-time trade confirmations and outcomes
- Owner can view account balance, open positions, and trade history
- Bot securely stores credentials and handles errors gracefully

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Initialize bot and show main menu
- **/trade** (command, actor: user, command: /trade) — Place a new trade with parameters: symbol, direction, amount, duration
  - inputs: symbol, direction, amount, duration
  - outputs: trade confirmation with platform trade ID
- **/balance** (command, actor: user, command: /balance) — Show current account balance and equity
  - outputs: account balance summary
- **/open** (command, actor: user, command: /open) — List all open positions
  - outputs: open positions summary
- **/history** (command, actor: user, command: /history) — Show recent trades with outcomes
  - inputs: number of trades to show
  - outputs: trade history summary
- **/cancel** (command, actor: user, command: /cancel) — Attempt to cancel a trade by ID
  - inputs: trade ID
  - outputs: cancellation status
- **/summaries** (command, actor: user, command: /summaries) — Toggle daily summary notifications
  - inputs: on/off
  - outputs: summary status confirmation

## Flows

### Authentication
_Trigger:_ /start

1. Verify owner identity
2. Request Pocket Option credentials
3. Store credentials securely
4. Verify Pocket Option connectivity
5. Show initial account summary

_Data touched:_ Pocket Option credentials

### Place Trade
_Trigger:_ /trade

1. Parse trade parameters
2. Validate parameters
3. Check account balance
4. Place trade on Pocket Option
5. Receive confirmation
6. Store trade record
7. Send confirmation to owner

_Data touched:_ Trade request, Trade record

### View Account Summary
_Trigger:_ /balance

1. Fetch current balance and equity
2. Format summary
3. Send summary to owner

_Data touched:_ Account summary

### View Open Positions
_Trigger:_ /open

1. Fetch open positions from Pocket Option
2. Format summary
3. Send summary to owner

_Data touched:_ Account summary

### View Trade History
_Trigger:_ /history

1. Fetch recent trades
2. Format history summary
3. Send summary to owner

_Data touched:_ Trade record

### Cancel Trade
_Trigger:_ /cancel

1. Verify trade ID exists
2. Attempt to cancel trade
3. Receive cancellation status
4. Send status to owner

_Data touched:_ Trade record

### Toggle Summaries
_Trigger:_ /summaries

1. Update summary preference
2. Confirm new preference

_Data touched:_ Configuration store

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Trade Request** _(retention: persistent)_ — User-submitted trade parameters and status
  - fields: symbol, direction, amount, duration, take_profit, stop_loss, status, platform_trade_id
- **Account Summary** _(retention: session)_ — Current account balance and open positions
  - fields: balance, equity, open_positions_count, recent_pnl
- **Trade Record** _(retention: persistent)_ — Completed trade details and outcome
  - fields: timestamp, symbol, direction, amount, duration, platform_trade_id, outcome, pnl
- **Error/Notification** _(retention: session)_ — System messages and alerts
  - fields: timestamp, message, type, suggested_actions
- **Configuration Store** _(retention: persistent)_ — User preferences and settings
  - fields: notification_summary_enabled, summary_schedule

## Integrations

- **Telegram** (required) — Bot API messaging
- **Pocket Option** (required) — Binary options trading platform integration
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set up and manage Pocket Option credentials
- Place and cancel trades
- View account balance and trade history
- Enable/disable daily summaries

## Notifications

- Immediate trade placement confirmation
- Trade outcome notification
- Daily summary (optional)
- Critical alerts for connectivity issues

## Permissions & privacy

- Private Telegram bot (only owner can access)
- Secure storage of Pocket Option credentials
- No user data shared with third parties

## Edge cases

- Insufficient account balance for trade
- Failed trade placement from Pocket Option
- Invalid trade ID for cancellation
- Pocket Option connectivity issues
- Malformed trade commands

## Required tests

- End-to-end trade placement and confirmation flow
- Account summary retrieval
- Trade history display
- Credential storage and retrieval
- Error handling for failed trades

## Assumptions

- Single owner will use the bot
- Pocket Option API supports required operations
- Telegram bot can maintain persistent connection
