const enet = require("enet");
const PlayerStruct = require("./playerstruct.js");
const DemoPlayer = require("./demoplayer.js");
const { CreatePlayer, ExistingPlayer, ChatMessage } = require("aos.js").Packets;
const { PROXY_ADMIN_RELAY, PROXY_DELAY, MAX_PROXY_PLAYERS, PROXY_PORT } = require("../config.json");

async function sleep(ms) {
	return await new Promise(res => {
		setTimeout(res, ms);
	});
}

class Proxy {
	constructor(aostv) {
		this.host;
		this.players = new Array(MAX_PROXY_PLAYERS);
		this.bans = [];
		this.aostv = aostv;

		this.createServer();
	}

	createServer() {
		this.host = enet.createServer({
			address: {
				address: "0.0.0.0",
				port: PROXY_PORT
			},
			peers: MAX_PROXY_PLAYERS,
			channels: 1,
			up: 0,
			down: 0
		});
		this.host.enableCompression();
		this.host.on("connect", this.onConnect.bind(this));

		this.host.start()
	}

	getAvailableId() {
		let availableId = null;
		for (let id=0; id<this.players.length;id++) {
			if (this.players[id] == null) {
				availableId = id;
				break;
			}
		}

		return availableId;
	}

	onPacket(player, packet, chan) {
		let data = packet.data();
		let peer = player.peer;

		switch(data[0]) {
			case 9:
				{
					let existingP = new ExistingPlayer(data);
					let cp = new CreatePlayer();

					let name = existingP.getValue("name");
					player.name = name.replace(/\x00/g, "");

					cp.setValue("player_id", player.proxyId);
					cp.setValue("name", name);
					cp.setValue("team", -1);
					cp.setValue("weapon", 0);
					cp.setValue("x", 256);
					cp.setValue("y", 256);
					cp.setValue("z", 0);

					let encoded = cp.encodeInfos();
					peer.send(0, encoded);

					player.state = 2;
					let specCount = Object.keys(this.host.connectedPeers).length;

					let msg = `${player.name} (#${player.playerId}) JOINED [${specCount}/${MAX_PROXY_PLAYERS} Spectators]!`;
					this.broadcastMessage(msg);
					if (PROXY_ADMIN_RELAY)
						this.aostv.sendMessage(`/admin [PROXY] ${msg}`, 1);
				}

				break;

			case 17:
				{
					if (player.state != 2)
						return;

					let sentMsg = new ChatMessage(data);
					let chatmsg = sentMsg.getValue("chat_message");

					if (chatmsg.startsWith("/deaf")) {
						player.isDeaf = !player.isDeaf;
						this.sendMessage(player.playerId, `Deaf mode turned to: ${player.isDeaf}`);
						return;
					}

					if (player.isMuted || player.isDeaf) {
						this.sendMessage(player.playerId, "You are muted.");
						return;
					}

					if (chatmsg.length > 250)
						return;

					let msg = `${player.name} (#${player.playerId}): ${chatmsg}`;
					this.broadcastMessage(msg, true);

					if (PROXY_ADMIN_RELAY)
						this.aostv.sendMessage(`/admin [PROXY] ${msg}`, 1);
				}
				break;
		}
	}

	ban(ip) {
		console.log(`[PROXY BANS] ${ip} BANNED!`)
		this.bans.push(ip);

		for (let peer of Object.values(this.host.connectedPeers)) {
			let address = peer.address().address;

			if (ip == address)
				peer.disconnectNow();
		}

		return true;
	}

	unban(ip) {
		let index = this.bans.indexOf(ip);
		if (index < 0)
			return false;

		console.log(`[PROXY BANS] ${ip} UNBANNED!`)
		this.bans.splice(index, 1);
		return true;
	}

	mute(id) {
		if (!id.startsWith("#"))
			return false;

		id = Number(id.slice(1));
		if (!this.players[id])
			return false;

		this.players[id].isMuted = true;
		return true;
	}

	unmute(id) {
		if (!id.startsWith("#"))
			return false;

		id = Number(id.slice(1));
		if (!this.players[id])
			return false;

		this.players[id].isMuted = false;

		return true;
	}

	getIp(id) {
		if (!id.startsWith("#"))
			return false;

		id = Number(id.slice(1));
		if (!this.players[id])
			return false;

		let player = this.players[id];

		return player.peer.address().address;
	}

	stop() {
		this.aostv.state = 0;
		this.broadcastMessage("MATCH ENDED!");
		clearInterval(this.aostv.DemoPlayer.packetsLoop);

		this.aostv.DemoPlayer = null;
		this.aostv.DemoRecorder = null;
	}

	async liveCountdown() {
		while (this.aostv.state == 1) {
			await sleep(5000);

			let timeToStart = Math.round(PROXY_DELAY-(Date.now()/1000-this.aostv.DemoRecorder.startTimestamp));
			let time = "";

			if (timeToStart <= 0)
				break;

			if (timeToStart < 60) {
				time = `${timeToStart} seconds!`;
			} else {
				time = `${Math.floor(timeToStart/60)}:`;

				let seconds = timeToStart%60;

				if (seconds < 10)
					time+="0"

				time += `${timeToStart%60} minutes`;
			}

			this.broadcastMessage(`MATCH WILL BE ON LIVE IN: ${time}`);
		}
	}

	setOnLive() {
		this.aostv.state = 2;
		this.aostv.DemoPlayer = new DemoPlayer(this.aostv, this.aostv.DemoRecorder.filename);
		this.aostv.DemoPlayer.packetsLoop = setInterval(this.aostv.DemoPlayer.sendPackets.bind(this.aostv.DemoPlayer), 5);

		this.broadcastMessage("MATCH ON LIVE!");
	}

	sendMessage(playerId, msg) {
		if (!this.players[playerId])
			return;

		let player = this.players[playerId];
		let peer = player.peer;
		console.log(`[PROXY DM] MESSAGE TO ${player.name} (${peer.address().address}) - ${msg}`);

		let toSend = new ChatMessage();
		toSend.setValue("chat_type", 1);
		toSend.setValue("player_id", 32);
		toSend.setValue("chat_message", msg);

		let encodedMsg = toSend.encodeInfos();
		peer.send(0, encodedMsg);
	}

	broadcastMessage(msg, isPlayer=false) {
		console.log(`[PROXY] MESSAGE - ${msg}`);

		let toSend = new ChatMessage();
		toSend.setValue("chat_type", 1);
		toSend.setValue("player_id", 32);
		toSend.setValue("chat_message", msg);

		let encodedMsg = toSend.encodeInfos();
		for (let player of this.players) {
			if (!player)
				continue;

			if (player.isDeaf && isPlayer)
				continue;

			if (player.state != 0)
				player.peer.send(0, encodedMsg);
		}
	}

	onDisconnect(player) {
		console.log(`[PROXY] ${player.peer.address().address} disconnected`);
		let specCount = Object.keys(this.host.connectedPeers).length;

		let msg = `${player.name} (#${player.playerId}) DISCONNECTED [${specCount}/${MAX_PROXY_PLAYERS} Spectators]!`;
		this.broadcastMessage(msg)
		if (PROXY_ADMIN_RELAY)
			this.aostv.sendMessage(`/admin [PROXY] ${msg}`, 1);

		this.aostv.Master.updateCount(specCount, MAX_PROXY_PLAYERS);
		delete this.players[player.playerId];
	}

	onConnect(peer, data) {
		if (this.aostv.state < 1 || this.bans.includes(peer.address().address)) {
			peer.disconnectNow();
			return;
		}

		let playerId = this.getAvailableId();
		let player = new PlayerStruct(peer, playerId, "Deuce");
		let specCount = Object.keys(this.host.connectedPeers).length;

		this.players[playerId] = player;

		console.log(`[PROXY] ${peer.address().address} connected`);
		peer.on("message", this.onPacket.bind(this, player));
		peer.on("disconnect", this.onDisconnect.bind(this, player));

		this.aostv.ProxyLive.sendMap(player);
		this.aostv.Master.updateCount(specCount, MAX_PROXY_PLAYERS);
	}

	broadcastPacket(packet) {
		for (let player of this.players) {
			if (!player)
				continue;

			if (player.state != 0)
				player.peer.send(0, packet);
		}
	}
}

module.exports = Proxy;