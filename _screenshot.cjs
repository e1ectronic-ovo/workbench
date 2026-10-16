// Screenshot the preview HTML using a vanilla CDP approach via the bundled Electron.
// Electron has Chromium + Node, so we use the BrowserWindow + capturePage API.

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('no-sandbox')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      offscreen: false,
      sandbox: false,
      contextIsolation: true
    }
  })

  await win.loadURL('file:///F:/%E4%B8%AA%E4%BA%BA%E9%A1%B9%E7%9B%AE/workbench/preview.html')

  // Wait for layout to settle
  await new Promise((r) => setTimeout(r, 1500))

  const image = await win.webContents.capturePage()
  const out = 'F:\\个人项目\\workbench\\preview.png'
  fs.writeFileSync(out, image.toPNG())
  console.log('Saved', out, image.getSize())

  app.quit()
})
