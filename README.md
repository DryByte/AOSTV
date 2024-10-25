## AOSTV
It's a proxy server for Ace of Spades, with this you can have a server for spectators with any player count you like, without any aditional scripts in your AoS's server.
AOSTV is a bot, so it can be used in public servers without any issues as well.

### Contributing
If you need help, feel free to open an issue or join our [discord](https://discord.gg/BJkMA49UQt).
Or if you want to help, feel free to open a PR ;)

### Commands
All commands should be ran in the team's chat as a spectator, after being logged in.

- !login [password sent in the bot's console]
	Login as the bot user.
- !live
	Start the match, allowing players to connect to the proxy server.
- !config [team_1_name] [team_2_name]
	Change the team's name.
- !ban [ip]
	Ban an IP from the proxy.
- !unban [ip]
	Unban an IP from the proxy.
- !mute [#id]
	Mute an user in the proxy.
- !unmute [#id]
	Unmute an user in the proxy.
- !ip [#id]
	Get an user's IP.

### Config
Copy `config.json.example` to `config.json`.
Server name has 5 placeholders for customizing what's being displayed:
- <!live_countdown>: Proxy delay until it goes live.
- <!blue_team_name>: Team 1 name.
- <!green_team_name>: Team 2 name.
- <!blue_team_score>: Team 1 score.
- <!green_team_score>: Team 2 score.

```json
{
	"OTP_LENGTH": 6, // Bot's password length
	"PROXY_DELAY": 60, // Proxy server delay, in seconds
	"MAX_PROXY_PLAYERS": 32, // Maximum player count for the proxy server
	"PROXY_PORT": 32885, // Proxy server port
	"SERVER_IP": "aos://16777343:32887", // Server that AOSTV will join
	"PROXY_ADMIN_RELAY": true, // Send all spectator's messages from the proxy server to the main server using /admin
	"MASTER": {
		"UPDATE_INTERVAL": 60, // Interval between server name change
		"WAITING": [
			{
				"name": "AOSTV SERVER",
				"map": "REPLAY",
				"game_mode": "WAITING"
			},
			{
				"name": "WAITING FOR START",
				"map": "PUG",
				"game_mode": "WAITING"
			}
		],
		"STARTING": [
			{
				"name": "STARTING IN <!live_countdown> seconds",
				"map": "PUG",
				"game_mode": "STARTING"
			}
		],
		"LIVE": [
			{
				"name": "LIVE!!",
				"map": "PUG",
				"game_mode": "LIVE"
			},
			{
				"name": "SCORES <!blue_team_name> <!blue_team_score> x <!green_team_score> <!green_team_name>",
				"map": "PUG",
				"game_mode": "LIVE"
			}
		]
	}
}
```