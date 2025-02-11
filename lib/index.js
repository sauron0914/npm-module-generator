const spawn = require('cross-spawn')
const fs = require('fs')
const readline = require('readline')
const chalk = require('chalk')
const {
  dealArgs,
  getGeneratorTypes,
  getFile,
  resolve,
  question,
  dirFlat,
  mkDir,
  dealSpawnProcess,
} = require('./utils')

const args = dealArgs(getGeneratorTypes())

if (args.cmd) {
  console.log(
    `Version is ${
      getFile(require, resolve(__dirname, '../package.json')).version
    }`,
  )
} else {
  const cwd = process.cwd()
  const root = resolve(cwd, args.moduleName || '')

  if (args.moduleName && fs.existsSync(root)) {
    throw new Error(`${args.moduleName} already exists!`)
  }

  const packageJson = fs.existsSync(resolve(root, 'package.json'))
    ? getFile(require, resolve(root, 'package.json'))
    : { name: args.moduleName }
  const { generatorType } = args
  const plugin = getFile(require, generatorType.path)
  const generatorOptions = plugin.options(packageJson)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log(chalk.yellow('>  Input, press ^C at any time to quit.\n\r'))
  let pro = Object.keys(generatorOptions).reduce(
    (pre, key) =>
      pre.then(
        () =>
          new Promise(res => {
            const item = generatorOptions[key]
            const def = item.defaultVal
              ? `${item.defaultVal.call(generatorOptions, __dirname)}`
              : ''
            question(rl, item, key, def, res)
          }),
      ),
    Promise.resolve(),
  )

  pro = pro
    .then(() => rl.close())
    .then(() => {
      console.log(chalk.yellow('\n\r>  Start to create directories\n\r'))
      return Promise.all(
        dirFlat(generatorType.template).map(
          filename =>
            new Promise((res, rej) => {
              const path = resolve(
                root,
                `.${filename
                  .split(generatorType.template)[1]
                  .replace('.example', '')}`,
              )
              if (!fs.existsSync(path)) {
                fs.readFile(filename, { encoding: 'utf-8' }, (err, data) => {
                  if (err) rej(err)
                  const d = Object.keys(generatorOptions).reduce((pre, key) => {
                    const item = generatorOptions[key]
                    return pre.replace(item.replace, item.value)
                  }, data)
                  mkDir(path)
                  fs.writeFile(path, d, { encoding: 'utf-8' }, e => {
                    if (e) rej(e)
                    console.log(
                      chalk.cyan(
                        `>> '${filename
                          .split(generatorType.template)[1]
                          .replace('.example', '')}': `,
                      ),
                      chalk.greenBright('created'),
                    )
                    res()
                  })
                })
              } else {
                res()
              }
            }),
        ),
      ).then(() => console.log('\n\r Directories Done\n\r\n\r'))
    })

  const spawnConf = {
    cwd: root,
    stdio: 'inherit',
  }

  pro = pro.then(() => {
    console.log(
      chalk.yellow(
        '> Git init, make sure that you already installed Git globally',
      ),
    )
    dealSpawnProcess(spawn.sync('git', ['init', '-q'], spawnConf))

    if (generatorOptions.repository && generatorOptions.repository.value) {
      dealSpawnProcess(
        spawn.sync(
          'git',
          ['remote', 'add', 'origin', generatorOptions.repository.value],
          spawnConf,
        ),
      )
    }
    console.log('\n\r Git init done\n\r\n\r')
  })

  pro = pro.then(() => {
    console.log(chalk.yellow('>  Start to install module:\n\r'))
    console.log('>> npm i')
    dealSpawnProcess(spawn.sync('npm', ['i'], spawnConf))
    console.log('\n\r Done\n\r\n\r')
  })

  pro.catch(e => console.error(e))
}
