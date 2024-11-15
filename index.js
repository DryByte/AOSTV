const Master = require("./src/master.js");
const DemoRecorder = require("./src/demorecorder.js");
const Proxy = require("./src/proxy.js");
const ProxyLive = require("./src/proxylive.js");

const crypto = require("crypto");

const AoS = require("aos.js");
const { ChatMessage } = require("aos.js").Packets;
const { OTP_LENGTH, PROXY_DELAY, MAX_PROXY_PLAYERS, SERVER_IP, PROXY_PORT, MASTER } = require("./config.json");

function OTPGen(length) {
	let ret = "";
	for (let i = 0; i < length; i++) {
		ret += String.fromCharCode(crypto.randomInt(48, 122));
	}

	return ret;
}

class Client extends AoS.Client {
	constructor(cfg) {
		super(cfg);

		// 0 - waiting
		// 1 - countdown
		// 2 - live
		this.state = 0;

		this.otp = OTPGen(OTP_LENGTH);
		this.admin = null

		console.log(`[LOGIN INFO] Login with: ${this.otp}`);

		this.Master = new Master(this);
		this.Master.connectMaster();

		this.Proxy = new Proxy(this);
		this.ProxyLive = new ProxyLive(this);

		this.DemoRecorder = null;
		this.DemoPlayer = null;

		//  events
		this.on("StateData", this.onStateData.bind(this));
		this.on("ChatMessage", this.onChatMessage.bind(this));
		this.on("IntelCapture", this.onIntelCapture.bind(this));
		this.on("RawPacket", this.onRawPacket.bind(this));
	}

	onStateData() {
		this.joinGame({team: -1});
	}

	onChatMessage(fields) {
		if (fields.chat_type.value != 1)
			return;

		let msg = fields.chat_message.value;

		if (!msg.startsWith("!"))
			return;

		let p_id = fields.player_id.value;
		if (this.admin !== null && this.admin != p_id) {
			this.sendMessage(`/pm #${p_id} Check https://github.com/DryByte/AOSTV for more information.`, 1);
			return;
		}

		let args = msg.slice(1, -1).split(" ");

		if (this.admin === null) {
			if (args[0] == "login" && args[1] && args[1] == this.otp) {
				this.sendMessage(`#${p_id} Logged in as admin.`, 1);

				this.admin = p_id;
				this.otp = null;
			}

			return;
		}

		switch(args[0]) {
			case "live":
				let date = new Date();
				let dateStr = date.toLocaleString().replace(/ /g, "_").replace(/,/g, "").replace(/\//g, "-");

				let blueTeamName = this.ProxyLive.stateData.getValue("team_1_name").replace(/\x00/g, "");
				let greenTeamName = this.ProxyLive.stateData.getValue("team_2_name").replace(/\x00/g, "");

				let filename = `./replays/${dateStr}_${blueTeamName}vs${greenTeamName}.demo`;
				this.DemoRecorder = new DemoRecorder(filename);
				this.ProxyLive.saveToReplay(this.DemoRecorder);

				this.state = 1;

				this.sendMessage("MATCH IS LIVE! HAVE FUN!");

				this.Proxy.liveCountdown();
				setTimeout(this.Proxy.setOnLive.bind(this.Proxy), PROXY_DELAY*1000);
				break;

			case "unlive":
				this.sendMessage(`Match is going unlive in ${PROXY_DELAY} seconds`);
				setTimeout(this.Proxy.stop.bind(this.Proxy), PROXY_DELAY*1000);

				break;

			case "config":
				args[1] = args[1].slice(0, 10);
				args[2] = args[2].slice(0, 10);

				this.ProxyLive.stateData.setValue("team_1_name", args[1]+'\0'.repeat(10-args[1].length));
				this.ProxyLive.stateData.setValue("team_2_name", args[2]+'\0'.repeat(10-args[2].length));
				
				this.sendMessage("Names updated!", 1);
				break;

			case "ban":
				this.Proxy.ban(args[1]);
				break;
			case "unban":
				this.Proxy.unban(args[1]);
				break;
			case "mute":
				this.Proxy.mute(args[1]);
				break;
			case "unmute":
				this.Proxy.unmute(args[1]);
				break;
			case "ip":
				let res = this.Proxy.getIp(args[1]);

				if (!res) {
					this.sendMessage(`/pm #${this.admin} id not found`);
					break;
				}

				this.sendMessage(`/pm #${this.admin} ${this.Proxy.players[Number(args[1].slice(1))].name}'s IP: ${res}`)
				break;
		}
	}

	onIntelCapture(fields) {
		if (!fields.winning.value)
			return;

		let capId = fields.player_id.value;
		let player = client.game.players[capId];

		if (player) {
			let team = player.team.id;

			if (team == 0) {
				let blueScore = this.ProxyLive.stateData.getValue("team_1_score");
				this.ProxyLive.stateData.setValue("team_1_score", blueScore+1);

			} else if (team == 1) {
				let greenScore = this.ProxyLive.stateData.getValue("team_2_score");
				this.ProxyLive.stateData.setValue("team_2_score", greenScore+1);
			}
		}
	}

	onRawPacket(packet) {
		if (packet[0] == 17 && packet[1] < 32)
			return;

		if (this.state >= 1) {
			this.DemoRecorder.savePacket(packet);
			return;
		}

		switch(packet[0]) {
			case 9:
				this.ProxyLive.savePlayer(packet);
				break;

			case 15:
				this.ProxyLive.setStateData(packet);
				break;

			case 18:
				this.ProxyLive.saveMapStart(packet);
				break;

			case 19:
				this.ProxyLive.saveChunkData(packet);
				break;
		}
	}
}

let client = new Client({name: "AOSTV"});
client.connect(SERVER_IP);