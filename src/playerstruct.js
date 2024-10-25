class PlayerStruct {
	constructor(peer, playerId, name) {
		/*
		0 - map loading
		1 - limbo
		2 - spectating
		*/
		this.state = 0;
		this.playerId = playerId;
		this.name = name;
		this.proxyId = 0;
		this.peer = peer;

		this.isMuted = false;
		this.isDeaf = false;
	}
}

module.exports = PlayerStruct;