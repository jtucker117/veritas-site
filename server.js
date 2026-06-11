// Minimal static file server for the Veritas site.
// Railway sets process.env.PORT automatically.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static files (HTML, CSS, JS, images) from this folder.
app.use(express.static(__dirname, { extensions: ['html'] }));

// Default route -> home page.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Veritas site running on port ${PORT}`);
});
