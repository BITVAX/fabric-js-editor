global.jQuery = require('jquery');
global.$ = global.jQuery;

$(function() {
  "use strict";
	global.canvas = new fabric.Canvas('c');
	global.template = null;
	global.optimal = null;
	new (require('./app/handlers.js'))();
});
