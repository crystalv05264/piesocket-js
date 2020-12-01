var PieSocket;PieSocket=(()=>{var e={186:(e,n,t)=>{"use strict";t.d(n,{default:()=>i});class o{constructor(e,n){this.endpoint=e,this.identity=n,this.connection=this.connect(),this.events={}}connect(){var e=new WebSocket(this.endpoint);return e.onmessage=this.onMessage.bind(this),e.onopen=this.onOpen.bind(this),e.onerror=this.onError.bind(this),e.onclose=this.onClose.bind(this),e}on(e,n){this.events[e]=n}onMessage(e){console.log("Channel message:",e),this.events.message&&this.events.message.bind(this)(e)}onOpen(e){console.log("Channel connected:",e),this.events.open&&this.events.open.bind(this)(e)}onError(e){console.error("Channel error:",e),this.connection.close(),this.events.error&&this.events.error.bind(this)(e)}onClose(e){console.warn("Channel closed:",e),this.reconnect(),this.events.close&&this.events.close.bind(this)(e)}reconnect(){console.log("Reconnecting"),this.connect()}}const s={version:3,cluster_id:"demo",api_key:"oCdCMcMPQpbvNjUIzqtvF1d2X2okWpDQj4AwARJuAgtjhzKxVEjQU6IdCjwm"};class i{constructor(e){e=e||{},this.options={...s,...e},this.connections={},console.log(this.options)}subscribe(e){var n=this.getEndpoint(e);if(this.connections[e])return console.log("Returning existing channel",n),this.connections[e];console.log("Creating new channel",n);var t=new o(n,{channelId:e,...this.options});return this.connections[e]=t,t}getEndpoint(e){return`wss://${this.options.cluster_id}.websocket.me/v${this.options.version}/${e}?api_key=${this.options.api_key}`}}},138:(e,n,t)=>{e.exports=t(186).default}},n={};function t(o){if(n[o])return n[o].exports;var s=n[o]={exports:{}};return e[o](s,s.exports,t),s.exports}return t.d=(e,n)=>{for(var o in n)t.o(n,o)&&!t.o(e,o)&&Object.defineProperty(e,o,{enumerable:!0,get:n[o]})},t.o=(e,n)=>Object.prototype.hasOwnProperty.call(e,n),t(138)})();