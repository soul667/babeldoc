const fs = require('node:fs')
const path = require('node:path')

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
  // 读文件
  readFile(file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  },
  // 文本写入到下载目录
  writeTextFile(text) {
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.txt')
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  // 图片写入到下载目录
  writeImageFile(base64Url) {
    const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
    if (!matchs) return
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.' + matchs[1])
    fs.writeFileSync(filePath, base64Url.substring(matchs[0].length), { encoding: 'base64' })
    return filePath
  },
  // 获取系统信息
  getOSInfo() {
    const os = require('node:os')
    return { arch: os.arch(), cpus: os.cpus(), release: os.release() }
  },
  // 颜色处理
  colord(text) {
    const { getFormat, colord } = require('colord')
    const fmt = getFormat(text)
    if (!fmt) {
      return [null, '请输入一个有效的颜色值，比如 #000 或 rgb(0,0,0)']
    } else {
      const darkColor = colord(text).darken(0.1).toHex()
      return [darkColor, null]
    }
  },
  // 复制图片
  copyImage(imageFilePath) {
    const { clipboard, nativeImage } = require('electron')
    clipboard.writeImage(nativeImage.createFromPath(imageFilePath))
  },
  // 读取配置文件
  readConfigFile() {
    const fs = require('node:fs')
    const path = require('node:path')
    const configPath = path.join(window.utools.getPath('userData'), 'babeldoc.toml')
    if (fs.existsSync(configPath)) {
      return fs.readFileSync(configPath, 'utf-8')
    }
    return ''
  },
  // 写入配置文件
  writeConfigFile(content) {
    const fs = require('node:fs')
    const path = require('node:path')
    const configPath = path.join(window.utools.getPath('userData'), 'babeldoc.toml')
    fs.writeFileSync(configPath, content, 'utf-8')
    return configPath
  },
  // 运行 babeldoc
  runBabeldoc(options, callback) {
    const { spawn } = require('node:child_process')
    const iconv = require('iconv-lite')
    const path = require('node:path')

    const { file, apiKey, model, baseUrl, prompt, ...otherOptions } = options
    const outputDir = path.dirname(file)

    // Base arguments
    const args = [
      '--openai',
      '--openai-model', model,
      '--openai-base-url', baseUrl,
      '--openai-api-key', apiKey,
      '--files', file,
      '-o', outputDir,
      '--custom-system-prompt', prompt,
      '--enable-json-mode-if-requested',

    ]

    // Add other options dynamically
    for (const [key, value] of Object.entries(otherOptions)) {
      // Convert camelCase to kebab-case
      const flag = '--' + key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())

      if (typeof value === 'boolean') {
        if (value) {
          args.push(flag)
        }
      } else if (value !== undefined && value !== null && value !== '') {
        args.push(flag, String(value))
      }
    }

    // Ensure local bin path is in PATH
    const localBinPath = path.join(require('os').homedir(), '.local', 'bin')
    const env = { ...process.env, PATH: `${process.env.PATH}${path.delimiter}${localBinPath}` }

    console.log('Running babeldoc with args:', args) // Debug log

    const child = spawn('babeldoc', args, { shell: false, env })

    child.stdout.on('data', (data) => {
      callback({ type: 'stdout', data: iconv.decode(data, 'cp936') })
    })

    child.stderr.on('data', (data) => {
      callback({ type: 'stderr', data: iconv.decode(data, 'cp936') })
    })

    child.on('close', (code) => {
      callback({ type: 'close', code })
    })

    return child.pid
  }
}
