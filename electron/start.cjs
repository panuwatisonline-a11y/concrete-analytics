// Launcher that removes ELECTRON_RUN_AS_NODE before starting Electron
const { spawn } = require('child_process')
const path = require('path')

const electronPath = require('electron')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const proc = spawn(electronPath, [path.join(__dirname, '..')], {
  stdio: 'inherit',
  env,
})

proc.on('close', (code) => process.exit(code || 0))
