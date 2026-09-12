const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const JSZip = require('jszip');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "WaveConvert — Audio Cutter & Converter",
    backgroundColor: "#040509",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Format conversion flags for native FFmpeg
const CODEC_ARGS = {
  mp3:  ['-c:a', 'libmp3lame', '-b:a', '256k'],
  flac: ['-c:a', 'flac'],
  ogg:  ['-c:a', 'libvorbis', '-q:a', '6'],
  opus: ['-c:a', 'libopus', '-b:a', '128k'],
  m4a:  ['-c:a', 'aac', '-b:a', '192k'],
  alac: ['-c:a', 'alac'],
  aiff: ['-c:a', 'pcm_s16be'],
  wav:  ['-c:a', 'pcm_s16le']
};

ipcMain.handle('convert-audio', async (event, { wavArrayBuffer, format, filename }) => {
  const tempDir = os.tmpdir();
  const inPath = path.join(tempDir, `waveconvert_in_${Date.now()}.wav`);
  const outExt = (format === 'alac') ? 'm4a' : format;
  const outPath = path.join(tempDir, `waveconvert_out_${Date.now()}.${outExt}`);

  // Write incoming trimmed WAV buffer to temp disk
  fs.writeFileSync(inPath, Buffer.from(wavArrayBuffer));

  const args = ['-y', '-i', inPath, ...(CODEC_ARGS[format] || CODEC_ARGS.wav), outPath];

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, async (err) => {
      try { fs.unlinkSync(inPath); } catch(e){}

      if (err) {
        try { fs.unlinkSync(outPath); } catch(e){}
        return reject(new Error('Conversion failed: ' + err.message));
      }

      // Prompt user where to save the file
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `${filename}.${outExt}`,
        filters: [{ name: format.toUpperCase(), extensions: [outExt] }]
      });

      if (!canceled && filePath) {
        fs.copyFileSync(outPath, filePath);
        try { fs.unlinkSync(outPath); } catch(e){}
        resolve({ success: true, savedPath: filePath });
      } else {
        try { fs.unlinkSync(outPath); } catch(e){}
        resolve({ success: false, canceled: true });
      }
    });
  });
});

// Batch export as ZIP
ipcMain.handle('save-batch-zip', async (event, { files }) => {
  const tempDir = os.tmpdir();
  const zip = new JSZip();

  for (let item of files) {
    const inPath = path.join(tempDir, `batch_in_${Date.now()}_${Math.random()}.wav`);
    const outExt = (item.format === 'alac') ? 'm4a' : item.format;
    const outPath = path.join(tempDir, `batch_out_${Date.now()}_${Math.random()}.${outExt}`);

    fs.writeFileSync(inPath, Buffer.from(item.wavArrayBuffer));
    const args = ['-y', '-i', inPath, ...(CODEC_ARGS[item.format] || CODEC_ARGS.wav), outPath];

    await new Promise((resolve) => {
      execFile(ffmpegPath, args, () => {
        try { fs.unlinkSync(inPath); } catch(e){}
        if (fs.existsSync(outPath)) {
          zip.file(`${item.filename}.${outExt}`, fs.readFileSync(outPath));
          try { fs.unlinkSync(outPath); } catch(e){}
        }
        resolve();
      });
    });
  }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'waveconvert_batch_export.zip',
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
  });

  if (!canceled && filePath) {
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(filePath, zipBuffer);
    return { success: true };
  }
  return { success: false, canceled: true };
});