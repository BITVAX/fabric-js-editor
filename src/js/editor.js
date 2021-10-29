global.jQuery = require('jquery');
global.$ = global.jQuery;

$(function() {
  "use strict";
	global.canvas = new fabric.Canvas('c');
	global.template = null;
	global.background = null;
	global.optimal = null;
	global.store = 'en_eu';
	global.lang = 'en';
	global.data = null;
	new (require('./app/handlers.js'))();
});
