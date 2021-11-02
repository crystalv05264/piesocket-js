var PieSocket;
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/Blockchain.js":
/*!***************************!*\
  !*** ./src/Blockchain.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Blockchain)
/* harmony export */ });
/* harmony import */ var _PieMessage_json__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./PieMessage.json */ "./src/PieMessage.json");

const BCMEndpoint = 'https://www.piesocket.com/api/blockchain/payloadHash';
const PieMessageAddress = '0x2321c321828946153a845e69ee168f413e85c90d';

class Blockchain {

	constructor(apiKey, channel) {
		this.apiKey = apiKey;
		this.channel = channel;

	}

	async init() {
		const w3 = new Web3(window.ethereum);
		const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
		this.account = accounts[0];

		this.contract = new w3.eth.Contract(_PieMessage_json__WEBPACK_IMPORTED_MODULE_0__.abi, PieMessageAddress);
	}

	checkWeb3() {
		if (typeof Web3 == 'undefined') {
			console.error('Web.js is not installed!');
			return false;
		}

		if (typeof window.ethereum == 'undefined') {
			console.error('MetaMask is not installed!');
			return false;
		}

		return true;
	}

	async confirm(hash) {
		return new Promise(async (resolve, reject) => {

			if (this.checkWeb3()) {
				if (!this.contract) {
					await this.init();
				}

				const receipt = this.contract.methods.confirm(hash).send({ from: this.account });
				receipt.on('transactionHash', resolve)
				receipt.on('error', (error) => {
					reject(error);
				});
			}

		});
	}

	async send(message) {
		return new Promise(async (resolve, reject) => {

			if (this.checkWeb3()) {
				if (!this.contract) {
					await this.init();
				}

				const bacmHash = await this.getTransactionHash(message);

				const receipt = this.contract.methods.send(bacmHash.payload).send({ from: this.account });
				receipt.on('transactionHash', (hash) => {
					resolve({
						hash: hash,
						id: bacmHash.transaction_id
					});
				})
				receipt.on('error', (error) => {
					reject(error);
				});

			} else {
				if (typeof Web3 == 'undefined') {
					reject("Please install Web3.js");
				} else {
					reject("Please install MetaMask");
				}
			}
		});
	}

	async getTransactionHash(message) {
		return new Promise((resolve, reject) => {
			var data = new FormData();

			data.append("apiKey", this.apiKey);
			data.append("channel", this.channel);
			data.append("message", JSON.stringify(message));

			var xhr = new XMLHttpRequest();

			xhr.addEventListener("readystatechange", function () {
				if (this.readyState === 4) {
					try {
						const response = JSON.parse(this.responseText);
						if (response.errors) {
							console.error(`PieSocket Error: ${JSON.stringify(response.errors)}`);
							reject();
						}

						if (response.success) {
							resolve(response.success);
						} else {
							reject("Unknown error");
						}
					} catch (e) {
						console.error("Could not connect to Blockchain Messaging API, try later");
						reject();
					}
				}
			});

			xhr.addEventListener('error', () => {
				console.error("Blockchain Messaging API seems unreachable at the moment, try later");
				reject();
			});

			xhr.open("POST", BCMEndpoint);
			xhr.setRequestHeader("Accept", "application/json");
			xhr.send(data);
		});
	}
}

/***/ }),

/***/ "./src/Channel.js":
/*!************************!*\
  !*** ./src/Channel.js ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Channel)
/* harmony export */ });
/* harmony import */ var _Logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Logger.js */ "./src/Logger.js");
/* harmony import */ var _Blockchain__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Blockchain */ "./src/Blockchain.js");



class Channel {

    constructor(endpoint, identity, init=true) {
        this.events = {};
        this.listeners = {};


        if(!init){
            return;
        }

        this.init(endpoint, identity);
    }

    init(endpoint, identity){        
        this.endpoint = endpoint;
        this.identity = identity;
        this.connection = this.connect();
        this.shouldReconnect = false;
        this.logger = new _Logger_js__WEBPACK_IMPORTED_MODULE_0__["default"](identity);
    }

    connect() {
        var connection = new WebSocket(this.endpoint);
        connection.onmessage = this.onMessage.bind(this);
        connection.onopen = this.onOpen.bind(this);
        connection.onerror = this.onError.bind(this);
        connection.onclose = this.onClose.bind(this);

        return connection;
    }

    on(event, callback) {
        //Register lifecycle callbacks
        this.events[event] = callback;
    }

    listen(event, callback) {
        //Register user defined callbacks
        this.listeners[event] = callback;
    }


    send(data){
        return this.connection.send(data);
    }

    publish(event, data, meta) {
        if (meta && meta.blockchain) {
            return this.sendOnBlockchain(event, data, meta);
        }
        return this.connection.send(JSON.stringify({
            event: event,
            data: data,
            meta: meta
        }));
    }


    sendOnBlockchain(event, data, meta) {
        if (!this.blockchain) {
            this.blockchain = new _Blockchain__WEBPACK_IMPORTED_MODULE_1__["default"](this.identity.apiKey, this.identity.channelId);
        }
        this.blockchain.send(data)
            .then((receipt) => {
                if (this.events['blockchain-hash']) {
                    this.events['blockchain-hash'].bind(this)({
                        event: event,
                        data: data,
                        meta: meta,
                        transactionHash: receipt.hash
                    });
                }
                return this.connection.send(JSON.stringify({ "event": event, "data": data, "meta": { ...meta, "transaction_id": receipt.id, "transaction_hash": receipt.hash } }));
            })
            .catch((e) => {
                if (this.events['blockchain-error']) {
                    this.events['blockchain-error'].bind(this)(e);
                }
            });
    }

    confirmOnBlockchain(event, transactionHash) {
        if (!this.blockchain) {
            this.blockchain = new _Blockchain__WEBPACK_IMPORTED_MODULE_1__["default"](this.identity.apiKey, this.identity.channelId);
        }

        this.blockchain.confirm(transactionHash)
            .then((hash) => {
                if (this.events['blockchain-hash']) {
                    this.events['blockchain-hash'].bind(this)({
                        event: event,
                        confirmationHash: transactionHash,
                        transactionHash: hash
                    });
                }
                return this.connection.send(JSON.stringify({ "event": event, "data": transactionHash, "meta": { "transaction_id": 1, "transaction_hash": hash } }));
            })
            .catch((e) => {
                if (this.events['blockchain-error']) {
                    this.events['blockchain-error'].bind(this)(e);
                }
            });
    }

    onMessage(e) {
        this.logger.log('Channel message:', e);

        try {
            var message = JSON.parse(e.data);
            if (message.error && message.error.length) {
                this.shouldReconnect = false;
            }

            // Fire event listeners
            if (message.event) {
                if (this.listeners[message.event]) {
                    this.listeners[message.event].bind(this)(message.data, message.meta);
                }

                if (this.listeners["*"]) {
                    this.listeners["*"].bind(this)(message.event, message.data, message.meta);
                }
            }
        } catch (jsonException) {
            console.error(jsonException);
        }

        //Fire lifecycle callback
        if (this.events['message']) {
            this.events['message'].bind(this)(e);
        }
    }

    onOpen(e) {
        this.logger.log('Channel connected:', e);
        this.shouldReconnect = true;

        //User defined callback
        if (this.events['open']) {
            this.events['open'].bind(this)(e);
        }
    }

    onError(e) {
        this.logger.error('Channel error:', e);
        this.connection.close();

        //User defined callback
        if (this.events['error']) {
            this.events['error'].bind(this)(e);
        }
    }

    onClose(e) {
        this.logger.warn('Channel closed:', e);
        this.reconnect();

        //User defined callback
        if (this.events['close']) {
            this.events['close'].bind(this)(e);
        }
    }

    reconnect() {
        if (!this.shouldReconnect) {
            return;
        }
        this.logger.log("Reconnecting");
        this.connect();
    }


}

/***/ }),

/***/ "./src/InvalidAuthException.js":
/*!*************************************!*\
  !*** ./src/InvalidAuthException.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ InvalidAuthException)
/* harmony export */ });
class InvalidAuthException{
  constructor(message, name="InvalidAuthException") {
    this.message = "Auth endpoint did not return a valid JWT Token, please see: https://www.piesocket.com/docs/3.0/authentication";
    this.name = name;  
  }
}

/***/ }),

/***/ "./src/Logger.js":
/*!***********************!*\
  !*** ./src/Logger.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Logger)
/* harmony export */ });
class Logger {

    constructor(options) {
        this.options = options;
    }

    log(...data) {
        if (this.options.consoleLogs) {
            console.log(...data);
        }
    }

    warn(...data) {
        if (this.options.consoleLogs) {
            console.warn(...data);
        }
    }

    error(...data) {
        if (this.options.consoleLogs) {
            console.error(...data);
        }
    }

}

/***/ }),

/***/ "./src/PieSocket.js":
/*!**************************!*\
  !*** ./src/PieSocket.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PieSocket)
/* harmony export */ });
/* harmony import */ var _Channel_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Channel.js */ "./src/Channel.js");
/* harmony import */ var _Logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Logger.js */ "./src/Logger.js");
/* harmony import */ var _package_json__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../package.json */ "./package.json");
/* harmony import */ var _InvalidAuthException_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./InvalidAuthException.js */ "./src/InvalidAuthException.js");





const defaultOptions = {
    version: 3,
    clusterId: 'demo',
    apiKey: 'oCdCMcMPQpbvNjUIzqtvF1d2X2okWpDQj4AwARJuAgtjhzKxVEjQU6IdCjwm',
    consoleLogs: false,
    notifySelf: 0,
    jwt: null,
    presence: 0,
    authEndpoint: "/broadcasting/auth",
    authHeaders: {},
    forceAuth: false, 
    userId: null
}

class PieSocket {

    constructor(options) {
        options = options || {};

        this.options = {...defaultOptions, ...options };
        this.connections = {}
        this.logger = new _Logger_js__WEBPACK_IMPORTED_MODULE_1__["default"](this.options);
    }

    subscribe(channelId) {
        var makeEndpoint = this.getEndpoint(channelId);

        if (this.connections[channelId]) {
            this.logger.log("Returning existing channel", channelId);
            return this.connections[channelId];
        }
        
        this.logger.log("Creating new channel", channelId);
        var channel = new _Channel_js__WEBPACK_IMPORTED_MODULE_0__["default"](null, null, false);

        makeEndpoint.then((endpoint)=>{
            channel.init(endpoint, {
                channelId: channelId,
                ...this.options
            });
        });

        this.connections[channelId] = channel;
        return channel;
    }

    unsubscribe(channelId){
        if(this.connections[channelId]){
            this.connections[channelId].shouldReconnect = false;
            this.connections[channelId].connection.close();
            delete this.connections[channelId];
            return true;
        }

        return false;
    }

    getConnections(){
        return this.connections;
    }

    async getAuthToken(channel){
        return new Promise((resolve, reject)=>{
            var data = new FormData();
            data.append("channel_name", channel);
    
            var xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
    
            xhr.addEventListener("readystatechange", function() {
                if(this.readyState === 4) {
                    try{
                        const response =  JSON.parse(this.responseText);
                        resolve(response);
                    }catch(e){
                        reject(new _InvalidAuthException_js__WEBPACK_IMPORTED_MODULE_3__["default"]("Could not fetch auth token", "AuthEndpointResponseError"));
                    }
                }
            });
            xhr.addEventListener('error', ()=>{
                reject(new _InvalidAuthException_js__WEBPACK_IMPORTED_MODULE_3__["default"]("Could not fetch auth token", "AuthEndpointError"));
            });

            xhr.open("POST", this.options.authEndpoint);

            const headers = Object.keys(this.options.authHeaders);
            headers.forEach(header => {
                xhr.setRequestHeader(header, this.options.authHeaders[header]);
            });
    
            xhr.send(data); 
        });
    }

    isGuarded(channel){
        if(this.options.forceAuth){
            return true;
        }

        return (""+channel).startsWith("private-");
    }

    async getEndpoint(channelId) {
        let endpoint = `wss://${this.options.clusterId}.piesocket.com/v${this.options.version}/${channelId}?api_key=${this.options.apiKey}&notify_self=${this.options.notifySelf}&source=jssdk&v=${_package_json__WEBPACK_IMPORTED_MODULE_2__.version}&presence=${this.options.presence}`

        //Set auth
        if(this.options.jwt){
            endpoint = endpoint+"&jwt="+this.options.jwt;
        }
        else if(this.isGuarded(channelId)){
            const auth = await this.getAuthToken(channelId);
            if(auth.auth){
                endpoint = endpoint + "&jwt="+auth.auth;
            }
        }

        //Set user identity
        if(this.options.userId){
            endpoint = endpoint + "&user="+this.options.userId;
        }

        return endpoint;
    }
}

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__(/*! ./PieSocket */ "./src/PieSocket.js")["default"];

/***/ }),

/***/ "./package.json":
/*!**********************!*\
  !*** ./package.json ***!
  \**********************/
/***/ ((module) => {

"use strict";
module.exports = JSON.parse('{"name":"piesocket-js","version":"1.3.5","description":"PieSocket Javascript Client","main":"src/index.js","unpkg":"dist/piesocket.js","scripts":{"test":"echo \\"Error: no test specified\\" && exit 1","start":"NODE_ENV=development webpack serve --mode=development --config webpack.dev.js ","build":"webpack --mode=production --config webpack.prod.js","prepare":"npm run build","watch":"webpack --mode=development --config webpack.dev.js --watch"},"repository":{"type":"git","url":"git+https://github.com/piesocket/piesocket-js.git"},"keywords":["piesocket","client","websocket","pubsub","http"],"author":"PieSocket","license":"MIT","bugs":{"url":"https://github.com/piesocket/piesocket-js/issues"},"homepage":"https://github.com/piesocket/piesocket-js#readme","devDependencies":{"@webpack-cli/serve":"^1.1.0","webpack":"^5.9.0","webpack-cli":"^4.2.0","webpack-dev-server":"^3.11.2","webpack-merge":"^5.4.0"}}');

/***/ }),

/***/ "./src/PieMessage.json":
/*!*****************************!*\
  !*** ./src/PieMessage.json ***!
  \*****************************/
/***/ ((module) => {

"use strict";
module.exports = JSON.parse('{"contractName":"PieMessage","abi":[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"string","name":"transaction_hash","type":"string"}],"name":"Confirmed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"string","name":"payload","type":"string"}],"name":"Sent","type":"event"},{"inputs":[{"internalType":"string","name":"payload","type":"string"}],"name":"send","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"transaction_hash","type":"string"}],"name":"confirm","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}],"metadata":"{\\"compiler\\":{\\"version\\":\\"0.8.9+commit.e5eed63a\\"},\\"language\\":\\"Solidity\\",\\"output\\":{\\"abi\\":[{\\"anonymous\\":false,\\"inputs\\":[{\\"indexed\\":true,\\"internalType\\":\\"address\\",\\"name\\":\\"sender\\",\\"type\\":\\"address\\"},{\\"indexed\\":true,\\"internalType\\":\\"string\\",\\"name\\":\\"transaction_hash\\",\\"type\\":\\"string\\"}],\\"name\\":\\"Confirmed\\",\\"type\\":\\"event\\"},{\\"anonymous\\":false,\\"inputs\\":[{\\"indexed\\":true,\\"internalType\\":\\"address\\",\\"name\\":\\"sender\\",\\"type\\":\\"address\\"},{\\"indexed\\":true,\\"internalType\\":\\"string\\",\\"name\\":\\"payload\\",\\"type\\":\\"string\\"}],\\"name\\":\\"Sent\\",\\"type\\":\\"event\\"},{\\"inputs\\":[{\\"internalType\\":\\"string\\",\\"name\\":\\"transaction_hash\\",\\"type\\":\\"string\\"}],\\"name\\":\\"confirm\\",\\"outputs\\":[{\\"internalType\\":\\"bool\\",\\"name\\":\\"\\",\\"type\\":\\"bool\\"}],\\"stateMutability\\":\\"nonpayable\\",\\"type\\":\\"function\\"},{\\"inputs\\":[{\\"internalType\\":\\"string\\",\\"name\\":\\"payload\\",\\"type\\":\\"string\\"}],\\"name\\":\\"send\\",\\"outputs\\":[{\\"internalType\\":\\"bool\\",\\"name\\":\\"\\",\\"type\\":\\"bool\\"}],\\"stateMutability\\":\\"nonpayable\\",\\"type\\":\\"function\\"}],\\"devdoc\\":{\\"kind\\":\\"dev\\",\\"methods\\":{},\\"version\\":1},\\"userdoc\\":{\\"kind\\":\\"user\\",\\"methods\\":{},\\"version\\":1}},\\"settings\\":{\\"compilationTarget\\":{\\"project:/contracts/PieMessage.sol\\":\\"PieMessage\\"},\\"evmVersion\\":\\"london\\",\\"libraries\\":{},\\"metadata\\":{\\"bytecodeHash\\":\\"ipfs\\"},\\"optimizer\\":{\\"enabled\\":false,\\"runs\\":200},\\"remappings\\":[]},\\"sources\\":{\\"project:/contracts/PieMessage.sol\\":{\\"keccak256\\":\\"0x9c7fd072b12b9cfd1d346a301a45812c72e7989a14dda9e3eddbc9b1ed469730\\",\\"license\\":\\"MIT\\",\\"urls\\":[\\"bzz-raw://5b50f896c5bcdf8293a81770c5bc9b3d143a4780ec82ef7f61e8c91f464545c4\\",\\"dweb:/ipfs/QmSb8eKYU6ooisYUcnoeax5uJ9d5f4XZymKQ8wRMonpeUs\\"]}},\\"version\\":1}","bytecode":"0x608060405234801561001057600080fd5b50610403806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806366792ba11461003b578063c7ab74a41461006b575b600080fd5b610055600480360381019061005091906102bd565b61009b565b6040516100629190610321565b60405180910390f35b610085600480360381019061008091906102bd565b6100ff565b6040516100929190610321565b60405180910390f35b6000816040516100ab91906103b6565b60405180910390203373ffffffffffffffffffffffffffffffffffffffff167f2873db4c443f2bdfc1ca9161c995c63088d84fd7ce820c720d1aa338f8df3ac560405160405180910390a360019050919050565b60008160405161010f91906103b6565b60405180910390203373ffffffffffffffffffffffffffffffffffffffff167f32ca789b21b5e34d5ccf1f368636531fed1844b1063c788dbe989e515b2d756f60405160405180910390a360019050919050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6101ca82610181565b810181811067ffffffffffffffff821117156101e9576101e8610192565b5b80604052505050565b60006101fc610163565b905061020882826101c1565b919050565b600067ffffffffffffffff82111561022857610227610192565b5b61023182610181565b9050602081019050919050565b82818337600083830152505050565b600061026061025b8461020d565b6101f2565b90508281526020810184848401111561027c5761027b61017c565b5b61028784828561023e565b509392505050565b600082601f8301126102a4576102a3610177565b5b81356102b484826020860161024d565b91505092915050565b6000602082840312156102d3576102d261016d565b5b600082013567ffffffffffffffff8111156102f1576102f0610172565b5b6102fd8482850161028f565b91505092915050565b60008115159050919050565b61031b81610306565b82525050565b60006020820190506103366000830184610312565b92915050565b600081519050919050565b600081905092915050565b60005b83811015610370578082015181840152602081019050610355565b8381111561037f576000848401525b50505050565b60006103908261033c565b61039a8185610347565b93506103aa818560208601610352565b80840191505092915050565b60006103c28284610385565b91508190509291505056fea2646970667358221220eb1d5e353469a7d596d9b56b36620c4aeb3f651e25653203a71fba21f10b8d8d64736f6c63430008090033","deployedBytecode":"0x608060405234801561001057600080fd5b50600436106100365760003560e01c806366792ba11461003b578063c7ab74a41461006b575b600080fd5b610055600480360381019061005091906102bd565b61009b565b6040516100629190610321565b60405180910390f35b610085600480360381019061008091906102bd565b6100ff565b6040516100929190610321565b60405180910390f35b6000816040516100ab91906103b6565b60405180910390203373ffffffffffffffffffffffffffffffffffffffff167f2873db4c443f2bdfc1ca9161c995c63088d84fd7ce820c720d1aa338f8df3ac560405160405180910390a360019050919050565b60008160405161010f91906103b6565b60405180910390203373ffffffffffffffffffffffffffffffffffffffff167f32ca789b21b5e34d5ccf1f368636531fed1844b1063c788dbe989e515b2d756f60405160405180910390a360019050919050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6101ca82610181565b810181811067ffffffffffffffff821117156101e9576101e8610192565b5b80604052505050565b60006101fc610163565b905061020882826101c1565b919050565b600067ffffffffffffffff82111561022857610227610192565b5b61023182610181565b9050602081019050919050565b82818337600083830152505050565b600061026061025b8461020d565b6101f2565b90508281526020810184848401111561027c5761027b61017c565b5b61028784828561023e565b509392505050565b600082601f8301126102a4576102a3610177565b5b81356102b484826020860161024d565b91505092915050565b6000602082840312156102d3576102d261016d565b5b600082013567ffffffffffffffff8111156102f1576102f0610172565b5b6102fd8482850161028f565b91505092915050565b60008115159050919050565b61031b81610306565b82525050565b60006020820190506103366000830184610312565b92915050565b600081519050919050565b600081905092915050565b60005b83811015610370578082015181840152602081019050610355565b8381111561037f576000848401525b50505050565b60006103908261033c565b61039a8185610347565b93506103aa818560208601610352565b80840191505092915050565b60006103c28284610385565b91508190509291505056fea2646970667358221220eb1d5e353469a7d596d9b56b36620c4aeb3f651e25653203a71fba21f10b8d8d64736f6c63430008090033","immutableReferences":{},"generatedSources":[],"deployedGeneratedSources":[{"ast":{"nodeType":"YulBlock","src":"0:4723:2","statements":[{"body":{"nodeType":"YulBlock","src":"47:35:2","statements":[{"nodeType":"YulAssignment","src":"57:19:2","value":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"73:2:2","type":"","value":"64"}],"functionName":{"name":"mload","nodeType":"YulIdentifier","src":"67:5:2"},"nodeType":"YulFunctionCall","src":"67:9:2"},"variableNames":[{"name":"memPtr","nodeType":"YulIdentifier","src":"57:6:2"}]}]},"name":"allocate_unbounded","nodeType":"YulFunctionDefinition","returnVariables":[{"name":"memPtr","nodeType":"YulTypedName","src":"40:6:2","type":""}],"src":"7:75:2"},{"body":{"nodeType":"YulBlock","src":"177:28:2","statements":[{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"194:1:2","type":"","value":"0"},{"kind":"number","nodeType":"YulLiteral","src":"197:1:2","type":"","value":"0"}],"functionName":{"name":"revert","nodeType":"YulIdentifier","src":"187:6:2"},"nodeType":"YulFunctionCall","src":"187:12:2"},"nodeType":"YulExpressionStatement","src":"187:12:2"}]},"name":"revert_error_dbdddcbe895c83990c08b3492a0e83918d802a52331272ac6fdb6a7c4aea3b1b","nodeType":"YulFunctionDefinition","src":"88:117:2"},{"body":{"nodeType":"YulBlock","src":"300:28:2","statements":[{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"317:1:2","type":"","value":"0"},{"kind":"number","nodeType":"YulLiteral","src":"320:1:2","type":"","value":"0"}],"functionName":{"name":"revert","nodeType":"YulIdentifier","src":"310:6:2"},"nodeType":"YulFunctionCall","src":"310:12:2"},"nodeType":"YulExpressionStatement","src":"310:12:2"}]},"name":"revert_error_c1322bf8034eace5e0b5c7295db60986aa89aae5e0ea0873e4689e076861a5db","nodeType":"YulFunctionDefinition","src":"211:117:2"},{"body":{"nodeType":"YulBlock","src":"423:28:2","statements":[{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"440:1:2","type":"","value":"0"},{"kind":"number","nodeType":"YulLiteral","src":"443:1:2","type":"","value":"0"}],"functionName":{"name":"revert","nodeType":"YulIdentifier","src":"433:6:2"},"nodeType":"YulFunctionCall","src":"433:12:2"},"nodeType":"YulExpressionStatement","src":"433:12:2"}]},"name":"revert_error_1b9f4a0a5773e33b91aa01db23bf8c55fce1411167c872835e7fa00a4f17d46d","nodeType":"YulFunctionDefinition","src":"334:117:2"},{"body":{"nodeType":"YulBlock","src":"546:28:2","statements":[{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"563:1:2","type":"","value":"0"},{"kind":"number","nodeType":"YulLiteral","src":"566:1:2","type":"","value":"0"}],"functionName":{"name":"revert","nodeType":"YulIdentifier","src":"556:6:2"},"nodeType":"YulFunctionCall","src":"556:12:2"},"nodeType":"YulExpressionStatement","src":"556:12:2"}]},"name":"revert_error_987264b3b1d58a9c7f8255e93e81c77d86d6299019c33110a076957a3e06e2ae","nodeType":"YulFunctionDefinition","src":"457:117:2"},{"body":{"nodeType":"YulBlock","src":"628:54:2","statements":[{"nodeType":"YulAssignment","src":"638:38:2","value":{"arguments":[{"arguments":[{"name":"value","nodeType":"YulIdentifier","src":"656:5:2"},{"kind":"number","nodeType":"YulLiteral","src":"663:2:2","type":"","value":"31"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"652:3:2"},"nodeType":"YulFunctionCall","src":"652:14:2"},{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"672:2:2","type":"","value":"31"}],"functionName":{"name":"not","nodeType":"YulIdentifier","src":"668:3:2"},"nodeType":"YulFunctionCall","src":"668:7:2"}],"functionName":{"name":"and","nodeType":"YulIdentifier","src":"648:3:2"},"nodeType":"YulFunctionCall","src":"648:28:2"},"variableNames":[{"name":"result","nodeType":"YulIdentifier","src":"638:6:2"}]}]},"name":"round_up_to_mul_of_32","nodeType":"YulFunctionDefinition","parameters":[{"name":"value","nodeType":"YulTypedName","src":"611:5:2","type":""}],"returnVariables":[{"name":"result","nodeType":"YulTypedName","src":"621:6:2","type":""}],"src":"580:102:2"},{"body":{"nodeType":"YulBlock","src":"716:152:2","statements":[{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"733:1:2","type":"","value":"0"},{"kind":"number","nodeType":"YulLiteral","src":"736:77:2","type":"","value":"35408467139433450592217433187231851964531694900788300625387963629091585785856"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"726:6:2"},"nodeType":"YulFunctionCall","src":"726:88:2"},"nodeType":"YulExpressionStatement","src":"726:88:2"},{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"830:1:2","type":"","value":"4"},{"kind":"number","nodeType":"YulLiteral","src":"833:4:2","type":"","value":"0x41"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"823:6:2"},"nodeType":"YulFunctionCall","src":"823:15:2"},"nodeType":"YulExpressionStatement","src":"823:15:2"},{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"854:1:2","type":"","value":"0"},{"kind":"number","nodeType":"YulLiteral","src":"857:4:2","type":"","value":"0x24"}],"functionName":{"name":"revert","nodeType":"YulIdentifier","src":"847:6:2"},"nodeType":"YulFunctionCall","src":"847:15:2"},"nodeType":"YulExpressionStatement","src":"847:15:2"}]},"name":"panic_error_0x41","nodeType":"YulFunctionDefinition","src":"688:180:2"},{"body":{"nodeType":"YulBlock","src":"917:238:2","statements":[{"nodeType":"YulVariableDeclaration","src":"927:58:2","value":{"arguments":[{"name":"memPtr","nodeType":"YulIdentifier","src":"949:6:2"},{"arguments":[{"name":"size","nodeType":"YulIdentifier","src":"979:4:2"}],"functionName":{"name":"round_up_to_mul_of_32","nodeType":"YulIdentifier","src":"957:21:2"},"nodeType":"YulFunctionCall","src":"957:27:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"945:3:2"},"nodeType":"YulFunctionCall","src":"945:40:2"},"variables":[{"name":"newFreePtr","nodeType":"YulTypedName","src":"931:10:2","type":""}]},{"body":{"nodeType":"YulBlock","src":"1096:22:2","statements":[{"expression":{"arguments":[],"functionName":{"name":"panic_error_0x41","nodeType":"YulIdentifier","src":"1098:16:2"},"nodeType":"YulFunctionCall","src":"1098:18:2"},"nodeType":"YulExpressionStatement","src":"1098:18:2"}]},"condition":{"arguments":[{"arguments":[{"name":"newFreePtr","nodeType":"YulIdentifier","src":"1039:10:2"},{"kind":"number","nodeType":"YulLiteral","src":"1051:18:2","type":"","value":"0xffffffffffffffff"}],"functionName":{"name":"gt","nodeType":"YulIdentifier","src":"1036:2:2"},"nodeType":"YulFunctionCall","src":"1036:34:2"},{"arguments":[{"name":"newFreePtr","nodeType":"YulIdentifier","src":"1075:10:2"},{"name":"memPtr","nodeType":"YulIdentifier","src":"1087:6:2"}],"functionName":{"name":"lt","nodeType":"YulIdentifier","src":"1072:2:2"},"nodeType":"YulFunctionCall","src":"1072:22:2"}],"functionName":{"name":"or","nodeType":"YulIdentifier","src":"1033:2:2"},"nodeType":"YulFunctionCall","src":"1033:62:2"},"nodeType":"YulIf","src":"1030:88:2"},{"expression":{"arguments":[{"kind":"number","nodeType":"YulLiteral","src":"1134:2:2","type":"","value":"64"},{"name":"newFreePtr","nodeType":"YulIdentifier","src":"1138:10:2"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"1127:6:2"},"nodeType":"YulFunctionCall","src":"1127:22:2"},"nodeType":"YulExpressionStatement","src":"1127:22:2"}]},"name":"finalize_allocation","nodeType":"YulFunctionDefinition","parameters":[{"name":"memPtr","nodeType":"YulTypedName","src":"903:6:2","type":""},{"name":"size","nodeType":"YulTypedName","src":"911:4:2","type":""}],"src":"874:281:2"},{"body":{"nodeType":"YulBlock","src":"1202:88:2","statements":[{"nodeType":"YulAssignment","src":"1212:30:2","value":{"arguments":[],"functionName":{"name":"allocate_unbounded","nodeType":"YulIdentifier","src":"1222:18:2"},"nodeType":"YulFunctionCall","src":"1222:20:2"},"variableNames":[{"name":"memPtr","nodeType":"YulIdentifier","src":"1212:6:2"}]},{"expression":{"arguments":[{"name":"memPtr","nodeType":"YulIdentifier","src":"1271:6:2"},{"name":"size","nodeType":"YulIdentifier","src":"1279:4:2"}],"functionName":{"name":"finalize_allocation","nodeType":"YulIdentifier","src":"1251:19:2"},"nodeType":"YulFunctionCall","src":"1251:33:2"},"nodeType":"YulExpressionStatement","src":"1251:33:2"}]},"name":"allocate_memory","nodeType":"YulFunctionDefinition","parameters":[{"name":"size","nodeType":"YulTypedName","src":"1186:4:2","type":""}],"returnVariables":[{"name":"memPtr","nodeType":"YulTypedName","src":"1195:6:2","type":""}],"src":"1161:129:2"},{"body":{"nodeType":"YulBlock","src":"1363:241:2","statements":[{"body":{"nodeType":"YulBlock","src":"1468:22:2","statements":[{"expression":{"arguments":[],"functionName":{"name":"panic_error_0x41","nodeType":"YulIdentifier","src":"1470:16:2"},"nodeType":"YulFunctionCall","src":"1470:18:2"},"nodeType":"YulExpressionStatement","src":"1470:18:2"}]},"condition":{"arguments":[{"name":"length","nodeType":"YulIdentifier","src":"1440:6:2"},{"kind":"number","nodeType":"YulLiteral","src":"1448:18:2","type":"","value":"0xffffffffffffffff"}],"functionName":{"name":"gt","nodeType":"YulIdentifier","src":"1437:2:2"},"nodeType":"YulFunctionCall","src":"1437:30:2"},"nodeType":"YulIf","src":"1434:56:2"},{"nodeType":"YulAssignment","src":"1500:37:2","value":{"arguments":[{"name":"length","nodeType":"YulIdentifier","src":"1530:6:2"}],"functionName":{"name":"round_up_to_mul_of_32","nodeType":"YulIdentifier","src":"1508:21:2"},"nodeType":"YulFunctionCall","src":"1508:29:2"},"variableNames":[{"name":"size","nodeType":"YulIdentifier","src":"1500:4:2"}]},{"nodeType":"YulAssignment","src":"1574:23:2","value":{"arguments":[{"name":"size","nodeType":"YulIdentifier","src":"1586:4:2"},{"kind":"number","nodeType":"YulLiteral","src":"1592:4:2","type":"","value":"0x20"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"1582:3:2"},"nodeType":"YulFunctionCall","src":"1582:15:2"},"variableNames":[{"name":"size","nodeType":"YulIdentifier","src":"1574:4:2"}]}]},"name":"array_allocation_size_t_string_memory_ptr","nodeType":"YulFunctionDefinition","parameters":[{"name":"length","nodeType":"YulTypedName","src":"1347:6:2","type":""}],"returnVariables":[{"name":"size","nodeType":"YulTypedName","src":"1358:4:2","type":""}],"src":"1296:308:2"},{"body":{"nodeType":"YulBlock","src":"1661:103:2","statements":[{"expression":{"arguments":[{"name":"dst","nodeType":"YulIdentifier","src":"1684:3:2"},{"name":"src","nodeType":"YulIdentifier","src":"1689:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"1694:6:2"}],"functionName":{"name":"calldatacopy","nodeType":"YulIdentifier","src":"1671:12:2"},"nodeType":"YulFunctionCall","src":"1671:30:2"},"nodeType":"YulExpressionStatement","src":"1671:30:2"},{"expression":{"arguments":[{"arguments":[{"name":"dst","nodeType":"YulIdentifier","src":"1742:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"1747:6:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"1738:3:2"},"nodeType":"YulFunctionCall","src":"1738:16:2"},{"kind":"number","nodeType":"YulLiteral","src":"1756:1:2","type":"","value":"0"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"1731:6:2"},"nodeType":"YulFunctionCall","src":"1731:27:2"},"nodeType":"YulExpressionStatement","src":"1731:27:2"}]},"name":"copy_calldata_to_memory","nodeType":"YulFunctionDefinition","parameters":[{"name":"src","nodeType":"YulTypedName","src":"1643:3:2","type":""},{"name":"dst","nodeType":"YulTypedName","src":"1648:3:2","type":""},{"name":"length","nodeType":"YulTypedName","src":"1653:6:2","type":""}],"src":"1610:154:2"},{"body":{"nodeType":"YulBlock","src":"1854:328:2","statements":[{"nodeType":"YulAssignment","src":"1864:75:2","value":{"arguments":[{"arguments":[{"name":"length","nodeType":"YulIdentifier","src":"1931:6:2"}],"functionName":{"name":"array_allocation_size_t_string_memory_ptr","nodeType":"YulIdentifier","src":"1889:41:2"},"nodeType":"YulFunctionCall","src":"1889:49:2"}],"functionName":{"name":"allocate_memory","nodeType":"YulIdentifier","src":"1873:15:2"},"nodeType":"YulFunctionCall","src":"1873:66:2"},"variableNames":[{"name":"array","nodeType":"YulIdentifier","src":"1864:5:2"}]},{"expression":{"arguments":[{"name":"array","nodeType":"YulIdentifier","src":"1955:5:2"},{"name":"length","nodeType":"YulIdentifier","src":"1962:6:2"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"1948:6:2"},"nodeType":"YulFunctionCall","src":"1948:21:2"},"nodeType":"YulExpressionStatement","src":"1948:21:2"},{"nodeType":"YulVariableDeclaration","src":"1978:27:2","value":{"arguments":[{"name":"array","nodeType":"YulIdentifier","src":"1993:5:2"},{"kind":"number","nodeType":"YulLiteral","src":"2000:4:2","type":"","value":"0x20"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"1989:3:2"},"nodeType":"YulFunctionCall","src":"1989:16:2"},"variables":[{"name":"dst","nodeType":"YulTypedName","src":"1982:3:2","type":""}]},{"body":{"nodeType":"YulBlock","src":"2043:83:2","statements":[{"expression":{"arguments":[],"functionName":{"name":"revert_error_987264b3b1d58a9c7f8255e93e81c77d86d6299019c33110a076957a3e06e2ae","nodeType":"YulIdentifier","src":"2045:77:2"},"nodeType":"YulFunctionCall","src":"2045:79:2"},"nodeType":"YulExpressionStatement","src":"2045:79:2"}]},"condition":{"arguments":[{"arguments":[{"name":"src","nodeType":"YulIdentifier","src":"2024:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"2029:6:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"2020:3:2"},"nodeType":"YulFunctionCall","src":"2020:16:2"},{"name":"end","nodeType":"YulIdentifier","src":"2038:3:2"}],"functionName":{"name":"gt","nodeType":"YulIdentifier","src":"2017:2:2"},"nodeType":"YulFunctionCall","src":"2017:25:2"},"nodeType":"YulIf","src":"2014:112:2"},{"expression":{"arguments":[{"name":"src","nodeType":"YulIdentifier","src":"2159:3:2"},{"name":"dst","nodeType":"YulIdentifier","src":"2164:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"2169:6:2"}],"functionName":{"name":"copy_calldata_to_memory","nodeType":"YulIdentifier","src":"2135:23:2"},"nodeType":"YulFunctionCall","src":"2135:41:2"},"nodeType":"YulExpressionStatement","src":"2135:41:2"}]},"name":"abi_decode_available_length_t_string_memory_ptr","nodeType":"YulFunctionDefinition","parameters":[{"name":"src","nodeType":"YulTypedName","src":"1827:3:2","type":""},{"name":"length","nodeType":"YulTypedName","src":"1832:6:2","type":""},{"name":"end","nodeType":"YulTypedName","src":"1840:3:2","type":""}],"returnVariables":[{"name":"array","nodeType":"YulTypedName","src":"1848:5:2","type":""}],"src":"1770:412:2"},{"body":{"nodeType":"YulBlock","src":"2264:278:2","statements":[{"body":{"nodeType":"YulBlock","src":"2313:83:2","statements":[{"expression":{"arguments":[],"functionName":{"name":"revert_error_1b9f4a0a5773e33b91aa01db23bf8c55fce1411167c872835e7fa00a4f17d46d","nodeType":"YulIdentifier","src":"2315:77:2"},"nodeType":"YulFunctionCall","src":"2315:79:2"},"nodeType":"YulExpressionStatement","src":"2315:79:2"}]},"condition":{"arguments":[{"arguments":[{"arguments":[{"name":"offset","nodeType":"YulIdentifier","src":"2292:6:2"},{"kind":"number","nodeType":"YulLiteral","src":"2300:4:2","type":"","value":"0x1f"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"2288:3:2"},"nodeType":"YulFunctionCall","src":"2288:17:2"},{"name":"end","nodeType":"YulIdentifier","src":"2307:3:2"}],"functionName":{"name":"slt","nodeType":"YulIdentifier","src":"2284:3:2"},"nodeType":"YulFunctionCall","src":"2284:27:2"}],"functionName":{"name":"iszero","nodeType":"YulIdentifier","src":"2277:6:2"},"nodeType":"YulFunctionCall","src":"2277:35:2"},"nodeType":"YulIf","src":"2274:122:2"},{"nodeType":"YulVariableDeclaration","src":"2405:34:2","value":{"arguments":[{"name":"offset","nodeType":"YulIdentifier","src":"2432:6:2"}],"functionName":{"name":"calldataload","nodeType":"YulIdentifier","src":"2419:12:2"},"nodeType":"YulFunctionCall","src":"2419:20:2"},"variables":[{"name":"length","nodeType":"YulTypedName","src":"2409:6:2","type":""}]},{"nodeType":"YulAssignment","src":"2448:88:2","value":{"arguments":[{"arguments":[{"name":"offset","nodeType":"YulIdentifier","src":"2509:6:2"},{"kind":"number","nodeType":"YulLiteral","src":"2517:4:2","type":"","value":"0x20"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"2505:3:2"},"nodeType":"YulFunctionCall","src":"2505:17:2"},{"name":"length","nodeType":"YulIdentifier","src":"2524:6:2"},{"name":"end","nodeType":"YulIdentifier","src":"2532:3:2"}],"functionName":{"name":"abi_decode_available_length_t_string_memory_ptr","nodeType":"YulIdentifier","src":"2457:47:2"},"nodeType":"YulFunctionCall","src":"2457:79:2"},"variableNames":[{"name":"array","nodeType":"YulIdentifier","src":"2448:5:2"}]}]},"name":"abi_decode_t_string_memory_ptr","nodeType":"YulFunctionDefinition","parameters":[{"name":"offset","nodeType":"YulTypedName","src":"2242:6:2","type":""},{"name":"end","nodeType":"YulTypedName","src":"2250:3:2","type":""}],"returnVariables":[{"name":"array","nodeType":"YulTypedName","src":"2258:5:2","type":""}],"src":"2202:340:2"},{"body":{"nodeType":"YulBlock","src":"2624:433:2","statements":[{"body":{"nodeType":"YulBlock","src":"2670:83:2","statements":[{"expression":{"arguments":[],"functionName":{"name":"revert_error_dbdddcbe895c83990c08b3492a0e83918d802a52331272ac6fdb6a7c4aea3b1b","nodeType":"YulIdentifier","src":"2672:77:2"},"nodeType":"YulFunctionCall","src":"2672:79:2"},"nodeType":"YulExpressionStatement","src":"2672:79:2"}]},"condition":{"arguments":[{"arguments":[{"name":"dataEnd","nodeType":"YulIdentifier","src":"2645:7:2"},{"name":"headStart","nodeType":"YulIdentifier","src":"2654:9:2"}],"functionName":{"name":"sub","nodeType":"YulIdentifier","src":"2641:3:2"},"nodeType":"YulFunctionCall","src":"2641:23:2"},{"kind":"number","nodeType":"YulLiteral","src":"2666:2:2","type":"","value":"32"}],"functionName":{"name":"slt","nodeType":"YulIdentifier","src":"2637:3:2"},"nodeType":"YulFunctionCall","src":"2637:32:2"},"nodeType":"YulIf","src":"2634:119:2"},{"nodeType":"YulBlock","src":"2763:287:2","statements":[{"nodeType":"YulVariableDeclaration","src":"2778:45:2","value":{"arguments":[{"arguments":[{"name":"headStart","nodeType":"YulIdentifier","src":"2809:9:2"},{"kind":"number","nodeType":"YulLiteral","src":"2820:1:2","type":"","value":"0"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"2805:3:2"},"nodeType":"YulFunctionCall","src":"2805:17:2"}],"functionName":{"name":"calldataload","nodeType":"YulIdentifier","src":"2792:12:2"},"nodeType":"YulFunctionCall","src":"2792:31:2"},"variables":[{"name":"offset","nodeType":"YulTypedName","src":"2782:6:2","type":""}]},{"body":{"nodeType":"YulBlock","src":"2870:83:2","statements":[{"expression":{"arguments":[],"functionName":{"name":"revert_error_c1322bf8034eace5e0b5c7295db60986aa89aae5e0ea0873e4689e076861a5db","nodeType":"YulIdentifier","src":"2872:77:2"},"nodeType":"YulFunctionCall","src":"2872:79:2"},"nodeType":"YulExpressionStatement","src":"2872:79:2"}]},"condition":{"arguments":[{"name":"offset","nodeType":"YulIdentifier","src":"2842:6:2"},{"kind":"number","nodeType":"YulLiteral","src":"2850:18:2","type":"","value":"0xffffffffffffffff"}],"functionName":{"name":"gt","nodeType":"YulIdentifier","src":"2839:2:2"},"nodeType":"YulFunctionCall","src":"2839:30:2"},"nodeType":"YulIf","src":"2836:117:2"},{"nodeType":"YulAssignment","src":"2967:73:2","value":{"arguments":[{"arguments":[{"name":"headStart","nodeType":"YulIdentifier","src":"3012:9:2"},{"name":"offset","nodeType":"YulIdentifier","src":"3023:6:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"3008:3:2"},"nodeType":"YulFunctionCall","src":"3008:22:2"},{"name":"dataEnd","nodeType":"YulIdentifier","src":"3032:7:2"}],"functionName":{"name":"abi_decode_t_string_memory_ptr","nodeType":"YulIdentifier","src":"2977:30:2"},"nodeType":"YulFunctionCall","src":"2977:63:2"},"variableNames":[{"name":"value0","nodeType":"YulIdentifier","src":"2967:6:2"}]}]}]},"name":"abi_decode_tuple_t_string_memory_ptr","nodeType":"YulFunctionDefinition","parameters":[{"name":"headStart","nodeType":"YulTypedName","src":"2594:9:2","type":""},{"name":"dataEnd","nodeType":"YulTypedName","src":"2605:7:2","type":""}],"returnVariables":[{"name":"value0","nodeType":"YulTypedName","src":"2617:6:2","type":""}],"src":"2548:509:2"},{"body":{"nodeType":"YulBlock","src":"3105:48:2","statements":[{"nodeType":"YulAssignment","src":"3115:32:2","value":{"arguments":[{"arguments":[{"name":"value","nodeType":"YulIdentifier","src":"3140:5:2"}],"functionName":{"name":"iszero","nodeType":"YulIdentifier","src":"3133:6:2"},"nodeType":"YulFunctionCall","src":"3133:13:2"}],"functionName":{"name":"iszero","nodeType":"YulIdentifier","src":"3126:6:2"},"nodeType":"YulFunctionCall","src":"3126:21:2"},"variableNames":[{"name":"cleaned","nodeType":"YulIdentifier","src":"3115:7:2"}]}]},"name":"cleanup_t_bool","nodeType":"YulFunctionDefinition","parameters":[{"name":"value","nodeType":"YulTypedName","src":"3087:5:2","type":""}],"returnVariables":[{"name":"cleaned","nodeType":"YulTypedName","src":"3097:7:2","type":""}],"src":"3063:90:2"},{"body":{"nodeType":"YulBlock","src":"3218:50:2","statements":[{"expression":{"arguments":[{"name":"pos","nodeType":"YulIdentifier","src":"3235:3:2"},{"arguments":[{"name":"value","nodeType":"YulIdentifier","src":"3255:5:2"}],"functionName":{"name":"cleanup_t_bool","nodeType":"YulIdentifier","src":"3240:14:2"},"nodeType":"YulFunctionCall","src":"3240:21:2"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"3228:6:2"},"nodeType":"YulFunctionCall","src":"3228:34:2"},"nodeType":"YulExpressionStatement","src":"3228:34:2"}]},"name":"abi_encode_t_bool_to_t_bool_fromStack","nodeType":"YulFunctionDefinition","parameters":[{"name":"value","nodeType":"YulTypedName","src":"3206:5:2","type":""},{"name":"pos","nodeType":"YulTypedName","src":"3213:3:2","type":""}],"src":"3159:109:2"},{"body":{"nodeType":"YulBlock","src":"3366:118:2","statements":[{"nodeType":"YulAssignment","src":"3376:26:2","value":{"arguments":[{"name":"headStart","nodeType":"YulIdentifier","src":"3388:9:2"},{"kind":"number","nodeType":"YulLiteral","src":"3399:2:2","type":"","value":"32"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"3384:3:2"},"nodeType":"YulFunctionCall","src":"3384:18:2"},"variableNames":[{"name":"tail","nodeType":"YulIdentifier","src":"3376:4:2"}]},{"expression":{"arguments":[{"name":"value0","nodeType":"YulIdentifier","src":"3450:6:2"},{"arguments":[{"name":"headStart","nodeType":"YulIdentifier","src":"3463:9:2"},{"kind":"number","nodeType":"YulLiteral","src":"3474:1:2","type":"","value":"0"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"3459:3:2"},"nodeType":"YulFunctionCall","src":"3459:17:2"}],"functionName":{"name":"abi_encode_t_bool_to_t_bool_fromStack","nodeType":"YulIdentifier","src":"3412:37:2"},"nodeType":"YulFunctionCall","src":"3412:65:2"},"nodeType":"YulExpressionStatement","src":"3412:65:2"}]},"name":"abi_encode_tuple_t_bool__to_t_bool__fromStack_reversed","nodeType":"YulFunctionDefinition","parameters":[{"name":"headStart","nodeType":"YulTypedName","src":"3338:9:2","type":""},{"name":"value0","nodeType":"YulTypedName","src":"3350:6:2","type":""}],"returnVariables":[{"name":"tail","nodeType":"YulTypedName","src":"3361:4:2","type":""}],"src":"3274:210:2"},{"body":{"nodeType":"YulBlock","src":"3549:40:2","statements":[{"nodeType":"YulAssignment","src":"3560:22:2","value":{"arguments":[{"name":"value","nodeType":"YulIdentifier","src":"3576:5:2"}],"functionName":{"name":"mload","nodeType":"YulIdentifier","src":"3570:5:2"},"nodeType":"YulFunctionCall","src":"3570:12:2"},"variableNames":[{"name":"length","nodeType":"YulIdentifier","src":"3560:6:2"}]}]},"name":"array_length_t_string_memory_ptr","nodeType":"YulFunctionDefinition","parameters":[{"name":"value","nodeType":"YulTypedName","src":"3532:5:2","type":""}],"returnVariables":[{"name":"length","nodeType":"YulTypedName","src":"3542:6:2","type":""}],"src":"3490:99:2"},{"body":{"nodeType":"YulBlock","src":"3709:34:2","statements":[{"nodeType":"YulAssignment","src":"3719:18:2","value":{"name":"pos","nodeType":"YulIdentifier","src":"3734:3:2"},"variableNames":[{"name":"updated_pos","nodeType":"YulIdentifier","src":"3719:11:2"}]}]},"name":"array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack","nodeType":"YulFunctionDefinition","parameters":[{"name":"pos","nodeType":"YulTypedName","src":"3681:3:2","type":""},{"name":"length","nodeType":"YulTypedName","src":"3686:6:2","type":""}],"returnVariables":[{"name":"updated_pos","nodeType":"YulTypedName","src":"3697:11:2","type":""}],"src":"3595:148:2"},{"body":{"nodeType":"YulBlock","src":"3798:258:2","statements":[{"nodeType":"YulVariableDeclaration","src":"3808:10:2","value":{"kind":"number","nodeType":"YulLiteral","src":"3817:1:2","type":"","value":"0"},"variables":[{"name":"i","nodeType":"YulTypedName","src":"3812:1:2","type":""}]},{"body":{"nodeType":"YulBlock","src":"3877:63:2","statements":[{"expression":{"arguments":[{"arguments":[{"name":"dst","nodeType":"YulIdentifier","src":"3902:3:2"},{"name":"i","nodeType":"YulIdentifier","src":"3907:1:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"3898:3:2"},"nodeType":"YulFunctionCall","src":"3898:11:2"},{"arguments":[{"arguments":[{"name":"src","nodeType":"YulIdentifier","src":"3921:3:2"},{"name":"i","nodeType":"YulIdentifier","src":"3926:1:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"3917:3:2"},"nodeType":"YulFunctionCall","src":"3917:11:2"}],"functionName":{"name":"mload","nodeType":"YulIdentifier","src":"3911:5:2"},"nodeType":"YulFunctionCall","src":"3911:18:2"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"3891:6:2"},"nodeType":"YulFunctionCall","src":"3891:39:2"},"nodeType":"YulExpressionStatement","src":"3891:39:2"}]},"condition":{"arguments":[{"name":"i","nodeType":"YulIdentifier","src":"3838:1:2"},{"name":"length","nodeType":"YulIdentifier","src":"3841:6:2"}],"functionName":{"name":"lt","nodeType":"YulIdentifier","src":"3835:2:2"},"nodeType":"YulFunctionCall","src":"3835:13:2"},"nodeType":"YulForLoop","post":{"nodeType":"YulBlock","src":"3849:19:2","statements":[{"nodeType":"YulAssignment","src":"3851:15:2","value":{"arguments":[{"name":"i","nodeType":"YulIdentifier","src":"3860:1:2"},{"kind":"number","nodeType":"YulLiteral","src":"3863:2:2","type":"","value":"32"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"3856:3:2"},"nodeType":"YulFunctionCall","src":"3856:10:2"},"variableNames":[{"name":"i","nodeType":"YulIdentifier","src":"3851:1:2"}]}]},"pre":{"nodeType":"YulBlock","src":"3831:3:2","statements":[]},"src":"3827:113:2"},{"body":{"nodeType":"YulBlock","src":"3974:76:2","statements":[{"expression":{"arguments":[{"arguments":[{"name":"dst","nodeType":"YulIdentifier","src":"4024:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"4029:6:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"4020:3:2"},"nodeType":"YulFunctionCall","src":"4020:16:2"},{"kind":"number","nodeType":"YulLiteral","src":"4038:1:2","type":"","value":"0"}],"functionName":{"name":"mstore","nodeType":"YulIdentifier","src":"4013:6:2"},"nodeType":"YulFunctionCall","src":"4013:27:2"},"nodeType":"YulExpressionStatement","src":"4013:27:2"}]},"condition":{"arguments":[{"name":"i","nodeType":"YulIdentifier","src":"3955:1:2"},{"name":"length","nodeType":"YulIdentifier","src":"3958:6:2"}],"functionName":{"name":"gt","nodeType":"YulIdentifier","src":"3952:2:2"},"nodeType":"YulFunctionCall","src":"3952:13:2"},"nodeType":"YulIf","src":"3949:101:2"}]},"name":"copy_memory_to_memory","nodeType":"YulFunctionDefinition","parameters":[{"name":"src","nodeType":"YulTypedName","src":"3780:3:2","type":""},{"name":"dst","nodeType":"YulTypedName","src":"3785:3:2","type":""},{"name":"length","nodeType":"YulTypedName","src":"3790:6:2","type":""}],"src":"3749:307:2"},{"body":{"nodeType":"YulBlock","src":"4172:267:2","statements":[{"nodeType":"YulVariableDeclaration","src":"4182:53:2","value":{"arguments":[{"name":"value","nodeType":"YulIdentifier","src":"4229:5:2"}],"functionName":{"name":"array_length_t_string_memory_ptr","nodeType":"YulIdentifier","src":"4196:32:2"},"nodeType":"YulFunctionCall","src":"4196:39:2"},"variables":[{"name":"length","nodeType":"YulTypedName","src":"4186:6:2","type":""}]},{"nodeType":"YulAssignment","src":"4244:96:2","value":{"arguments":[{"name":"pos","nodeType":"YulIdentifier","src":"4328:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"4333:6:2"}],"functionName":{"name":"array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack","nodeType":"YulIdentifier","src":"4251:76:2"},"nodeType":"YulFunctionCall","src":"4251:89:2"},"variableNames":[{"name":"pos","nodeType":"YulIdentifier","src":"4244:3:2"}]},{"expression":{"arguments":[{"arguments":[{"name":"value","nodeType":"YulIdentifier","src":"4375:5:2"},{"kind":"number","nodeType":"YulLiteral","src":"4382:4:2","type":"","value":"0x20"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"4371:3:2"},"nodeType":"YulFunctionCall","src":"4371:16:2"},{"name":"pos","nodeType":"YulIdentifier","src":"4389:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"4394:6:2"}],"functionName":{"name":"copy_memory_to_memory","nodeType":"YulIdentifier","src":"4349:21:2"},"nodeType":"YulFunctionCall","src":"4349:52:2"},"nodeType":"YulExpressionStatement","src":"4349:52:2"},{"nodeType":"YulAssignment","src":"4410:23:2","value":{"arguments":[{"name":"pos","nodeType":"YulIdentifier","src":"4421:3:2"},{"name":"length","nodeType":"YulIdentifier","src":"4426:6:2"}],"functionName":{"name":"add","nodeType":"YulIdentifier","src":"4417:3:2"},"nodeType":"YulFunctionCall","src":"4417:16:2"},"variableNames":[{"name":"end","nodeType":"YulIdentifier","src":"4410:3:2"}]}]},"name":"abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack","nodeType":"YulFunctionDefinition","parameters":[{"name":"value","nodeType":"YulTypedName","src":"4153:5:2","type":""},{"name":"pos","nodeType":"YulTypedName","src":"4160:3:2","type":""}],"returnVariables":[{"name":"end","nodeType":"YulTypedName","src":"4168:3:2","type":""}],"src":"4062:377:2"},{"body":{"nodeType":"YulBlock","src":"4581:139:2","statements":[{"nodeType":"YulAssignment","src":"4592:102:2","value":{"arguments":[{"name":"value0","nodeType":"YulIdentifier","src":"4681:6:2"},{"name":"pos","nodeType":"YulIdentifier","src":"4690:3:2"}],"functionName":{"name":"abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack","nodeType":"YulIdentifier","src":"4599:81:2"},"nodeType":"YulFunctionCall","src":"4599:95:2"},"variableNames":[{"name":"pos","nodeType":"YulIdentifier","src":"4592:3:2"}]},{"nodeType":"YulAssignment","src":"4704:10:2","value":{"name":"pos","nodeType":"YulIdentifier","src":"4711:3:2"},"variableNames":[{"name":"end","nodeType":"YulIdentifier","src":"4704:3:2"}]}]},"name":"abi_encode_tuple_packed_t_string_memory_ptr__to_t_string_memory_ptr__nonPadded_inplace_fromStack_reversed","nodeType":"YulFunctionDefinition","parameters":[{"name":"pos","nodeType":"YulTypedName","src":"4560:3:2","type":""},{"name":"value0","nodeType":"YulTypedName","src":"4566:6:2","type":""}],"returnVariables":[{"name":"end","nodeType":"YulTypedName","src":"4577:3:2","type":""}],"src":"4445:275:2"}]},"contents":"{\\n\\n    function allocate_unbounded() -> memPtr {\\n        memPtr := mload(64)\\n    }\\n\\n    function revert_error_dbdddcbe895c83990c08b3492a0e83918d802a52331272ac6fdb6a7c4aea3b1b() {\\n        revert(0, 0)\\n    }\\n\\n    function revert_error_c1322bf8034eace5e0b5c7295db60986aa89aae5e0ea0873e4689e076861a5db() {\\n        revert(0, 0)\\n    }\\n\\n    function revert_error_1b9f4a0a5773e33b91aa01db23bf8c55fce1411167c872835e7fa00a4f17d46d() {\\n        revert(0, 0)\\n    }\\n\\n    function revert_error_987264b3b1d58a9c7f8255e93e81c77d86d6299019c33110a076957a3e06e2ae() {\\n        revert(0, 0)\\n    }\\n\\n    function round_up_to_mul_of_32(value) -> result {\\n        result := and(add(value, 31), not(31))\\n    }\\n\\n    function panic_error_0x41() {\\n        mstore(0, 35408467139433450592217433187231851964531694900788300625387963629091585785856)\\n        mstore(4, 0x41)\\n        revert(0, 0x24)\\n    }\\n\\n    function finalize_allocation(memPtr, size) {\\n        let newFreePtr := add(memPtr, round_up_to_mul_of_32(size))\\n        // protect against overflow\\n        if or(gt(newFreePtr, 0xffffffffffffffff), lt(newFreePtr, memPtr)) { panic_error_0x41() }\\n        mstore(64, newFreePtr)\\n    }\\n\\n    function allocate_memory(size) -> memPtr {\\n        memPtr := allocate_unbounded()\\n        finalize_allocation(memPtr, size)\\n    }\\n\\n    function array_allocation_size_t_string_memory_ptr(length) -> size {\\n        // Make sure we can allocate memory without overflow\\n        if gt(length, 0xffffffffffffffff) { panic_error_0x41() }\\n\\n        size := round_up_to_mul_of_32(length)\\n\\n        // add length slot\\n        size := add(size, 0x20)\\n\\n    }\\n\\n    function copy_calldata_to_memory(src, dst, length) {\\n        calldatacopy(dst, src, length)\\n        // clear end\\n        mstore(add(dst, length), 0)\\n    }\\n\\n    function abi_decode_available_length_t_string_memory_ptr(src, length, end) -> array {\\n        array := allocate_memory(array_allocation_size_t_string_memory_ptr(length))\\n        mstore(array, length)\\n        let dst := add(array, 0x20)\\n        if gt(add(src, length), end) { revert_error_987264b3b1d58a9c7f8255e93e81c77d86d6299019c33110a076957a3e06e2ae() }\\n        copy_calldata_to_memory(src, dst, length)\\n    }\\n\\n    // string\\n    function abi_decode_t_string_memory_ptr(offset, end) -> array {\\n        if iszero(slt(add(offset, 0x1f), end)) { revert_error_1b9f4a0a5773e33b91aa01db23bf8c55fce1411167c872835e7fa00a4f17d46d() }\\n        let length := calldataload(offset)\\n        array := abi_decode_available_length_t_string_memory_ptr(add(offset, 0x20), length, end)\\n    }\\n\\n    function abi_decode_tuple_t_string_memory_ptr(headStart, dataEnd) -> value0 {\\n        if slt(sub(dataEnd, headStart), 32) { revert_error_dbdddcbe895c83990c08b3492a0e83918d802a52331272ac6fdb6a7c4aea3b1b() }\\n\\n        {\\n\\n            let offset := calldataload(add(headStart, 0))\\n            if gt(offset, 0xffffffffffffffff) { revert_error_c1322bf8034eace5e0b5c7295db60986aa89aae5e0ea0873e4689e076861a5db() }\\n\\n            value0 := abi_decode_t_string_memory_ptr(add(headStart, offset), dataEnd)\\n        }\\n\\n    }\\n\\n    function cleanup_t_bool(value) -> cleaned {\\n        cleaned := iszero(iszero(value))\\n    }\\n\\n    function abi_encode_t_bool_to_t_bool_fromStack(value, pos) {\\n        mstore(pos, cleanup_t_bool(value))\\n    }\\n\\n    function abi_encode_tuple_t_bool__to_t_bool__fromStack_reversed(headStart , value0) -> tail {\\n        tail := add(headStart, 32)\\n\\n        abi_encode_t_bool_to_t_bool_fromStack(value0,  add(headStart, 0))\\n\\n    }\\n\\n    function array_length_t_string_memory_ptr(value) -> length {\\n\\n        length := mload(value)\\n\\n    }\\n\\n    function array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack(pos, length) -> updated_pos {\\n        updated_pos := pos\\n    }\\n\\n    function copy_memory_to_memory(src, dst, length) {\\n        let i := 0\\n        for { } lt(i, length) { i := add(i, 32) }\\n        {\\n            mstore(add(dst, i), mload(add(src, i)))\\n        }\\n        if gt(i, length)\\n        {\\n            // clear end\\n            mstore(add(dst, length), 0)\\n        }\\n    }\\n\\n    function abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack(value, pos) -> end {\\n        let length := array_length_t_string_memory_ptr(value)\\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack(pos, length)\\n        copy_memory_to_memory(add(value, 0x20), pos, length)\\n        end := add(pos, length)\\n    }\\n\\n    function abi_encode_tuple_packed_t_string_memory_ptr__to_t_string_memory_ptr__nonPadded_inplace_fromStack_reversed(pos , value0) -> end {\\n\\n        pos := abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack(value0,  pos)\\n\\n        end := pos\\n    }\\n\\n}\\n","id":2,"language":"Yul","name":"#utility.yul"}],"sourceMap":"66:429:1:-:0;;;;;;;;;;;;;;;;;;;","deployedSourceMap":"66:429:1:-:0;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;230:116;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;350:142;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;230:116;283:4;316:7;299:25;;;;;;:::i;:::-;;;;;;;;304:10;299:25;;;;;;;;;;;;337:4;330:11;;230:116;;;:::o;350:142::-;415:4;453:16;431:39;;;;;;:::i;:::-;;;;;;;;441:10;431:39;;;;;;;;;;;;483:4;476:11;;350:142;;;:::o;7:75:2:-;40:6;73:2;67:9;57:19;;7:75;:::o;88:117::-;197:1;194;187:12;211:117;320:1;317;310:12;334:117;443:1;440;433:12;457:117;566:1;563;556:12;580:102;621:6;672:2;668:7;663:2;656:5;652:14;648:28;638:38;;580:102;;;:::o;688:180::-;736:77;733:1;726:88;833:4;830:1;823:15;857:4;854:1;847:15;874:281;957:27;979:4;957:27;:::i;:::-;949:6;945:40;1087:6;1075:10;1072:22;1051:18;1039:10;1036:34;1033:62;1030:88;;;1098:18;;:::i;:::-;1030:88;1138:10;1134:2;1127:22;917:238;874:281;;:::o;1161:129::-;1195:6;1222:20;;:::i;:::-;1212:30;;1251:33;1279:4;1271:6;1251:33;:::i;:::-;1161:129;;;:::o;1296:308::-;1358:4;1448:18;1440:6;1437:30;1434:56;;;1470:18;;:::i;:::-;1434:56;1508:29;1530:6;1508:29;:::i;:::-;1500:37;;1592:4;1586;1582:15;1574:23;;1296:308;;;:::o;1610:154::-;1694:6;1689:3;1684;1671:30;1756:1;1747:6;1742:3;1738:16;1731:27;1610:154;;;:::o;1770:412::-;1848:5;1873:66;1889:49;1931:6;1889:49;:::i;:::-;1873:66;:::i;:::-;1864:75;;1962:6;1955:5;1948:21;2000:4;1993:5;1989:16;2038:3;2029:6;2024:3;2020:16;2017:25;2014:112;;;2045:79;;:::i;:::-;2014:112;2135:41;2169:6;2164:3;2159;2135:41;:::i;:::-;1854:328;1770:412;;;;;:::o;2202:340::-;2258:5;2307:3;2300:4;2292:6;2288:17;2284:27;2274:122;;2315:79;;:::i;:::-;2274:122;2432:6;2419:20;2457:79;2532:3;2524:6;2517:4;2509:6;2505:17;2457:79;:::i;:::-;2448:88;;2264:278;2202:340;;;;:::o;2548:509::-;2617:6;2666:2;2654:9;2645:7;2641:23;2637:32;2634:119;;;2672:79;;:::i;:::-;2634:119;2820:1;2809:9;2805:17;2792:31;2850:18;2842:6;2839:30;2836:117;;;2872:79;;:::i;:::-;2836:117;2977:63;3032:7;3023:6;3012:9;3008:22;2977:63;:::i;:::-;2967:73;;2763:287;2548:509;;;;:::o;3063:90::-;3097:7;3140:5;3133:13;3126:21;3115:32;;3063:90;;;:::o;3159:109::-;3240:21;3255:5;3240:21;:::i;:::-;3235:3;3228:34;3159:109;;:::o;3274:210::-;3361:4;3399:2;3388:9;3384:18;3376:26;;3412:65;3474:1;3463:9;3459:17;3450:6;3412:65;:::i;:::-;3274:210;;;;:::o;3490:99::-;3542:6;3576:5;3570:12;3560:22;;3490:99;;;:::o;3595:148::-;3697:11;3734:3;3719:18;;3595:148;;;;:::o;3749:307::-;3817:1;3827:113;3841:6;3838:1;3835:13;3827:113;;;3926:1;3921:3;3917:11;3911:18;3907:1;3902:3;3898:11;3891:39;3863:2;3860:1;3856:10;3851:15;;3827:113;;;3958:6;3955:1;3952:13;3949:101;;;4038:1;4029:6;4024:3;4020:16;4013:27;3949:101;3798:258;3749:307;;;:::o;4062:377::-;4168:3;4196:39;4229:5;4196:39;:::i;:::-;4251:89;4333:6;4328:3;4251:89;:::i;:::-;4244:96;;4349:52;4394:6;4389:3;4382:4;4375:5;4371:16;4349:52;:::i;:::-;4426:6;4421:3;4417:16;4410:23;;4172:267;4062:377;;;;:::o;4445:275::-;4577:3;4599:95;4690:3;4681:6;4599:95;:::i;:::-;4592:102;;4711:3;4704:10;;4445:275;;;;:::o","source":"// SPDX-License-Identifier: MIT\\npragma solidity >=0.4.22 <0.9.0;\\n\\ncontract PieMessage {\\n\\n  event Sent(address indexed sender, string indexed payload);\\n  event Confirmed(address indexed sender, string indexed transaction_hash);\\n\\n  function send(string memory payload) public returns (bool){\\n    emit Sent(msg.sender, payload);\\n    return true;\\n  }\\n\\n  function confirm(string memory transaction_hash) public returns (bool){\\n    emit Confirmed(msg.sender, transaction_hash);\\n    return true;\\n  }\\n\\n}","sourcePath":"/Volumes/Basement/Sites/sites/piesocket/piemessage-contract/contracts/PieMessage.sol","ast":{"absolutePath":"project:/contracts/PieMessage.sol","exportedSymbols":{"PieMessage":[79]},"id":80,"license":"MIT","nodeType":"SourceUnit","nodes":[{"id":34,"literals":["solidity",">=","0.4",".22","<","0.9",".0"],"nodeType":"PragmaDirective","src":"32:32:1"},{"abstract":false,"baseContracts":[],"canonicalName":"PieMessage","contractDependencies":[],"contractKind":"contract","fullyImplemented":true,"id":79,"linearizedBaseContracts":[79],"name":"PieMessage","nameLocation":"75:10:1","nodeType":"ContractDefinition","nodes":[{"anonymous":false,"id":40,"name":"Sent","nameLocation":"97:4:1","nodeType":"EventDefinition","parameters":{"id":39,"nodeType":"ParameterList","parameters":[{"constant":false,"id":36,"indexed":true,"mutability":"mutable","name":"sender","nameLocation":"118:6:1","nodeType":"VariableDeclaration","scope":40,"src":"102:22:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"},"typeName":{"id":35,"name":"address","nodeType":"ElementaryTypeName","src":"102:7:1","stateMutability":"nonpayable","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},"visibility":"internal"},{"constant":false,"id":38,"indexed":true,"mutability":"mutable","name":"payload","nameLocation":"141:7:1","nodeType":"VariableDeclaration","scope":40,"src":"126:22:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":37,"name":"string","nodeType":"ElementaryTypeName","src":"126:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"101:48:1"},"src":"91:59:1"},{"anonymous":false,"id":46,"name":"Confirmed","nameLocation":"159:9:1","nodeType":"EventDefinition","parameters":{"id":45,"nodeType":"ParameterList","parameters":[{"constant":false,"id":42,"indexed":true,"mutability":"mutable","name":"sender","nameLocation":"185:6:1","nodeType":"VariableDeclaration","scope":46,"src":"169:22:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"},"typeName":{"id":41,"name":"address","nodeType":"ElementaryTypeName","src":"169:7:1","stateMutability":"nonpayable","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},"visibility":"internal"},{"constant":false,"id":44,"indexed":true,"mutability":"mutable","name":"transaction_hash","nameLocation":"208:16:1","nodeType":"VariableDeclaration","scope":46,"src":"193:31:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":43,"name":"string","nodeType":"ElementaryTypeName","src":"193:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"168:57:1"},"src":"153:73:1"},{"body":{"id":61,"nodeType":"Block","src":"288:58:1","statements":[{"eventCall":{"arguments":[{"expression":{"id":54,"name":"msg","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":4294967281,"src":"304:3:1","typeDescriptions":{"typeIdentifier":"t_magic_message","typeString":"msg"}},"id":55,"isConstant":false,"isLValue":false,"isPure":false,"lValueRequested":false,"memberName":"sender","nodeType":"MemberAccess","src":"304:10:1","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},{"id":56,"name":"payload","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":48,"src":"316:7:1","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}}],"expression":{"argumentTypes":[{"typeIdentifier":"t_address","typeString":"address"},{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}],"id":53,"name":"Sent","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":40,"src":"299:4:1","typeDescriptions":{"typeIdentifier":"t_function_event_nonpayable$_t_address_$_t_string_memory_ptr_$returns$__$","typeString":"function (address,string memory)"}},"id":57,"isConstant":false,"isLValue":false,"isPure":false,"kind":"functionCall","lValueRequested":false,"names":[],"nodeType":"FunctionCall","src":"299:25:1","tryCall":false,"typeDescriptions":{"typeIdentifier":"t_tuple$__$","typeString":"tuple()"}},"id":58,"nodeType":"EmitStatement","src":"294:30:1"},{"expression":{"hexValue":"74727565","id":59,"isConstant":false,"isLValue":false,"isPure":true,"kind":"bool","lValueRequested":false,"nodeType":"Literal","src":"337:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"value":"true"},"functionReturnParameters":52,"id":60,"nodeType":"Return","src":"330:11:1"}]},"functionSelector":"66792ba1","id":62,"implemented":true,"kind":"function","modifiers":[],"name":"send","nameLocation":"239:4:1","nodeType":"FunctionDefinition","parameters":{"id":49,"nodeType":"ParameterList","parameters":[{"constant":false,"id":48,"mutability":"mutable","name":"payload","nameLocation":"258:7:1","nodeType":"VariableDeclaration","scope":62,"src":"244:21:1","stateVariable":false,"storageLocation":"memory","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":47,"name":"string","nodeType":"ElementaryTypeName","src":"244:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"243:23:1"},"returnParameters":{"id":52,"nodeType":"ParameterList","parameters":[{"constant":false,"id":51,"mutability":"mutable","name":"","nameLocation":"-1:-1:-1","nodeType":"VariableDeclaration","scope":62,"src":"283:4:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"typeName":{"id":50,"name":"bool","nodeType":"ElementaryTypeName","src":"283:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"}},"visibility":"internal"}],"src":"282:6:1"},"scope":79,"src":"230:116:1","stateMutability":"nonpayable","virtual":false,"visibility":"public"},{"body":{"id":77,"nodeType":"Block","src":"420:72:1","statements":[{"eventCall":{"arguments":[{"expression":{"id":70,"name":"msg","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":4294967281,"src":"441:3:1","typeDescriptions":{"typeIdentifier":"t_magic_message","typeString":"msg"}},"id":71,"isConstant":false,"isLValue":false,"isPure":false,"lValueRequested":false,"memberName":"sender","nodeType":"MemberAccess","src":"441:10:1","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},{"id":72,"name":"transaction_hash","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":64,"src":"453:16:1","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}}],"expression":{"argumentTypes":[{"typeIdentifier":"t_address","typeString":"address"},{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}],"id":69,"name":"Confirmed","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":46,"src":"431:9:1","typeDescriptions":{"typeIdentifier":"t_function_event_nonpayable$_t_address_$_t_string_memory_ptr_$returns$__$","typeString":"function (address,string memory)"}},"id":73,"isConstant":false,"isLValue":false,"isPure":false,"kind":"functionCall","lValueRequested":false,"names":[],"nodeType":"FunctionCall","src":"431:39:1","tryCall":false,"typeDescriptions":{"typeIdentifier":"t_tuple$__$","typeString":"tuple()"}},"id":74,"nodeType":"EmitStatement","src":"426:44:1"},{"expression":{"hexValue":"74727565","id":75,"isConstant":false,"isLValue":false,"isPure":true,"kind":"bool","lValueRequested":false,"nodeType":"Literal","src":"483:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"value":"true"},"functionReturnParameters":68,"id":76,"nodeType":"Return","src":"476:11:1"}]},"functionSelector":"c7ab74a4","id":78,"implemented":true,"kind":"function","modifiers":[],"name":"confirm","nameLocation":"359:7:1","nodeType":"FunctionDefinition","parameters":{"id":65,"nodeType":"ParameterList","parameters":[{"constant":false,"id":64,"mutability":"mutable","name":"transaction_hash","nameLocation":"381:16:1","nodeType":"VariableDeclaration","scope":78,"src":"367:30:1","stateVariable":false,"storageLocation":"memory","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":63,"name":"string","nodeType":"ElementaryTypeName","src":"367:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"366:32:1"},"returnParameters":{"id":68,"nodeType":"ParameterList","parameters":[{"constant":false,"id":67,"mutability":"mutable","name":"","nameLocation":"-1:-1:-1","nodeType":"VariableDeclaration","scope":78,"src":"415:4:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"typeName":{"id":66,"name":"bool","nodeType":"ElementaryTypeName","src":"415:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"}},"visibility":"internal"}],"src":"414:6:1"},"scope":79,"src":"350:142:1","stateMutability":"nonpayable","virtual":false,"visibility":"public"}],"scope":80,"src":"66:429:1","usedErrors":[]}],"src":"32:463:1"},"legacyAST":{"absolutePath":"project:/contracts/PieMessage.sol","exportedSymbols":{"PieMessage":[79]},"id":80,"license":"MIT","nodeType":"SourceUnit","nodes":[{"id":34,"literals":["solidity",">=","0.4",".22","<","0.9",".0"],"nodeType":"PragmaDirective","src":"32:32:1"},{"abstract":false,"baseContracts":[],"canonicalName":"PieMessage","contractDependencies":[],"contractKind":"contract","fullyImplemented":true,"id":79,"linearizedBaseContracts":[79],"name":"PieMessage","nameLocation":"75:10:1","nodeType":"ContractDefinition","nodes":[{"anonymous":false,"id":40,"name":"Sent","nameLocation":"97:4:1","nodeType":"EventDefinition","parameters":{"id":39,"nodeType":"ParameterList","parameters":[{"constant":false,"id":36,"indexed":true,"mutability":"mutable","name":"sender","nameLocation":"118:6:1","nodeType":"VariableDeclaration","scope":40,"src":"102:22:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"},"typeName":{"id":35,"name":"address","nodeType":"ElementaryTypeName","src":"102:7:1","stateMutability":"nonpayable","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},"visibility":"internal"},{"constant":false,"id":38,"indexed":true,"mutability":"mutable","name":"payload","nameLocation":"141:7:1","nodeType":"VariableDeclaration","scope":40,"src":"126:22:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":37,"name":"string","nodeType":"ElementaryTypeName","src":"126:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"101:48:1"},"src":"91:59:1"},{"anonymous":false,"id":46,"name":"Confirmed","nameLocation":"159:9:1","nodeType":"EventDefinition","parameters":{"id":45,"nodeType":"ParameterList","parameters":[{"constant":false,"id":42,"indexed":true,"mutability":"mutable","name":"sender","nameLocation":"185:6:1","nodeType":"VariableDeclaration","scope":46,"src":"169:22:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"},"typeName":{"id":41,"name":"address","nodeType":"ElementaryTypeName","src":"169:7:1","stateMutability":"nonpayable","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},"visibility":"internal"},{"constant":false,"id":44,"indexed":true,"mutability":"mutable","name":"transaction_hash","nameLocation":"208:16:1","nodeType":"VariableDeclaration","scope":46,"src":"193:31:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":43,"name":"string","nodeType":"ElementaryTypeName","src":"193:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"168:57:1"},"src":"153:73:1"},{"body":{"id":61,"nodeType":"Block","src":"288:58:1","statements":[{"eventCall":{"arguments":[{"expression":{"id":54,"name":"msg","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":4294967281,"src":"304:3:1","typeDescriptions":{"typeIdentifier":"t_magic_message","typeString":"msg"}},"id":55,"isConstant":false,"isLValue":false,"isPure":false,"lValueRequested":false,"memberName":"sender","nodeType":"MemberAccess","src":"304:10:1","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},{"id":56,"name":"payload","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":48,"src":"316:7:1","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}}],"expression":{"argumentTypes":[{"typeIdentifier":"t_address","typeString":"address"},{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}],"id":53,"name":"Sent","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":40,"src":"299:4:1","typeDescriptions":{"typeIdentifier":"t_function_event_nonpayable$_t_address_$_t_string_memory_ptr_$returns$__$","typeString":"function (address,string memory)"}},"id":57,"isConstant":false,"isLValue":false,"isPure":false,"kind":"functionCall","lValueRequested":false,"names":[],"nodeType":"FunctionCall","src":"299:25:1","tryCall":false,"typeDescriptions":{"typeIdentifier":"t_tuple$__$","typeString":"tuple()"}},"id":58,"nodeType":"EmitStatement","src":"294:30:1"},{"expression":{"hexValue":"74727565","id":59,"isConstant":false,"isLValue":false,"isPure":true,"kind":"bool","lValueRequested":false,"nodeType":"Literal","src":"337:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"value":"true"},"functionReturnParameters":52,"id":60,"nodeType":"Return","src":"330:11:1"}]},"functionSelector":"66792ba1","id":62,"implemented":true,"kind":"function","modifiers":[],"name":"send","nameLocation":"239:4:1","nodeType":"FunctionDefinition","parameters":{"id":49,"nodeType":"ParameterList","parameters":[{"constant":false,"id":48,"mutability":"mutable","name":"payload","nameLocation":"258:7:1","nodeType":"VariableDeclaration","scope":62,"src":"244:21:1","stateVariable":false,"storageLocation":"memory","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":47,"name":"string","nodeType":"ElementaryTypeName","src":"244:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"243:23:1"},"returnParameters":{"id":52,"nodeType":"ParameterList","parameters":[{"constant":false,"id":51,"mutability":"mutable","name":"","nameLocation":"-1:-1:-1","nodeType":"VariableDeclaration","scope":62,"src":"283:4:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"typeName":{"id":50,"name":"bool","nodeType":"ElementaryTypeName","src":"283:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"}},"visibility":"internal"}],"src":"282:6:1"},"scope":79,"src":"230:116:1","stateMutability":"nonpayable","virtual":false,"visibility":"public"},{"body":{"id":77,"nodeType":"Block","src":"420:72:1","statements":[{"eventCall":{"arguments":[{"expression":{"id":70,"name":"msg","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":4294967281,"src":"441:3:1","typeDescriptions":{"typeIdentifier":"t_magic_message","typeString":"msg"}},"id":71,"isConstant":false,"isLValue":false,"isPure":false,"lValueRequested":false,"memberName":"sender","nodeType":"MemberAccess","src":"441:10:1","typeDescriptions":{"typeIdentifier":"t_address","typeString":"address"}},{"id":72,"name":"transaction_hash","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":64,"src":"453:16:1","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}}],"expression":{"argumentTypes":[{"typeIdentifier":"t_address","typeString":"address"},{"typeIdentifier":"t_string_memory_ptr","typeString":"string memory"}],"id":69,"name":"Confirmed","nodeType":"Identifier","overloadedDeclarations":[],"referencedDeclaration":46,"src":"431:9:1","typeDescriptions":{"typeIdentifier":"t_function_event_nonpayable$_t_address_$_t_string_memory_ptr_$returns$__$","typeString":"function (address,string memory)"}},"id":73,"isConstant":false,"isLValue":false,"isPure":false,"kind":"functionCall","lValueRequested":false,"names":[],"nodeType":"FunctionCall","src":"431:39:1","tryCall":false,"typeDescriptions":{"typeIdentifier":"t_tuple$__$","typeString":"tuple()"}},"id":74,"nodeType":"EmitStatement","src":"426:44:1"},{"expression":{"hexValue":"74727565","id":75,"isConstant":false,"isLValue":false,"isPure":true,"kind":"bool","lValueRequested":false,"nodeType":"Literal","src":"483:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"value":"true"},"functionReturnParameters":68,"id":76,"nodeType":"Return","src":"476:11:1"}]},"functionSelector":"c7ab74a4","id":78,"implemented":true,"kind":"function","modifiers":[],"name":"confirm","nameLocation":"359:7:1","nodeType":"FunctionDefinition","parameters":{"id":65,"nodeType":"ParameterList","parameters":[{"constant":false,"id":64,"mutability":"mutable","name":"transaction_hash","nameLocation":"381:16:1","nodeType":"VariableDeclaration","scope":78,"src":"367:30:1","stateVariable":false,"storageLocation":"memory","typeDescriptions":{"typeIdentifier":"t_string_memory_ptr","typeString":"string"},"typeName":{"id":63,"name":"string","nodeType":"ElementaryTypeName","src":"367:6:1","typeDescriptions":{"typeIdentifier":"t_string_storage_ptr","typeString":"string"}},"visibility":"internal"}],"src":"366:32:1"},"returnParameters":{"id":68,"nodeType":"ParameterList","parameters":[{"constant":false,"id":67,"mutability":"mutable","name":"","nameLocation":"-1:-1:-1","nodeType":"VariableDeclaration","scope":78,"src":"415:4:1","stateVariable":false,"storageLocation":"default","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"},"typeName":{"id":66,"name":"bool","nodeType":"ElementaryTypeName","src":"415:4:1","typeDescriptions":{"typeIdentifier":"t_bool","typeString":"bool"}},"visibility":"internal"}],"src":"414:6:1"},"scope":79,"src":"350:142:1","stateMutability":"nonpayable","virtual":false,"visibility":"public"}],"scope":80,"src":"66:429:1","usedErrors":[]}],"src":"32:463:1"},"compiler":{"name":"solc","version":"0.8.9+commit.e5eed63a.Emscripten.clang"},"networks":{},"schemaVersion":"3.4.3","updatedAt":"2021-11-01T14:41:30.160Z","devdoc":{"kind":"dev","methods":{},"version":1},"userdoc":{"kind":"user","methods":{},"version":1}}');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module used 'module' so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	PieSocket = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGllc29ja2V0LmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBMkM7QUFDM0M7QUFDQTs7QUFFZTs7QUFFZjtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLDRDQUE0QywrQkFBK0I7QUFDM0U7O0FBRUEsc0NBQXNDLGlEQUFjO0FBQ3BEOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLCtEQUErRCxvQkFBb0I7QUFDbkY7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBLEdBQUc7QUFDSDs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBLHdFQUF3RSxvQkFBb0I7QUFDNUY7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ04sS0FBSztBQUNMO0FBQ0E7QUFDQSxLQUFLOztBQUVMLEtBQUs7QUFDTDtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5Q0FBeUMsZ0NBQWdDO0FBQ3pFO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTs7QUFFSjtBQUNBO0FBQ0E7QUFDQSxJQUFJOztBQUVKO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7OztBQzVIaUM7QUFDSzs7QUFFdkI7O0FBRWY7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMEJBQTBCLGtEQUFNO0FBQ2hDOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDs7O0FBR0E7QUFDQTtBQUNBLGtDQUFrQyxtREFBVTtBQUM1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBcUI7QUFDckI7QUFDQSw2REFBNkQsd0NBQXdDLDJFQUEyRTtBQUNoTCxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7O0FBRUE7QUFDQTtBQUNBLGtDQUFrQyxtREFBVTtBQUM1Qzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQjtBQUNBLDZEQUE2RCxtREFBbUQsaURBQWlEO0FBQ2pLLGFBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBOzs7Ozs7Ozs7Ozs7Ozs7QUNoTGU7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7QUNMZTs7QUFFZjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUN4Qm1DO0FBQ0Y7QUFDRztBQUN5Qjs7QUFFN0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CO0FBQ25CO0FBQ0E7QUFDQTs7QUFFZTs7QUFFZjtBQUNBOztBQUVBLHdCQUF3QjtBQUN4QjtBQUNBLDBCQUEwQixrREFBTTtBQUNoQzs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBCQUEwQixtREFBTzs7QUFFakM7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2IsU0FBUzs7QUFFVDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBcUI7QUFDckIsbUNBQW1DLGdFQUFvQjtBQUN2RDtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0EsMkJBQTJCLGdFQUFvQjtBQUMvQyxhQUFhOztBQUViOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ0EsU0FBUztBQUNUOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSxnQ0FBZ0MsdUJBQXVCLGtCQUFrQixxQkFBcUIsR0FBRyxVQUFVLFdBQVcsb0JBQW9CLGVBQWUsd0JBQXdCLGtCQUFrQixrREFBYSxDQUFDLFlBQVksc0JBQXNCOztBQUVuUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7QUNoSUEsd0ZBQStDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1VDQS9DO1VBQ0E7O1VBRUE7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7O1VBRUE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7Ozs7O1dDdEJBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EseUNBQXlDLHdDQUF3QztXQUNqRjtXQUNBO1dBQ0E7Ozs7O1dDUEE7Ozs7O1dDQUE7V0FDQTtXQUNBO1dBQ0EsdURBQXVELGlCQUFpQjtXQUN4RTtXQUNBLGdEQUFnRCxhQUFhO1dBQzdEOzs7OztVRU5BO1VBQ0E7VUFDQTtVQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vUGllU29ja2V0Ly4vc3JjL0Jsb2NrY2hhaW4uanMiLCJ3ZWJwYWNrOi8vUGllU29ja2V0Ly4vc3JjL0NoYW5uZWwuanMiLCJ3ZWJwYWNrOi8vUGllU29ja2V0Ly4vc3JjL0ludmFsaWRBdXRoRXhjZXB0aW9uLmpzIiwid2VicGFjazovL1BpZVNvY2tldC8uL3NyYy9Mb2dnZXIuanMiLCJ3ZWJwYWNrOi8vUGllU29ja2V0Ly4vc3JjL1BpZVNvY2tldC5qcyIsIndlYnBhY2s6Ly9QaWVTb2NrZXQvLi9zcmMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vUGllU29ja2V0L3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL1BpZVNvY2tldC93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vUGllU29ja2V0L3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vUGllU29ja2V0L3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vUGllU29ja2V0L3dlYnBhY2svYmVmb3JlLXN0YXJ0dXAiLCJ3ZWJwYWNrOi8vUGllU29ja2V0L3dlYnBhY2svc3RhcnR1cCIsIndlYnBhY2s6Ly9QaWVTb2NrZXQvd2VicGFjay9hZnRlci1zdGFydHVwIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQaWVNZXNzYWdlIGZyb20gJy4vUGllTWVzc2FnZS5qc29uJztcbmNvbnN0IEJDTUVuZHBvaW50ID0gJ2h0dHBzOi8vd3d3LnBpZXNvY2tldC5jb20vYXBpL2Jsb2NrY2hhaW4vcGF5bG9hZEhhc2gnO1xuY29uc3QgUGllTWVzc2FnZUFkZHJlc3MgPSAnMHgyMzIxYzMyMTgyODk0NjE1M2E4NDVlNjllZTE2OGY0MTNlODVjOTBkJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQmxvY2tjaGFpbiB7XG5cblx0Y29uc3RydWN0b3IoYXBpS2V5LCBjaGFubmVsKSB7XG5cdFx0dGhpcy5hcGlLZXkgPSBhcGlLZXk7XG5cdFx0dGhpcy5jaGFubmVsID0gY2hhbm5lbDtcblxuXHR9XG5cblx0YXN5bmMgaW5pdCgpIHtcblx0XHRjb25zdCB3MyA9IG5ldyBXZWIzKHdpbmRvdy5ldGhlcmV1bSk7XG5cdFx0Y29uc3QgYWNjb3VudHMgPSBhd2FpdCBldGhlcmV1bS5yZXF1ZXN0KHsgbWV0aG9kOiAnZXRoX3JlcXVlc3RBY2NvdW50cycgfSk7XG5cdFx0dGhpcy5hY2NvdW50ID0gYWNjb3VudHNbMF07XG5cblx0XHR0aGlzLmNvbnRyYWN0ID0gbmV3IHczLmV0aC5Db250cmFjdChQaWVNZXNzYWdlLmFiaSwgUGllTWVzc2FnZUFkZHJlc3MpO1xuXHR9XG5cblx0Y2hlY2tXZWIzKCkge1xuXHRcdGlmICh0eXBlb2YgV2ViMyA9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y29uc29sZS5lcnJvcignV2ViLmpzIGlzIG5vdCBpbnN0YWxsZWQhJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB3aW5kb3cuZXRoZXJldW0gPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ01ldGFNYXNrIGlzIG5vdCBpbnN0YWxsZWQhJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRhc3luYyBjb25maXJtKGhhc2gpIHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cdFx0XHRpZiAodGhpcy5jaGVja1dlYjMoKSkge1xuXHRcdFx0XHRpZiAoIXRoaXMuY29udHJhY3QpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmluaXQoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJlY2VpcHQgPSB0aGlzLmNvbnRyYWN0Lm1ldGhvZHMuY29uZmlybShoYXNoKS5zZW5kKHsgZnJvbTogdGhpcy5hY2NvdW50IH0pO1xuXHRcdFx0XHRyZWNlaXB0Lm9uKCd0cmFuc2FjdGlvbkhhc2gnLCByZXNvbHZlKVxuXHRcdFx0XHRyZWNlaXB0Lm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuXHRcdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBzZW5kKG1lc3NhZ2UpIHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cdFx0XHRpZiAodGhpcy5jaGVja1dlYjMoKSkge1xuXHRcdFx0XHRpZiAoIXRoaXMuY29udHJhY3QpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmluaXQoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGJhY21IYXNoID0gYXdhaXQgdGhpcy5nZXRUcmFuc2FjdGlvbkhhc2gobWVzc2FnZSk7XG5cblx0XHRcdFx0Y29uc3QgcmVjZWlwdCA9IHRoaXMuY29udHJhY3QubWV0aG9kcy5zZW5kKGJhY21IYXNoLnBheWxvYWQpLnNlbmQoeyBmcm9tOiB0aGlzLmFjY291bnQgfSk7XG5cdFx0XHRcdHJlY2VpcHQub24oJ3RyYW5zYWN0aW9uSGFzaCcsIChoYXNoKSA9PiB7XG5cdFx0XHRcdFx0cmVzb2x2ZSh7XG5cdFx0XHRcdFx0XHRoYXNoOiBoYXNoLFxuXHRcdFx0XHRcdFx0aWQ6IGJhY21IYXNoLnRyYW5zYWN0aW9uX2lkXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdHJlY2VpcHQub24oJ2Vycm9yJywgKGVycm9yKSA9PiB7XG5cdFx0XHRcdFx0cmVqZWN0KGVycm9yKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgV2ViMyA9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdHJlamVjdChcIlBsZWFzZSBpbnN0YWxsIFdlYjMuanNcIik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVqZWN0KFwiUGxlYXNlIGluc3RhbGwgTWV0YU1hc2tcIik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGdldFRyYW5zYWN0aW9uSGFzaChtZXNzYWdlKSB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHZhciBkYXRhID0gbmV3IEZvcm1EYXRhKCk7XG5cblx0XHRcdGRhdGEuYXBwZW5kKFwiYXBpS2V5XCIsIHRoaXMuYXBpS2V5KTtcblx0XHRcdGRhdGEuYXBwZW5kKFwiY2hhbm5lbFwiLCB0aGlzLmNoYW5uZWwpO1xuXHRcdFx0ZGF0YS5hcHBlbmQoXCJtZXNzYWdlXCIsIEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcblxuXHRcdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG5cdFx0XHR4aHIuYWRkRXZlbnRMaXN0ZW5lcihcInJlYWR5c3RhdGVjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAodGhpcy5yZWFkeVN0YXRlID09PSA0KSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlc3BvbnNlID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XG5cdFx0XHRcdFx0XHRpZiAocmVzcG9uc2UuZXJyb3JzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFBpZVNvY2tldCBFcnJvcjogJHtKU09OLnN0cmluZ2lmeShyZXNwb25zZS5lcnJvcnMpfWApO1xuXHRcdFx0XHRcdFx0XHRyZWplY3QoKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKHJlc3BvbnNlLnN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZShyZXNwb25zZS5zdWNjZXNzKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdChcIlVua25vd24gZXJyb3JcIik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkNvdWxkIG5vdCBjb25uZWN0IHRvIEJsb2NrY2hhaW4gTWVzc2FnaW5nIEFQSSwgdHJ5IGxhdGVyXCIpO1xuXHRcdFx0XHRcdFx0cmVqZWN0KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0eGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiQmxvY2tjaGFpbiBNZXNzYWdpbmcgQVBJIHNlZW1zIHVucmVhY2hhYmxlIGF0IHRoZSBtb21lbnQsIHRyeSBsYXRlclwiKTtcblx0XHRcdFx0cmVqZWN0KCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0eGhyLm9wZW4oXCJQT1NUXCIsIEJDTUVuZHBvaW50KTtcblx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiQWNjZXB0XCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcblx0XHRcdHhoci5zZW5kKGRhdGEpO1xuXHRcdH0pO1xuXHR9XG59IiwiaW1wb3J0IExvZ2dlciBmcm9tICcuL0xvZ2dlci5qcyc7XG5pbXBvcnQgQmxvY2tjaGFpbiBmcm9tICcuL0Jsb2NrY2hhaW4nO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDaGFubmVsIHtcblxuICAgIGNvbnN0cnVjdG9yKGVuZHBvaW50LCBpZGVudGl0eSwgaW5pdD10cnVlKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzID0ge307XG4gICAgICAgIHRoaXMubGlzdGVuZXJzID0ge307XG5cblxuICAgICAgICBpZighaW5pdCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluaXQoZW5kcG9pbnQsIGlkZW50aXR5KTtcbiAgICB9XG5cbiAgICBpbml0KGVuZHBvaW50LCBpZGVudGl0eSl7ICAgICAgICBcbiAgICAgICAgdGhpcy5lbmRwb2ludCA9IGVuZHBvaW50O1xuICAgICAgICB0aGlzLmlkZW50aXR5ID0gaWRlbnRpdHk7XG4gICAgICAgIHRoaXMuY29ubmVjdGlvbiA9IHRoaXMuY29ubmVjdCgpO1xuICAgICAgICB0aGlzLnNob3VsZFJlY29ubmVjdCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmxvZ2dlciA9IG5ldyBMb2dnZXIoaWRlbnRpdHkpO1xuICAgIH1cblxuICAgIGNvbm5lY3QoKSB7XG4gICAgICAgIHZhciBjb25uZWN0aW9uID0gbmV3IFdlYlNvY2tldCh0aGlzLmVuZHBvaW50KTtcbiAgICAgICAgY29ubmVjdGlvbi5vbm1lc3NhZ2UgPSB0aGlzLm9uTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICBjb25uZWN0aW9uLm9ub3BlbiA9IHRoaXMub25PcGVuLmJpbmQodGhpcyk7XG4gICAgICAgIGNvbm5lY3Rpb24ub25lcnJvciA9IHRoaXMub25FcnJvci5iaW5kKHRoaXMpO1xuICAgICAgICBjb25uZWN0aW9uLm9uY2xvc2UgPSB0aGlzLm9uQ2xvc2UuYmluZCh0aGlzKTtcblxuICAgICAgICByZXR1cm4gY29ubmVjdGlvbjtcbiAgICB9XG5cbiAgICBvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgLy9SZWdpc3RlciBsaWZlY3ljbGUgY2FsbGJhY2tzXG4gICAgICAgIHRoaXMuZXZlbnRzW2V2ZW50XSA9IGNhbGxiYWNrO1xuICAgIH1cblxuICAgIGxpc3RlbihldmVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgLy9SZWdpc3RlciB1c2VyIGRlZmluZWQgY2FsbGJhY2tzXG4gICAgICAgIHRoaXMubGlzdGVuZXJzW2V2ZW50XSA9IGNhbGxiYWNrO1xuICAgIH1cblxuXG4gICAgc2VuZChkYXRhKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdGlvbi5zZW5kKGRhdGEpO1xuICAgIH1cblxuICAgIHB1Ymxpc2goZXZlbnQsIGRhdGEsIG1ldGEpIHtcbiAgICAgICAgaWYgKG1ldGEgJiYgbWV0YS5ibG9ja2NoYWluKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zZW5kT25CbG9ja2NoYWluKGV2ZW50LCBkYXRhLCBtZXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5jb25uZWN0aW9uLnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgZXZlbnQ6IGV2ZW50LFxuICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgIG1ldGE6IG1ldGFcbiAgICAgICAgfSkpO1xuICAgIH1cblxuXG4gICAgc2VuZE9uQmxvY2tjaGFpbihldmVudCwgZGF0YSwgbWV0YSkge1xuICAgICAgICBpZiAoIXRoaXMuYmxvY2tjaGFpbikge1xuICAgICAgICAgICAgdGhpcy5ibG9ja2NoYWluID0gbmV3IEJsb2NrY2hhaW4odGhpcy5pZGVudGl0eS5hcGlLZXksIHRoaXMuaWRlbnRpdHkuY2hhbm5lbElkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmJsb2NrY2hhaW4uc2VuZChkYXRhKVxuICAgICAgICAgICAgLnRoZW4oKHJlY2VpcHQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ldmVudHNbJ2Jsb2NrY2hhaW4taGFzaCddKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXZlbnRzWydibG9ja2NoYWluLWhhc2gnXS5iaW5kKHRoaXMpKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRhOiBtZXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNhY3Rpb25IYXNoOiByZWNlaXB0Lmhhc2hcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb24uc2VuZChKU09OLnN0cmluZ2lmeSh7IFwiZXZlbnRcIjogZXZlbnQsIFwiZGF0YVwiOiBkYXRhLCBcIm1ldGFcIjogeyAuLi5tZXRhLCBcInRyYW5zYWN0aW9uX2lkXCI6IHJlY2VpcHQuaWQsIFwidHJhbnNhY3Rpb25faGFzaFwiOiByZWNlaXB0Lmhhc2ggfSB9KSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZXZlbnRzWydibG9ja2NoYWluLWVycm9yJ10pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ldmVudHNbJ2Jsb2NrY2hhaW4tZXJyb3InXS5iaW5kKHRoaXMpKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbmZpcm1PbkJsb2NrY2hhaW4oZXZlbnQsIHRyYW5zYWN0aW9uSGFzaCkge1xuICAgICAgICBpZiAoIXRoaXMuYmxvY2tjaGFpbikge1xuICAgICAgICAgICAgdGhpcy5ibG9ja2NoYWluID0gbmV3IEJsb2NrY2hhaW4odGhpcy5pZGVudGl0eS5hcGlLZXksIHRoaXMuaWRlbnRpdHkuY2hhbm5lbElkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYmxvY2tjaGFpbi5jb25maXJtKHRyYW5zYWN0aW9uSGFzaClcbiAgICAgICAgICAgIC50aGVuKChoYXNoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZXZlbnRzWydibG9ja2NoYWluLWhhc2gnXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV2ZW50c1snYmxvY2tjaGFpbi1oYXNoJ10uYmluZCh0aGlzKSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maXJtYXRpb25IYXNoOiB0cmFuc2FjdGlvbkhhc2gsXG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2FjdGlvbkhhc2g6IGhhc2hcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb24uc2VuZChKU09OLnN0cmluZ2lmeSh7IFwiZXZlbnRcIjogZXZlbnQsIFwiZGF0YVwiOiB0cmFuc2FjdGlvbkhhc2gsIFwibWV0YVwiOiB7IFwidHJhbnNhY3Rpb25faWRcIjogMSwgXCJ0cmFuc2FjdGlvbl9oYXNoXCI6IGhhc2ggfSB9KSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZXZlbnRzWydibG9ja2NoYWluLWVycm9yJ10pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ldmVudHNbJ2Jsb2NrY2hhaW4tZXJyb3InXS5iaW5kKHRoaXMpKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIG9uTWVzc2FnZShlKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmxvZygnQ2hhbm5lbCBtZXNzYWdlOicsIGUpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgbWVzc2FnZSA9IEpTT04ucGFyc2UoZS5kYXRhKTtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLmVycm9yICYmIG1lc3NhZ2UuZXJyb3IubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG91bGRSZWNvbm5lY3QgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRmlyZSBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLmV2ZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzW21lc3NhZ2UuZXZlbnRdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzW21lc3NhZ2UuZXZlbnRdLmJpbmQodGhpcykobWVzc2FnZS5kYXRhLCBtZXNzYWdlLm1ldGEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxpc3RlbmVyc1tcIipcIl0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5lcnNbXCIqXCJdLmJpbmQodGhpcykobWVzc2FnZS5ldmVudCwgbWVzc2FnZS5kYXRhLCBtZXNzYWdlLm1ldGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoanNvbkV4Y2VwdGlvbikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihqc29uRXhjZXB0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vRmlyZSBsaWZlY3ljbGUgY2FsbGJhY2tcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRzWydtZXNzYWdlJ10pIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzWydtZXNzYWdlJ10uYmluZCh0aGlzKShlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uT3BlbihlKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmxvZygnQ2hhbm5lbCBjb25uZWN0ZWQ6JywgZSk7XG4gICAgICAgIHRoaXMuc2hvdWxkUmVjb25uZWN0ID0gdHJ1ZTtcblxuICAgICAgICAvL1VzZXIgZGVmaW5lZCBjYWxsYmFja1xuICAgICAgICBpZiAodGhpcy5ldmVudHNbJ29wZW4nXSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudHNbJ29wZW4nXS5iaW5kKHRoaXMpKGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FcnJvcihlKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdDaGFubmVsIGVycm9yOicsIGUpO1xuICAgICAgICB0aGlzLmNvbm5lY3Rpb24uY2xvc2UoKTtcblxuICAgICAgICAvL1VzZXIgZGVmaW5lZCBjYWxsYmFja1xuICAgICAgICBpZiAodGhpcy5ldmVudHNbJ2Vycm9yJ10pIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzWydlcnJvciddLmJpbmQodGhpcykoZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkNsb3NlKGUpIHtcbiAgICAgICAgdGhpcy5sb2dnZXIud2FybignQ2hhbm5lbCBjbG9zZWQ6JywgZSk7XG4gICAgICAgIHRoaXMucmVjb25uZWN0KCk7XG5cbiAgICAgICAgLy9Vc2VyIGRlZmluZWQgY2FsbGJhY2tcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRzWydjbG9zZSddKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50c1snY2xvc2UnXS5iaW5kKHRoaXMpKGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVjb25uZWN0KCkge1xuICAgICAgICBpZiAoIXRoaXMuc2hvdWxkUmVjb25uZWN0KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sb2dnZXIubG9nKFwiUmVjb25uZWN0aW5nXCIpO1xuICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICB9XG5cblxufSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEludmFsaWRBdXRoRXhjZXB0aW9ue1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlLCBuYW1lPVwiSW52YWxpZEF1dGhFeGNlcHRpb25cIikge1xuICAgIHRoaXMubWVzc2FnZSA9IFwiQXV0aCBlbmRwb2ludCBkaWQgbm90IHJldHVybiBhIHZhbGlkIEpXVCBUb2tlbiwgcGxlYXNlIHNlZTogaHR0cHM6Ly93d3cucGllc29ja2V0LmNvbS9kb2NzLzMuMC9hdXRoZW50aWNhdGlvblwiO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7ICBcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIExvZ2dlciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgfVxuXG4gICAgbG9nKC4uLmRhdGEpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5jb25zb2xlTG9ncykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coLi4uZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB3YXJuKC4uLmRhdGEpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5jb25zb2xlTG9ncykge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKC4uLmRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZXJyb3IoLi4uZGF0YSkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmNvbnNvbGVMb2dzKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKC4uLmRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG59IiwiaW1wb3J0IENoYW5uZWwgZnJvbSAnLi9DaGFubmVsLmpzJztcbmltcG9ydCBMb2dnZXIgZnJvbSAnLi9Mb2dnZXIuanMnO1xuaW1wb3J0IHBqc29uIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgSW52YWxpZEF1dGhFeGNlcHRpb24gZnJvbSAnLi9JbnZhbGlkQXV0aEV4Y2VwdGlvbi5qcyc7XG5cbmNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICAgIHZlcnNpb246IDMsXG4gICAgY2x1c3RlcklkOiAnZGVtbycsXG4gICAgYXBpS2V5OiAnb0NkQ01jTVBRcGJ2TmpVSXpxdHZGMWQyWDJva1dwRFFqNEF3QVJKdUFndGpoekt4VkVqUVU2SWRDandtJyxcbiAgICBjb25zb2xlTG9nczogZmFsc2UsXG4gICAgbm90aWZ5U2VsZjogMCxcbiAgICBqd3Q6IG51bGwsXG4gICAgcHJlc2VuY2U6IDAsXG4gICAgYXV0aEVuZHBvaW50OiBcIi9icm9hZGNhc3RpbmcvYXV0aFwiLFxuICAgIGF1dGhIZWFkZXJzOiB7fSxcbiAgICBmb3JjZUF1dGg6IGZhbHNlLCBcbiAgICB1c2VySWQ6IG51bGxcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUGllU29ja2V0IHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgICAgdGhpcy5vcHRpb25zID0gey4uLmRlZmF1bHRPcHRpb25zLCAuLi5vcHRpb25zIH07XG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fVxuICAgICAgICB0aGlzLmxvZ2dlciA9IG5ldyBMb2dnZXIodGhpcy5vcHRpb25zKTtcbiAgICB9XG5cbiAgICBzdWJzY3JpYmUoY2hhbm5lbElkKSB7XG4gICAgICAgIHZhciBtYWtlRW5kcG9pbnQgPSB0aGlzLmdldEVuZHBvaW50KGNoYW5uZWxJZCk7XG5cbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGlvbnNbY2hhbm5lbElkXSkge1xuICAgICAgICAgICAgdGhpcy5sb2dnZXIubG9nKFwiUmV0dXJuaW5nIGV4aXN0aW5nIGNoYW5uZWxcIiwgY2hhbm5lbElkKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb25zW2NoYW5uZWxJZF07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMubG9nZ2VyLmxvZyhcIkNyZWF0aW5nIG5ldyBjaGFubmVsXCIsIGNoYW5uZWxJZCk7XG4gICAgICAgIHZhciBjaGFubmVsID0gbmV3IENoYW5uZWwobnVsbCwgbnVsbCwgZmFsc2UpO1xuXG4gICAgICAgIG1ha2VFbmRwb2ludC50aGVuKChlbmRwb2ludCk9PntcbiAgICAgICAgICAgIGNoYW5uZWwuaW5pdChlbmRwb2ludCwge1xuICAgICAgICAgICAgICAgIGNoYW5uZWxJZDogY2hhbm5lbElkLFxuICAgICAgICAgICAgICAgIC4uLnRoaXMub3B0aW9uc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnNbY2hhbm5lbElkXSA9IGNoYW5uZWw7XG4gICAgICAgIHJldHVybiBjaGFubmVsO1xuICAgIH1cblxuICAgIHVuc3Vic2NyaWJlKGNoYW5uZWxJZCl7XG4gICAgICAgIGlmKHRoaXMuY29ubmVjdGlvbnNbY2hhbm5lbElkXSl7XG4gICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25zW2NoYW5uZWxJZF0uc2hvdWxkUmVjb25uZWN0ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25zW2NoYW5uZWxJZF0uY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbY2hhbm5lbElkXTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGdldENvbm5lY3Rpb25zKCl7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb25zO1xuICAgIH1cblxuICAgIGFzeW5jIGdldEF1dGhUb2tlbihjaGFubmVsKXtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT57XG4gICAgICAgICAgICB2YXIgZGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgICAgICAgZGF0YS5hcHBlbmQoXCJjaGFubmVsX25hbWVcIiwgY2hhbm5lbCk7XG4gICAgXG4gICAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICBcbiAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKFwicmVhZHlzdGF0ZWNoYW5nZVwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSAgSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgfWNhdGNoKGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBJbnZhbGlkQXV0aEV4Y2VwdGlvbihcIkNvdWxkIG5vdCBmZXRjaCBhdXRoIHRva2VuXCIsIFwiQXV0aEVuZHBvaW50UmVzcG9uc2VFcnJvclwiKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsICgpPT57XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBJbnZhbGlkQXV0aEV4Y2VwdGlvbihcIkNvdWxkIG5vdCBmZXRjaCBhdXRoIHRva2VuXCIsIFwiQXV0aEVuZHBvaW50RXJyb3JcIikpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHhoci5vcGVuKFwiUE9TVFwiLCB0aGlzLm9wdGlvbnMuYXV0aEVuZHBvaW50KTtcblxuICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IE9iamVjdC5rZXlzKHRoaXMub3B0aW9ucy5hdXRoSGVhZGVycyk7XG4gICAgICAgICAgICBoZWFkZXJzLmZvckVhY2goaGVhZGVyID0+IHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIHRoaXMub3B0aW9ucy5hdXRoSGVhZGVyc1toZWFkZXJdKTtcbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgeGhyLnNlbmQoZGF0YSk7IFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpc0d1YXJkZWQoY2hhbm5lbCl7XG4gICAgICAgIGlmKHRoaXMub3B0aW9ucy5mb3JjZUF1dGgpe1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKFwiXCIrY2hhbm5lbCkuc3RhcnRzV2l0aChcInByaXZhdGUtXCIpO1xuICAgIH1cblxuICAgIGFzeW5jIGdldEVuZHBvaW50KGNoYW5uZWxJZCkge1xuICAgICAgICBsZXQgZW5kcG9pbnQgPSBgd3NzOi8vJHt0aGlzLm9wdGlvbnMuY2x1c3RlcklkfS5waWVzb2NrZXQuY29tL3Yke3RoaXMub3B0aW9ucy52ZXJzaW9ufS8ke2NoYW5uZWxJZH0/YXBpX2tleT0ke3RoaXMub3B0aW9ucy5hcGlLZXl9Jm5vdGlmeV9zZWxmPSR7dGhpcy5vcHRpb25zLm5vdGlmeVNlbGZ9JnNvdXJjZT1qc3NkayZ2PSR7cGpzb24udmVyc2lvbn0mcHJlc2VuY2U9JHt0aGlzLm9wdGlvbnMucHJlc2VuY2V9YFxuXG4gICAgICAgIC8vU2V0IGF1dGhcbiAgICAgICAgaWYodGhpcy5vcHRpb25zLmp3dCl7XG4gICAgICAgICAgICBlbmRwb2ludCA9IGVuZHBvaW50K1wiJmp3dD1cIit0aGlzLm9wdGlvbnMuand0O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYodGhpcy5pc0d1YXJkZWQoY2hhbm5lbElkKSl7XG4gICAgICAgICAgICBjb25zdCBhdXRoID0gYXdhaXQgdGhpcy5nZXRBdXRoVG9rZW4oY2hhbm5lbElkKTtcbiAgICAgICAgICAgIGlmKGF1dGguYXV0aCl7XG4gICAgICAgICAgICAgICAgZW5kcG9pbnQgPSBlbmRwb2ludCArIFwiJmp3dD1cIithdXRoLmF1dGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL1NldCB1c2VyIGlkZW50aXR5XG4gICAgICAgIGlmKHRoaXMub3B0aW9ucy51c2VySWQpe1xuICAgICAgICAgICAgZW5kcG9pbnQgPSBlbmRwb2ludCArIFwiJnVzZXI9XCIrdGhpcy5vcHRpb25zLnVzZXJJZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbmRwb2ludDtcbiAgICB9XG59IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL1BpZVNvY2tldCcpLmRlZmF1bHQ7IiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIiLCIvLyBzdGFydHVwXG4vLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbi8vIFRoaXMgZW50cnkgbW9kdWxlIHVzZWQgJ21vZHVsZScgc28gaXQgY2FuJ3QgYmUgaW5saW5lZFxudmFyIF9fd2VicGFja19leHBvcnRzX18gPSBfX3dlYnBhY2tfcmVxdWlyZV9fKFwiLi9zcmMvaW5kZXguanNcIik7XG4iLCIiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=