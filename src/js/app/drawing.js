"use strict";

var canvas = global.canvas;
var utils = new (require('./fabricUtils.js'))();

var drawnObj, isMouseDown;

function disableDraw() {
  canvas.off('mouse:down');
  canvas.off('mouse:move');
  canvas.off('mouse:up');

  canvas.selection = true;
  canvas.forEachObject(function(o) {
    if (global.template === null || o!=global.template ) {
      o.selectable = true;
    }
  });
}

function drawObj(objType) {
  // Esc key handler
  $(document).on("keyup", escHandler);

  canvas.selection = false;
  canvas.forEachObject(function(o) {
    o.selectable = false;
  });

  canvas.on('mouse:down', function(o){
    // Unregister escape key handler
    $(document).off("keyup", escHandler);

    isMouseDown = true;
    var pointer = canvas.getPointer(o.e);

    if (objType === 'line') {
      var points = [ pointer.x, pointer.y, pointer.x, pointer.y ];
      drawnObj = new fabric.Line(points, {
        strokeWidth: 5,
        fill: 'blue',
        stroke: 'blue',
        originX: 'center',
        originY: 'center'
      });
    } else if (objType === 'square') {
      drawnObj = new fabric.Rect({
        width: 0,
        height: 0,
        top: pointer.y,
        left: pointer.x,
        fill: 'green'
      });
    } else if (objType === 'rounded-rect') {
      drawnObj = new fabric.Rect({
        width: 0,
        height: 0,
        top: pointer.y,
        left: pointer.x,
        rx: 10,
        ry: 10,
        fill: 'red'
      });
    } else if (objType === 'circle') {
      drawnObj = new fabric.Circle({
        radius: 0,
        top: pointer.y,
        left: pointer.x,
        fill: 'yellow'
      });
    } else if (objType === 'star') {
      drawnObj = new fabric.Star({
        inner: 0,
        outer: 0,
        spikes: 0,
        top: pointer.y,
        left: pointer.x,
        fill: 'blue'
      });
    }
    if(global.template !== null){
      drawnObj.globalCompositeOperation='source-atop';
    }
    canvas.add(drawnObj);
  });

  canvas.on('mouse:move', function(o){
    if (!isMouseDown) return;
    var shift = o.e.shiftKey;
    var pointer = canvas.getPointer(o.e);

    if (objType === 'line') {
      if (shift) {
        // TODO rotate towards closest angle
        drawnObj.set({ x2: pointer.x, y2: pointer.y });
      } else {
        drawnObj.set({ x2: pointer.x, y2: pointer.y });
      }
    } else if (objType === 'square' || objType === 'rounded-rect') {
      var newWidth = (drawnObj.left - pointer.x) * -1;
      var newHeight = (drawnObj.top - pointer.y) * -1;
      drawnObj.set({width: newWidth, height: newHeight});
    } else if (objType === 'circle') {
      var x = drawnObj.left - pointer.x;
      var y = drawnObj.top - pointer.y;
      var diff = Math.sqrt(x*x + y*y);
      drawnObj.set({radius: diff/2.3});
    } else if (objType === 'star') {
      var x = drawnObj.left - pointer.x;
      var y = drawnObj.top - pointer.y;
      var h = Math.sqrt(x*x + y*y);
      var diff = h/2.3;
      var angle = Math.abs(Math.asin(y/h)*(180.0/Math.PI));
      var spikes = Math.round(angle / 4);
      drawnObj.set({inner:  diff*(spikes < 8 ? (0.7/8.0)*spikes :  0.7), outer: diff, spikes: spikes});
    }

    canvas.renderAll();
  });

  canvas.on('mouse:up', function(o){
    isMouseDown = false;

    // Fix upside-down square
    if (objType === 'square' || objType === 'rounded-rect') {
      if (drawnObj.width < 0) {
        var newLeft = drawnObj.left + drawnObj.width;
        var newWidth = Math.abs(drawnObj.width);
        drawnObj.set({left: newLeft, width: newWidth});
      }

      if (drawnObj.height < 0) {
        var newTop = drawnObj.top + drawnObj.height;
        var newHeight = Math.abs(drawnObj.height);
        drawnObj.set({top: newTop, height: newHeight});
      }
    }

    // Delete the object if it's tiny, otherwise select it
    if (drawnObj.height !== 0 || drawnObj.width !== 0) {
      canvas.defaultCursor = 'auto';

      // Fix selection bug by selecting and deselecting all objects
      utils.selectAll();
      canvas.discardActiveObject();
    
      // Select the object
      canvas.setActiveObject(drawnObj).renderAll();

      // Set per-pixel dragging rather than bounding-box dragging
      drawnObj.perPixelTargetFind = true;
      drawnObj.targetFindTolerance = 4;

      // Disable drawing
      disableDraw();

      // Push the canvas state to history
      canvas.trigger( "object:statechange");
    } else {
      canvas.remove(drawnObj);
    }
  });

}

function cancelInsert() {
  canvas.defaultCursor = 'auto';
  disableDraw();
  $("#toolbar-text").removeClass("toolbar-item-active");
}

// Cancel text insertion
function escHandler(e) {
  if (e.keyCode == 27) {
    cancelInsert();

    // Unregister escape key handler
    $(document).off("keyup", escHandler);
  }
}
function regularPolygonPoints(sideCount,radius){
  var sweep=Math.PI*2/sideCount;
  var cx=radius;
  var cy=radius;
  var points=[];
  for(var i=0;i<sideCount;i++){
    var x=cx+radius*Math.cos(i*sweep);
    var y=cy+radius*Math.sin(i*sweep);
    points.push({x:x,y:y});
  }
  return(points);
}
/* ----- exports ----- */

function DrawingModule() {
  if (!(this instanceof DrawingModule)) return new DrawingModule();
  // constructor
  fabric.Star = fabric.util.createClass(fabric.Polygon, {
    type: 'star',
    initialize: function (options) {
      options = options || {};
      this.set( 'spikes'  , options.spikes   || 0 );
      this.set( 'inner', options.inner || 0 );
      this.set( 'outer', options.outer || 0 );
      this.callSuper('initialize',this.points, options);
    },
    calcpoints: function (){
      var sweep = Math.PI / this.spikes;
      var points = [];
      var angle = 0;

      for (var i = 0; i < this.spikes; i++) {
        var x = Math.cos(angle) * this.outer;
        var y = Math.sin(angle) * this.outer;
        points.push({x: x, y: y});
        angle += sweep;

        x = Math.cos(angle) * this.inner;
        y = Math.sin(angle) * this.inner;
        points.push({x: x, y: y});
        angle += sweep;
      }
      return (points);
    },
    _setpoints: function(){
      this.points=this.calcpoints();
    },
    toSVG : function(reviver){
      return this.callSuper('toSVG',reviver).replace('star','polygon');
    },
    _render: function (ctx) {
      this._setpoints();
      this.callSuper('_render', ctx);
    },
    set: function(options,value){
      this.callSuper('set', options, value);
      this._setpoints();
      this._set("width",this.outer*2);
      this._set("height",this.outer*2);
    },
    toObject: function() {
      return fabric.util.object.extend(
          this.callSuper('toObject'), {
            spikes  : this.get('spikes'),
            inner : this.get('inner'),
            outer : this.get('outer')
          } );
    },

  });
  fabric.Star.fromObject = function( object, callback ) {
    return callback(new fabric.Star( object ));
  };

  //     function (spikeCount, outerRadius, innerRadius){
  //   var points=starPolygonPoints(spikeCount,outerRadius,innerRadius);
  //   return new fabric.Polygon(points, {
  //     strokeLineJoin: 'bevil'
  //   },false);
  // };
  fabric.RegularPolygon = function (sideCount, radius){
    var points=regularPolygonPoints(sideCount,radius);
    return new fabric.Polygon(points, {
      strokeLineJoin: 'bevil'
    },false);
  };
}

DrawingModule.prototype.drawObj = drawObj;
DrawingModule.prototype.disableDraw = disableDraw;

module.exports = DrawingModule;
