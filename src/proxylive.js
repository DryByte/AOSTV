const { StateData } = require("aos.js").Packets;

class ProxyLive {
	constructor(aostv) {
		this.playerData = new Array(32);
		this.mapData = [];
		this.aostv = aostv;
		this.stateData;
	}

	saveToReplay(replayRecorder) {
		for (let data of this.mapData) {
			replayRecorder.savePacket(data);
		}

		for (let player of this.playerData) {
			if (!player)
				continue;

			replayRecorder.savePacket(player)
		}

		replayRecorder.savePacket(this.stateData.encodeInfos());
	}

	sendMap(player) {
		let peer = player.peer;
		for (let data of this.mapData) {
			peer.send(0, data);
		}

		for (let player of this.playerData) {
			if (!player)
				continue;

			peer.send(0, player)
		}

		peer.send(0, this.stateData.encodeInfos());

		player.proxyId = this.stateData.getValue("player_id");
		player.state = 1;
	}

	savePlayer(data) {
		this.playerData[data[1]] = data;
	}

	deletePlayer(data) {
		delete this.playerData[data[1]];
	}

	saveMapStart(data) {
		this.mapData = [];
		this.playerData = new Array(32);
		this.mapData.push(data);
	}

	saveChunkData(data) {
		this.mapData.push(data);
	}

	setStateData(data) {
		this.stateData = new StateData(data);
	}
}

module.exports = ProxyLive;