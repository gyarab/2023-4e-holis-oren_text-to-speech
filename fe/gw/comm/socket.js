Socket = function({onOpen, onClose, onMessage, log, url}) {
	let socket;
	let gotPong;
	let cid;

	function open() {
		close();

		let proto = location.protocol == 'http:' ? 'ws' : 'wss';
		socket = new WebSocket(url || `${proto}://${location.host}/api/ws`);
		gotPong = true;

		Object.assign(socket, {
			onopen(ev) {
				log && log('OPEN: ', ev);
				onOpen && onOpen();
			},

			onerror(ev) {
				log && log('ERR: ', ev);
			},

			onmessage(ev) {
				let msg = JSON.parse(ev.data);
				if (msg.type == 'PONG') {
					gotPong = true;
					return;
				}

				if (msg.type == 'READY') {
					cid = msg.cid;
				}
				
				log && log('RECV: ', msg);
				onMessage && onMessage(msg);
			},

			onclose(ev) {
				log && log('CLOSE: ', ev);
				socket = null;
				onClose && onClose();
			},
		});
	}

	function close() {
		if (socket) {
			socket.close();
			socket = null;
		}
	}

	function send(data) {
		if (!socket || socket.readyState != 1) {
			throw new Error('Socket is not open');
		}

		log && log('SEND: ', data);

		socket.send(JSON.stringify(data));
	}

	function isOpen() {
		return !!socket;
	}

	function isReady() {
		return socket && socket.readyState == 1;
	}

	// heartbeat
	setInterval(() => {
		if (socket) {
			if (!gotPong) {
				close();
				return;
			}

			if (socket.readyState == 1) {
				send({type: 'PING'});
				gotPong = false;
			}
		}
	}, 60000);

	return {
		isOpen,
		isReady,
		open,
		close,
		send,
		get cid() {
			return cid;
		}
	};
};
