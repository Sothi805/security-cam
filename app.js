const express = require('express');
const path = require('path');

const app = express();

const streamRouter = require('./routes/stream');
app.use('/streams', streamRouter);

// Already present if you're serving HLS:
app.use('/hls', express.static(path.join(__dirname, process.env.HLS_FOLDER || 'hls'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.m3u8')) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (path.endsWith('.ts')) {
      res.set('Content-Type', 'video/mp2t');
    }
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
