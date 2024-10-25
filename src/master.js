const { BasePacket } = require("aos.js").Packets;
const { UByteType, StringType } = require("aos.js").Types;
const { PROXY_DELAY, MASTER, MAX_PROXY_PLAYERS, PROXY_PORT } = require("../config.json");
const crypto = require("crypto");
const enet = require("enet");

const MASTER_IP = "67.205.183.163";
const PORT = 32886;
const MASTER_VER = 31;

class UShortType {
	constructor(skip_bytes=0) {
		this.value;
		this.skip_bytes = skip_bytes;
		this.type_size = skip_bytes+2;
	}

	read(buffer, offset=0) {
		this.value = buffer.readUInt16LE(offset);
		return this.value;
	}

	write(buffer, value, offset=0) {
		this.value = value;
		buffer.writeUInt16LE(value, offset);
	}
}

class MajorUpdate extends BasePacket {
	constructor(packet) {
		super();

		this.fields = {
			max_players: new UByteType(),
			/*bc we are lazy*/
			port: new UShortType(),
			name: new StringType(32),
			game_mode: new StringType(7),
			map: new StringType(20),
		}
	}
}

class Master {
	constructor(aostv) {
		this.client;
		this.aostv = aostv;
		this.connection;
		this.connected = 0;
		this.updateLoop = setInterval(this.sendMajor.bind(this), MASTER.UPDATE_INTERVAL*1000);
		this.motdIndex = 0;

		this.createClient();
	}

	createClient() {
		this.client = enet.createClient();
		this.client.enableCompression();
	}

	connectMaster() {
		console.log("[MASTER] CONNECTING TO MASTER")
		this.connection = this.client.connect({
			address: MASTER_IP,
			port: PORT
		}, 1, MASTER_VER);

		this.connection.on("disconnect", this.onDisconnect.bind(this));
		this.connection.on("connect", this.onConnect.bind(this));
	}

	applyPlaceholders(txt) {
		let countdown = 0;
		let blue_team_name = "Blue";
		let green_team_name = "Green";
		let blue_team_score = 0;
		let green_team_score = 0;

		if (this.aostv.DemoRecorder)
			countdown = Math.round(PROXY_DELAY-(Date.now()/1000-this.aostv.DemoRecorder.startTimestamp));

		if (this.aostv.ProxyLive.stateData) {
			blue_team_name = this.aostv.ProxyLive.stateData.getValue("team_1_name").replace(/\x00/g, "");
			green_team_name = this.aostv.ProxyLive.stateData.getValue("team_2_name").replace(/\x00/g, "");

			blue_team_score = this.aostv.ProxyLive.stateData.getValue("team_1_score");
			green_team_score = this.aostv.ProxyLive.stateData.getValue("team_2_score");
		}

		txt = txt
				.replace(/<!live_countdown>/g, countdown)
				.replace(/<!blue_team_name>/g, blue_team_name)
				.replace(/<!green_team_name>/g, green_team_name)
				.replace(/<!blue_team_score>/g, blue_team_score)
				.replace(/<!green_team_score>/g, green_team_score);

		return txt;
	}

	sendMajor() {
		if(!this.connected)
			return;

		let obj = {};
		let playerCount = MAX_PROXY_PLAYERS-1;
		switch (this.aostv.state) {
			case 0:
				this.motdIndex = (this.motdIndex+1 >= MASTER.WAITING.length) ? 0 : this.motdIndex+1;
				obj = MASTER.WAITING[this.motdIndex];
				break;
			case 1:
				this.motdIndex = (this.motdIndex+1 >= MASTER.STARTING.length) ? 0 : this.motdIndex+1;
				obj = MASTER.STARTING[this.motdIndex];
				break;
			case 2:
				playerCount = Object.keys(this.aostv.Proxy.host.connectedPeers).length;

				this.motdIndex = (this.motdIndex+1 >= MASTER.LIVE.length) ? 0 : this.motdIndex+1;
				obj = MASTER.LIVE[this.motdIndex];
				break;
		}

		obj.name = this.applyPlaceholders(obj.name);

		console.log("[MASTER] Sending data: ", obj);

		let majorUpdate = new MajorUpdate();
		majorUpdate.setValue("max_players", MAX_PROXY_PLAYERS);
		majorUpdate.setValue("port", PROXY_PORT);
		majorUpdate.setValue("name", obj.name+"\0");
		majorUpdate.setValue("game_mode", obj.game_mode+"\0");
		majorUpdate.setValue("map", obj.map+"\0");

		let encoded = majorUpdate.encodeInfos();
		this.connection.send(0, encoded);

		this.sendCount(playerCount);
	}

	sendCount(count) {
		let buf = Buffer.alloc(1);
		buf.writeUInt8(count);

		this.connection.send(0, buf);
	}

	updateCount(count, max) {
		let number = count;
		if (count >= 32 && max > 32)
			number = 31;

		if (count >= max)
			number = 32;

		this.sendCount(number);
	}

	onConnect() {
		console.log("[MASTER] CONNECTED!")
		this.connected = 1;
		this.sendMajor();
	}

	onDisconnect() {
		console.log("[MASTER] DISCONNECTED, TRYING TO RECONNECT")
		this.connected = 0;
		this.connectMaster();
	}
}

module.exports = Master;