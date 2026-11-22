import { randomBytes, scryptSync } from 'node:crypto'

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
  console.error('Run this script in an interactive terminal so the password is not echoed.')
  process.exit(1)
}

process.stdout.write('Enter a new admin password: ')
process.stdin.setRawMode(true)
process.stdin.resume()
let password = ''
process.stdin.on('data', (chunk) => {
  for (const char of chunk.toString('utf8')) {
    if (char === '\u0003') process.exit(130)
    if (char === '\r' || char === '\n') {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      const salt = randomBytes(16)
      const hash = scryptSync(password, salt, 64)
      process.stdout.write(`\nSet this server environment variable (no password is included):\nADMIN_PASSWORD_HASH=scrypt$${salt.toString('hex')}$${hash.toString('hex')}\n`)
      password = ''
      return
    }
    if (char === '\u007f' || char === '\b') password = password.slice(0, -1)
    else password += char
  }
})
