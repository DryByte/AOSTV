const fs = require("fs");

class DemoPlayer {
	constructor(aostv, filename) {
		this.fileDescriptor = fs.openSync(filename, "r");
		this.startTimestamp = Date.now()/1000;
		this.aostv = aostv;
		this.packetsLoop = null;

		this.offset = 2; // start in 2 bc first 2 bytes are just replay info
	}

	getNextPacket() {
		let timestampBuf = Buffer.alloc(4);
		fs.readSync(this.fileDescriptor, timestampBuf, 0, 4, this.offset);

		if (Date.now()/1000-this.startTimestamp > timestampBuf.readFloatLE()) {
			//console.log(timestampBuf.readFloatLE());
			let packetLenBuf = Buffer.alloc(2);
			this.offset += 4;

			fs.readSync(this.fileDescriptor, packetLenBuf, 0, 2, this.offset);
			this.offset += 2;

			let packetBuf = Buffer.alloc(packetLenBuf.readUInt16LE());
			fs.readSync(this.fileDescriptor, packetBuf, 0, packetLenBuf.readUInt16LE(), this.offset);
			this.offset += packetLenBuf.readUInt16LE();

			return packetBuf;
		}

		return null;
	}

	sendPackets() {
		let packet = this.getNextPacket();
		if (!packet)
			return;

		switch(packet[0]) {
			case 9: // create player
				this.aostv.ProxyLive.savePlayer(packet);
				break;
			case 12: //existing player
				this.aostv.ProxyLive.savePlayer(packet);
				break;

			// state data
			case 15:
				this.aostv.ProxyLive.setStateData(packet);
				break;

			// map start
			case 18:
				this.aostv.ProxyLive.saveMapStart(packet);
				break;

			//chunkdata
			case 19:
				this.aostv.ProxyLive.saveChunkData(packet);
				break;

			// playerleft
			case 20:
				this.aostv.ProxyLive.deletePlayer(packet);
				break;

			// intel capture
			case 23:
				let playerId = packet[1];
				let player = this.aostv.game.players[playerId];

				if (player) {
					if (player.team.id == 0) {
						let scoreBlue = this.aostv.ProxyLive.stateData.getValue("team_1_score");
						this.aostv.ProxyLive.stateData.setValue("team_1_score", scoreBlue+1);

					} else if(player.team.id == 1) {
						let scoreGreen = this.aostv.ProxyLive.stateData.getValue("team_2_score");
						this.aostv.ProxyLive.stateData.setValue("team_2_score", scoreGreen+1);
					}
				}
				break;
		}

		this.aostv.Proxy.broadcastPacket(packet);
	}
}

module.exports = DemoPlayer;