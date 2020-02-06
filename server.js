const path = require('path');
const express = require('express');
const watch = require('watch');
const http = require('http');
const reload = require('reload');
let app = express();

let distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.set('port', 4000);

app.get("/", (req, res) => {
  res.sendFile(path.join(distPath, index.html));
});

let server = http.createServer(app);

reload(app).then((reloadReturned) => {
  // Reload started, start web server
  server.listen(app.get('port'), function () {
    console.log('Web server listening on port ' + app.get('port'));

    watch.watchTree(path.resolve(__dirname, 'dist'), function (f, curr, prev) {
      console.log('Tree changed, reloading browser');
      // Fire server-side reload event
      reloadReturned.reload();
    });
  });
});