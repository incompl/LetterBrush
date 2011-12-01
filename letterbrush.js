$(function() {
  
  var i, j;
  
  var currentMode = "pencil";
  
  var currentChar = "G";
  
  var view = {
    scale: 20, // pixels per char
    x: 0,
    y: 0,
    width: 40,
    height: 30
  };
  
  var interaction = {
    dragging: false
  };
  
  var text = [];
  
  // generate test data
  text.push([]);
  for (i = 0; i < 300; i++) {
    text[i] = [];
    for (j = 0; j < 300; j++) {
      text[i][j] = ".";
    }
  }
  
  var $easel = $("#easel");
  
  var ctx = $easel[0].getContext("2d");
  ctx.font = "20pt Arial";

  var Mode = {
    mouseup: $.noop,
    mousemove: $.noop,
    mousedown: $.noop
  };

  // different draw modes
  var mode = {
    
    // normal drawing tool
    pencil: inherit(Mode, {
      mousemove: function(row, col) {
        text[col][row] = currentChar;
        draw();
      },
      mouseup: function(row, col) {
        text[col][row] = currentChar;
        draw();
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
            ctx.fillRect(this.x * view.scale,
                       this.y * view.scale,
                       view.scale,
                       view.scale);
					});

          // render a line
          ctx.strokeStyle = "rgba(0, 150, 0, .8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1 * view.scale + view.scale / 2,
                     y1 * view.scale + view.scale / 2);
          ctx.lineTo(x2 * view.scale + view.scale / 2,
                     y2 * view.scale + view.scale / 2);
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
      mousedown: function(row, col) {
        
      },
      mousemove: function(row, col) {
        draw();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.strokeRect(interaction.originalRow * view.scale,
                     interaction.originalCol * view.scale,
                     (row - interaction.originalRow) * view.scale,
                     (col - interaction.originalCol) * view.scale);
      },
      mouseup: function(row, col) {
        var startX = 0;
        var startY = 0;
        var widthX = 0;
        var widthY = 0;
        if (row > interaction.originalRow &&
            col > interaction.originalCol) {
          startX = interaction.originalRow;
          startY = interaction.originalCol;
          widthX = row;
          widthY = col;
        }
        else if (row < interaction.originalRow &&
                 col < interaction.originalCol) {
          startX = row;
          startY = col;
          widthX = interaction.originalRow;
          widthY = interaction.originalCol;
        }
        else if (row > interaction.originalRow &&
                 col < interaction.originalCol) {
          startX = interaction.originalRow;
          startY = col;
          widthX = row;
          widthY = interaction.originalCol;
        }
        else if (row < interaction.originalRow &&
                 col > interaction.originalCol) {
          startX = row;
          startY = interaction.originalCol;
          widthX = interaction.originalRow;
          widthY = col;
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
  $easel.mousedown(function(e) {
    interaction = {};
    var row = Math.round(e.clientX / view.scale);
    var col = Math.round(e.clientY / view.scale);
    interaction.originalRow = row;
    interaction.originalCol = col;
    interaction.dragging = true;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mousedown(row, col);
    }
  })
  .mousemove(function(e) {
    if (!interaction.dragging) {
      return;
    }
    var row = Math.floor(e.clientX / view.scale) - view.x;
    var col = Math.floor(e.clientY / view.scale) - view.y;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mousemove(row, col);
    }
  })
  .mouseup(function(e) {
    var row = Math.floor(e.clientX / view.scale);
    var col = Math.floor(e.clientY / view.scale);
    interaction.dragging = false;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mouseup(row, col);
    }
  });
  
  // render out the current text data
  var currentRow = 0;
  var currentCol = 0;
  function draw() {
    var color;
    ctx.clearRect(0, 0, view.width * view.scale, view.height * view.scale);
    for (currentRow = 0; currentRow < view.height; currentRow++) {
      var row = text[currentRow];
      if (!row) {
        continue;
      }
      for (currentCol = 0; currentCol < view.width; currentCol++) {
        if (!row[currentCol]) {
          continue;
        }
        color = (row[currentCol].charCodeAt(0) - 48) * 3;
        color = color < 0 ? 0 : color;
        color = color > 360 ? 360 : color;
        ctx.fillStyle = "hsl(" + color + ",100%,30%)";
        ctx.fillText(row[currentCol],
                     (view.x + currentCol) * view.scale,
                     (view.y + currentRow + 1) * view.scale);
      }
    }
  }
  draw();
  
  // pick key to draw by typing it
  $(document).keydown(function(e) {
    var key = keyDecode(e);
    if (key.length === 1) {
      currentChar = key;
      $("#currentChar").text(key);
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
  $("#import").click(function() {
    $("#importDialog").dialog({
      title: "Import",
      modal: true,
      buttons: {
        'import': function() {
          text = [];
          var importStr = $("#importText").val();
          $.each(importStr.split(/\n/), function() {
            var row = [];
            text.push(row);
            $.each(this.split(""), function() {
              row.push(this);
            });
          });
          draw();
          $(this).dialog("close");
        },
        cancel: function() {
          $(this).dialog("close");
        }
      }
    });
  });
  
  // export
  $("#exportDialog").hide();
  $("#export").click(function() {
    var $exportDialog = $("#exportDialog");
    var $exportText = $("#exportText");
    var $progress = $("<div></div>");
    $exportDialog.append($progress);
    $progress.progressbar({value: 0});
    $exportText.text("").hide();
    $exportDialog.dialog({
      title: "Export",
      modal: true,
      width: 450,
      buttons: {
        done: function() {
          $(this).dialog("close");
        }
      }
    });
    i = 0;
    setTimeout(function exportLine() {
      $exportText.append("<div>" + text[i].join("") + "</div>");
      $progress.progressbar("option", "value", i / text.length * 100);
      i++;
      if (i < text.length) {
        setTimeout(exportLine, 0);
      }
      else {
        $progress.remove();
        $exportText.show();
      }
    }, 0);
  });
  
  // horizontal scroll
  $("#hScroll").click(function(e) {
    var newX = 1 - Math.round((e.clientX / 800) * text[0].length / view.scale);
    console.log(newX);
    $("#hScrollHandle").css("left", e.clientX - 15);
    view.x = newX;
    draw();
  });
  
});