/*
Copyright (C) 2011 Greg Smith <gsmith@incompl.com>

Released under the MIT license:
https://github.com/incompl/LetterBrush/blob/master/LICENSE

Created at Bocoup http://bocoup.com

Created for 91 http://startcontinue.com
*/

$(function() {
  
  var scrollbarWidth = $("#vScroll").width();
  var scrollbarHeight = $("#vScroll").width();
  var scrollbarSize = $("#vScroll").width();
  var MENU_WIDTH = $("#tools").width();
  
  var i, j;
  
  var currentMode = "pencil";
  
  var currentChar = "B";
  
  var view = {
    scale: 20, // pixels per char
    x: 0,
    y: 0,
    width: 40,
    height: 30
  };
  
  var interaction = {cancelled: false, dragging: false};
  
  var text = [];
  var textWidth = 0;
  function updateTextWidth() {
    var newWidth = 0;
    for (i = 0; i < text.length; i++) {
      if (text[i].length > newWidth) {
        newWidth = text[i].length;
      }
    }
    if (textWidth !== newWidth) {
      textWidth = newWidth;
      $(window).resize();
    }
    showHideScrollBars();
  }
  function showHideScrollBars() {
    if (textWidth <= view.width) {
      $("#hScroll").hide();
    }
    else {
      $("#hScroll").show();
    }
    if (text.length <= view.height) {
      $("#vScroll").hide();
    }
    else {
      $("#vScroll").show();
    }
  }
  
  var undoStack = [];
  var redoStack = [];
  function pushUndoFrame() {
    $("#undo").prop("disabled", false);
    $("#redo").prop("disabled", true);
    redoStack = [];
    if (undoStack.length > 50) {
      undoStack.shift();
    }
    undoStack.push($.extend(true, [], text)); // deep clone
  }
  
  var defaultPallete = {
    ".": "gray",
    "R": "red",
    "O": "orange",
    "Y": "yellow",
    "G": "green",
    "B": "blue",
    "I": "indigo",
    "V": "purple"
  };
  var palette;
  if (localStorage && localStorage.getItem("palette")) {
    palette = JSON.parse(localStorage.getItem("palette"));
  }
  else {
    palette = defaultPallete;
  }
  
  // generate test data
  text.push([]);
  for (i = 0; i < 50; i++) {
    text[i] = [];
    for (j = 0; j < 100; j++) {
      text[i][j] = ".";
    }
  }
  updateTextWidth();
  
  var $easel = $("#easel");
  
  var ctx = $easel[0].getContext("2d");
  ctx.font = view.scale + "pt Arial";

  var Mode = {
    mouseup: $.noop,
    mousemove: $.noop,
    mousedown: $.noop
  };

  // different draw modes
  var mode = {
    
    // normal drawing tool
    pencil: inherit(Mode, {
      _pencil: function(row, col) {
        var current = {x:col, y:row};
        var previous = this._previous;
        var nodes;
        if (previous !== undefined) {
          nodes = mode.line._line(previous.x,
                                  previous.y,
                                  current.x,
                                  current.y,
                                  false);
          $.each(nodes, function() {
            text[this.x][this.y] = currentChar;
          });
        }
        this._previous = current;
        draw();
      },
      mousedown: function(row, col) {
        delete this._previous;
        pushUndoFrame();
        text[col][row] = currentChar;
      },
      mousemove: function(row, col) {
        this._pencil(row, col);
      },
      mouseup: function(row, col) {
        this._pencil(row, col);
      }
    }),
    
    // draw a straight line
    line: inherit(Mode, {
      _line: function(x1, y1, x2, y2, draw) {
        var nodes = {};
        var length = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        var x;
        var y;
        
        // calculate affected nodes
        for (i = 0; i < length * view.scale; i++) {
          x = x2 + Math.round((x1 - x2) * (i / length) / view.scale);
          y = y2 + Math.round((y1 - y2) * (i / length) / view.scale);
          nodes[x + "," + y] = {x:x, y:y};
        }
        
        if (draw) {
          // highlight affected nodes
          ctx.fillStyle = "rgba(0, 255, 0, .3)";
          $.each(nodes, function() {
            ctx.fillRect((this.x - view.x) * view.scale,
                       (this.y - view.y) * view.scale,
                       view.scale,
                       view.scale);
					});

          // render a line
          ctx.strokeStyle = "rgba(0, 150, 0, .8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((x1 - view.x) * view.scale + view.scale / 2,
                     (y1 - view.y) * view.scale + view.scale / 2);
          ctx.lineTo((x2 - view.x) * view.scale + view.scale / 2,
                     (y2 - view.y) * view.scale + view.scale / 2);
          ctx.closePath();
          ctx.stroke();
        }
        
        return nodes;
      },
      mousedown: function(row, col) {
        draw();
        this._line(row, col, row, col, true);
      },
      mousemove: function(row, col) {
        draw();
        this._line(row,
                   col,
                   interaction.originalRow,
                   interaction.originalCol,
                   true);
      },
      mouseup: function(row, col) {
        pushUndoFrame();
        var nodes = this._line(row,
                   col,
                   interaction.originalRow,
                   interaction.originalCol,
                   false);
        $.each(nodes, function() {
          text[this.y][this.x] = currentChar;
        });
        draw();
      }
    }),
    
    // flood fill bucket tool
    fill: inherit(Mode, {
      mouseup: function(row, col) {
        var queue = [{col:col, row:row}];
        var replacedChar = text[col][row];
        var cur;
        var potentials;
        var seen = {};
        seen[col + "," + row] = true;
        pushUndoFrame();
        while (queue.length > 0) {
          cur = queue.pop();
          text[cur.col][cur.row] = currentChar;
          potentials = [{col: cur.col, row: cur.row + 1},
                        {col: cur.col, row: cur.row - 1},
                        {col: cur.col + 1, row: cur.row},
                        {col: cur.col - 1, row: cur.row}];
          $.each(potentials, function() {
            if (text[this.col] &&
                text[this.col][this.row] &&
                text[this.col][this.row] === replacedChar &&
                seen[this.col + "," + this.row] === undefined) {
              queue.push(this);
              seen[this.col + "," + this.row] = true;
            }
          });
        }
        draw();
      }
    }),
    
    // square tool
    square: inherit(Mode, {
      mousemove: function(row, col) {
        draw();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        if (row >= interaction.originalRow &&
            col >= interaction.originalCol) {
          ctx.strokeRect((interaction.originalRow - view.x) * view.scale,
                     (interaction.originalCol - view.y) * view.scale,
                     (row - interaction.originalRow + 1) * view.scale,
                     (col - interaction.originalCol + 1) * view.scale);
        }
        else if (row <= interaction.originalRow &&
                 col <= interaction.originalCol) {
          ctx.strokeRect((interaction.originalRow - view.x + 1) * view.scale,
                     (interaction.originalCol - view.y + 1) * view.scale,
                     (row - interaction.originalRow - 1) * view.scale,
                     (col - interaction.originalCol - 1) * view.scale);
        }
        else if (row > interaction.originalRow &&
                 col < interaction.originalCol) {
          ctx.strokeRect((interaction.originalRow - view.x) * view.scale,
                     (interaction.originalCol - view.y + 1) * view.scale,
                     (row - interaction.originalRow + 1) * view.scale,
                     (col - interaction.originalCol - 1) * view.scale);
        }
        else if (row < interaction.originalRow &&
                 col > interaction.originalCol) {
          ctx.strokeRect((interaction.originalRow - view.x + 1) * view.scale,
                     (interaction.originalCol - view.y) * view.scale,
                     (row - interaction.originalRow - 1) * view.scale,
                     (col - interaction.originalCol + 1) * view.scale);
        }
      },
      mouseup: function(row, col) {
        var startX = 0;
        var startY = 0;
        var widthX = 1;
        var widthY = 1;
        pushUndoFrame();
        if (row >= interaction.originalRow &&
            col >= interaction.originalCol) {
          startX += interaction.originalRow;
          startY += interaction.originalCol;
          widthX += row;
          widthY += col;
        }
        else if (row <= interaction.originalRow &&
                 col <= interaction.originalCol) {
          startX += row;
          startY += col;
          widthX += interaction.originalRow;
          widthY += interaction.originalCol;
        }
        else if (row > interaction.originalRow &&
                 col < interaction.originalCol) {
          startX += interaction.originalRow;
          startY += col;
          widthX += row;
          widthY += interaction.originalCol;
        }
        else if (row < interaction.originalRow &&
                 col > interaction.originalCol) {
          startX += row;
          startY += interaction.originalCol;
          widthX += interaction.originalRow;
          widthY += col;
        }
        for (i = startY; i < widthY; i++) {
          for (j = startX; j < widthX; j++) {
            text[i][j] = currentChar;
          }
        }
        draw();
      }
    })
    
  };
  
  // delegate events to current draw mode's handler
  $(document).on("mousedown", "#easel", function(e) {
    if (e.which === 3) {
      return;
    }
    interaction = {cancelled: false, dragging: false};
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    interaction.originalRow = row;
    interaction.originalCol = col;
    interaction.dragging = true;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mousedown(row, col);
    }
  })
  .on("mousemove", "#easel", function(e) {
    if (interaction.cancelled) {
      return;
    }
    if (!interaction.dragging) {
      return;
    }
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mousemove(row, col);
    }
  })
  .on("mouseup", "#easel", function(e) {
    if (!interaction.dragging || interaction.cancelled) {
      return;
    }
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    interaction.dragging = false;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mouseup(row, col);
    }
  })
  .on("mouseup", window, function(e) {
    interaction.cancelled = true;
    draw();
  })
  .on("contextmenu", "#easel", function(e) {
    // right click is the eyedropper-style color picker
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      currentChar = text[col][row];
      $("#currentChar").text(text[col][row]);
    }
    e.preventDefault();
  });
  
  // render out the current text data
  var currentRow = 0;
  var currentCol = 0;
  var row;
  function draw() {
    var color;
    ctx.clearRect(0, 0, $easel.width(), $easel.height());
    for (currentRow = view.y; currentRow < view.y + view.height; currentRow++) {
      row = text[currentRow];
      if (!row) {
        continue;
      }
      for (currentCol = view.x; currentCol < view.x + view.width; currentCol++){
        if (!row[currentCol]) {
          continue;
        }
        color = palette[row[currentCol]];
        color = color ? color : "black";
        ctx.fillStyle = color;
        ctx.fillText(row[currentCol],
                     (currentCol - view.x) * view.scale,
                     (currentRow - view.y + 1) * view.scale);
      }
    }
  }
  draw();
  
  // keyboard input
  $(document).keydown(function(e) {
    
    if ($(".ui-widget-overlay").length > 0) {
      return;
    }
    
    var ctrl = e.ctrlKey || e.metaKey;
    
    // pick a key to draw
    var key = keyDecode(e);
    if (!e.altKey && !ctrl && key.length === 1) {
      e.preventDefault();
      currentChar = key;
      $("#currentChar").text(key);
    }
    
    // undo
    else if (ctrl && key === "z") {
      e.preventDefault();
      if (!$("#undo").prop("disabled")) {
        highlight($("#undo"), "beingClicked");
        $("#undo").click();
      }
    }
    
    // redo
    else if (ctrl && key === "y") {
      e.preventDefault();
      if (!$("#redo").prop("disabled")) {
        highlight($("#redo"), "beingClicked");
        $("#redo").click();
      }
    }
    
    // cancel interaction
    else if (key === "escape") {
      e.preventDefault();
      interaction.cancelled = true;
      draw();
    }
    
    // tools shortcuts
    else if (key === "tab") {
      e.preventDefault();
      if (currentMode === "pencil") {
        $("#line").click();
      }
      else if (currentMode === "line") {
        $("#square").click();
      }
      else if (currentMode === "square") {
        $("#fill").click();
      }
      else if (currentMode === "fill") {
        $("#pencil").click();
      }
    }
    
  });
  
  // pick tool by clicking it
  $(".tool").click(function() {
    var $this = $(this);
    currentMode = $(this).data("tool");
    $(".active").removeClass("active");
    $this.addClass("active");
  });
  
  // import
  $("#importDialog").hide();
  function importText(str) {
    pushUndoFrame();
    text = [];
    $.each(str.split(/\n/), function() {
      var row = [];
      text.push(row);
      $.each(this.split(""), function(i, char) {
        row.push(char);
      });
    });
    draw();
    updateTextWidth();
  }
  
  // import file
  if (!window.FileReader) {
    $("#fileInputWrapper").remove();
  }
  $("#fileInput").change(function() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
      importText(e.target.result);
      $("#fileInput").val("");
    };
    reader.readAsText(file);
    $("#importDialog").dialog("close");
  });
  
  // import text
  $("#import").click(function() {
    var $importText = $("#importText");
    $("#importDialog").dialog({
      title: "Import",
      modal: true,
      width: 500,
      position: ['center', 100],
      buttons: {
        'import': function() {
          importText($importText.val());
          $(this).dialog("close");
        },
        cancel: function() {
          $(this).dialog("close");
        }
      }
    });
    $importText[0].focus();
    $importText[0].select();
  });
  
  
  // export
  $("#exportDialog").hide();
  $("#export").click(function() {
    $("body").removeClass("noSelect");
    var $exportDialog = $("#exportDialog");
    var $exportText = $("#exportText");
    var $progress = $("<div></div>");
    $exportDialog.append($progress);
    $progress.progressbar({value: 0});
    $exportText.val("").hide();
    $exportDialog.dialog({
      title: "Export",
      modal: true,
      width: 450,
      position: ['center', 100],
      buttons: {
        done: function() {
          $(this).dialog("close");
        }
      },
      beforeClose: function() {
        $("body").addClass("noSelect");
      }
    });
    i = 0;
    var exportStr = "";
    var textLength = text.length;
    var exportStart = new Date().getTime();
    setTimeout(function exportLine() {
      var start = new Date().getTime();
      console.log("starting");
      var rowText = text[i].join("");
      console.log("join: " + (new Date().getTime() - start));
      exportStr += rowText;
      console.log("concat: " + (new Date().getTime() - start));
      //$progress.progressbar("option", "value", i / textLength * 100);
      console.log("progress: " + (new Date().getTime() - start));
      i++;
      if (i < text.length) {
        setTimeout(exportLine, 0);
      }
      else {
        $progress.remove();
        $exportText.val(exportStr);
        $exportText.show();
        $exportText[0].focus();
        $exportText[0].select();
        console.log("done in " + (new Date().getTime() - exportStart));
      }
    }, 0);
  });
  
  // colors
  var $colorsDialog = $("#colorsDialog");
  $colorsDialog.hide();
  if (!JSON) {
    $("#colors").remove();
  }
  function colorSave() {
    var success = false;
    var newPalette = $("#colorsJSON").val();
    try {
      palette = JSON.parse(newPalette);
      success = true;
    }
    catch (e) {
      alert("Invalid JSON!");
    }
    if (success) {
      $(this).dialog("close");
      draw();
      if (localStorage) {
        localStorage.setItem("palette", JSON.stringify(palette));
      }
    }
  }
  $("#colors").click(function() {
    $("body").removeClass("noSelect");
    $("#colorsJSON").val(JSON.stringify(palette));
    $colorsDialog.dialog({
      title: "Colors",
      modal: true,
      width: 450,
      position: ['center', 100],
      buttons: {
        save: colorSave,
        reset: function() {
          $("#colorsJSON").val(JSON.stringify(defaultPallete));
        },
        cancel: function() {
          $(this).dialog("close");
        }
      },
      beforeClose: function() {
        $("body").addClass("noSelect");
      }
    });
    $("#colorsJSON")[0].focus();
    $("#colorsJSON")[0].select();
  });
  
  // horizontal scroll
  function hScrollTo(e) {
    if (textWidth <= view.width) {
      return;
    }
    var maxXScroll = $easel.width() - scrollbarWidth;
    var sliderX = e.clientX - (scrollbarWidth / 2);
    sliderX = sliderX < 0 ? 0 : sliderX;
    sliderX = sliderX > maxXScroll ? maxXScroll : sliderX;
    var newX = Math.round((sliderX / maxXScroll) * (textWidth - view.width));
    $("#hScrollHandle").css("left", sliderX);
    view.x = newX;
    draw();
  }
  
  // vertical scroll
  function vScrollTo(e) {
    if (text.length <= view.height) {
      return;
    }
    var maxYScroll = $easel.height() - scrollbarHeight;
    var sliderY = e.clientY - (scrollbarHeight / 2);
    sliderY = sliderY < 0 ? 0 : sliderY;
    sliderY = sliderY > maxYScroll ? maxYScroll : sliderY;
    var newY = Math.round((sliderY / maxYScroll) * (text.length - view.height));
    $("#vScrollHandle").css("top", sliderY);
    view.y = newY;
    draw();
  }

  // scrolling
  function stopScroll() {
    $(this).data("vScroll", false);
    $(this).data("hScroll", false);
  }
  $(document).mousedown(function(e) {
    if (e.target.getAttribute("id") === "vScrollHandle") {
      vScrollTo(e);
      $(this).data("vScroll", true);
    }
    else if (e.target.getAttribute("id") === "hScrollHandle") {
      hScrollTo(e);
      $(this).data("hScroll", true);
    }
  })
  .mousemove(function(e) {
    if ($(this).data("vScroll") === true) {
      vScrollTo(e);
    }
    else if ($(this).data("hScroll") === true) {
      hScrollTo(e);
    }
  })
  .mousewheel(function(e, delta) {
    e.preventDefault();
    
    // detect horizontal scroll
    var horizontalScroll = false;
    if ((e.originalEvent.wheelDeltaX &&
         e.originalEvent.wheelDeltaX !== 0) || // chrome
        e.originalEvent.axis === 1) { // firefox
      horizontalScroll = true;
    }

    delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
    
    var maxScroll;
    var newPos;
    var newPosPixels;
    if (horizontalScroll) {
      for (i = 0; i < (view.width / 10); i++) {
        maxScroll = $easel.width() - scrollbarWidth;
        newPos = view.x - delta;
        if (newPos >= 0 && newPos < textWidth - view.width + 1) {
          view.x = newPos;
          newPosPixels = Math.round((newPos /
                        (textWidth - view.width)) * maxScroll);
          $("#hScrollHandle").css("left", newPosPixels);
        }
      }
      draw();
    }
    else {
      for (i = 0; i < (view.height / 10); i++) {
        maxScroll = $easel.height() - scrollbarHeight;
        newPos = view.y - delta;
        if (newPos >= 0 && newPos < text.length - view.height + 1) {
          view.y = newPos;
          newPosPixels = Math.round((newPos /
                        (text.length - view.height)) * maxScroll);
          $("#vScrollHandle").css("top", newPosPixels);
        }
      }
      draw();
    }
  })
  .mouseup(stopScroll);
  $("#vScroll").mousedown(function(e) {
    vScrollTo(e);
    $(document).data("vScroll", true);
  });
  $("#hScroll").mousedown(function(e) {
    hScrollTo(e);
    $(document).data("hScroll", true);
  });
  
  // undo / redo
  function highlight($button, className) {
    if (!$button.hasClass(className)) {
      $button.addClass(className);
      window.setTimeout(function() {
        $button.removeClass(className);
      }, 100);
    }
  }
  $("#undo").prop("disabled", true)
  .click(function() {
    var frame;
    if (undoStack.length > 0) {
      frame = undoStack.pop();
      redoStack.push(text);
      text = frame;
      updateTextWidth();
      draw();
      $("#redo").prop("disabled", false);
      if (undoStack.length === 0) {
        $(this).prop("disabled", true);
      }
    }
  });
  $("#redo").prop("disabled", true)
  .click(function() {
    if (redoStack.length > 0) {
      var frame = redoStack.pop();
      undoStack.push(text);
      text = frame;
      updateTextWidth();
      draw();
      $("#undo").prop("disabled", false);
      if (redoStack.length === 0) {
        $(this).prop("disabled", true);
      }
    }
  });
  
  // show shortcuts dialog
  $("#shortcutsDialog").hide();
  $("#shortcuts").click(function(e) {
    e.preventDefault();
    $("#shortcutsDialog").dialog({
      title: "Shortcuts",
      modal: true,
      width: 500,
      position: ['center', 'center'],
      buttons: {
        done: function() {
          $(this).dialog("close");
        }
      }
    });
  });
  
  // update canvas font size
  function setFontSize() {
    if (view.scale > 10) {
      ctx.font = (view.scale - 3) + "pt Arial";
    }
    else {
      ctx.font = (view.scale) + "pt Arial";
    }
  }
  
  // window resize
  $(window).resize(function(e) {
    view.x = 0;
    view.y = 0;
    
    var newWidthPixels = $(window).width() - MENU_WIDTH - scrollbarSize;
    var newWidthTiles = Math.floor(newWidthPixels / view.scale);
    
    var newHeightPixels = $(window).height() - scrollbarSize;
    var newHeightTiles = Math.floor(newHeightPixels / view.scale);
    
    if (textWidth <= newWidthTiles) {
      newHeightTiles++;
      newHeightPixels += view.scale;
    }
    if (text.length <= newHeightTiles) {
      newWidthTiles++;
      newWidthPixels += view.scale;
    }
    
    $("#hScroll").width(newWidthPixels)
    .css("top", newHeightPixels);
    view.width = newWidthTiles;
    scrollbarWidth = newWidthPixels * (view.width / textWidth);
    $("#hScrollHandle").css("left", 0)
    .width(scrollbarWidth);
    
    $("#vScroll").height(newHeightPixels)
    .css("left", newWidthPixels);
    view.height = newHeightTiles;
    scrollbarHeight = newHeightPixels * (view.height / text.length);
    $("#vScrollHandle").css("top", 0)
    .height(scrollbarHeight);
    
    $("#easel").remove();
    $("body").append("<canvas id='easel" + 
                           "' width='" + (newWidthPixels) +
                           "' height='" + (newHeightPixels) +
                           "'></canvas>");
    $easel = $("#easel");
    ctx = $easel[0].getContext("2d");
    setFontSize();
    draw();
    showHideScrollBars();
  })
  .resize();
  
  // zoom
  $("#zoom").slider({
    min: 5,
    max: 40,
    step: 1,
    value: 20,
    slide: function(e, ui) {
      view.scale = ui.value;
      view.x = 0;
      view.y = 0;
      $(window).resize();
      setFontSize();
      draw();
    }
  });
  
});