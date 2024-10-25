const fs = require("fs");

class DemoRecorder {
	constructor(filename) {
		this.filename = filename;
		this.fileDescriptor = fs.openSync(filename, "w");
		this.startTimestamp = Date.now()/1000;

		this.saveReplayInfo();
	}

	saveReplayInfo() {
		let infos = Buffer.alloc(2);
		infos.writeUInt8(1);
		infos.writeUInt8(3, 1);

		fs.appendFileSync(this.fileDescriptor, infos);
	}

	savePacket(packet) {
		let tsBuf = Buffer.alloc(4);
		let lenBuf = Buffer.alloc(2);

		tsBuf.writeFloatLE(Date.now()/1000-this.startTimestamp);
		fs.appendFileSync(this.fileDescriptor, tsBuf);

		lenBuf.writeUInt16LE(packet.length);
		fs.appendFileSync(this.fileDescriptor, lenBuf);

		fs.appendFileSync(this.fileDescriptor, packet);
	}
}

module.exports = DemoRecorder;