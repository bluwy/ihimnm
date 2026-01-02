#!/usr/bin/env node

// @ts-check
import fs from 'node:fs'
import path from 'node:path'

const user = getUser()
const isRecursive = process.argv.includes('-r')
const ignoredFileNameRe = /^(\.|node_modules|dist|build|output|cache)/
const maxNestedDepth = 10
/** @type {Map<string, number>} */
const allFoundDeps = new Map()
const cwd = process.cwd()

// If not recursive, use closest package.json
if (!isRecursive) {
  const packageJsonPath = findClosestPkgJsonPath(cwd)
  if (!packageJsonPath) {
    console.error(`No closest package.json found from ${cwd}`)
    process.exit(1)
  }

  crawlDependencies(packageJsonPath, [], logDep, true)
}
// If recursive, use nested package.json from cwd
else {
  const packageJsonPaths = findNestedPkgJsonPathsFromDir(cwd)
  if (!packageJsonPaths.length) {
    console.error(`No nested package.json found from ${cwd}`)
    process.exit(1)
  }

  for (const packageJsonPath of packageJsonPaths) {
    let hasLogged = false
    const _logDep = (/** @type {string[]} */ depPath) => {
      if (!hasLogged) {
        console.log(`${packageJsonPath}:`)
        hasLogged = true
      }
      logDep(depPath)
    }

    crawlDependencies(packageJsonPath, [], _logDep, true, packageJsonPaths)
  }
}

if (allFoundDeps.size) {
  console.log(`Summary of all found dependencies:`)
  const sortedDepNames = Array.from(allFoundDeps.keys()).sort()
  const padNum = sortedDepNames.length.toString().length + 1
  for (let i = 0; i < sortedDepNames.length; i++) {
    const depName = sortedDepNames[i]
    const numStr = styleText('dim', `${i + 1}.`.padStart(padNum))
    const depNum = allFoundDeps.get(depName) || 0
    console.log(`${numStr} ${styleText('red', depName)} ${styleText('dim', `(${depNum})`)}`)
  }
} else {
  console.log(styleText('green', 'None found!'))
}

/**
 * @param {string} pkgJsonPath
 * @param {string[]} parentDepNames
 * @param {(depPath: string[]) => void} onMatch
 * @param {boolean} isRoot
 * @param {string[]} skipPaths
 */
function crawlDependencies(pkgJsonPath, parentDepNames, onMatch, isRoot = false, skipPaths = []) {
  const pkgJsonContent = fs.readFileSync(pkgJsonPath, 'utf8')
  const pkgJson = JSON.parse(pkgJsonContent.trim()) // trim to remove BOM if any
  const pkgDependencies = Object.keys(pkgJson.dependencies || {})

  if (isRoot) {
    pkgDependencies.push(...Object.keys(pkgJson.devDependencies || {}))
  }
  // use very lax technique to detect:
  // - from github url
  // - from contributors list
  // - from @.../eslint-config dev dep
  else if (pkgJsonContent.includes(user)) {
    onMatch(parentDepNames.concat(pkgJson.name))
    const foundCount = allFoundDeps.get(pkgJson.name) || 0
    allFoundDeps.set(pkgJson.name, foundCount + 1)
  }

  for (const depName of pkgDependencies) {
    // Prevent dep loop
    if (parentDepNames.includes(depName)) continue

    const depPkgJsonPath = findPkgJsonPath(depName, path.dirname(pkgJsonPath))
    if (!depPkgJsonPath) continue
    if (skipPaths.includes(depPkgJsonPath)) continue

    const nestedFound = crawlDependencies(
      depPkgJsonPath,
      isRoot ? [] : parentDepNames.concat(pkgJson.name),
      onMatch,
      false,
      skipPaths
    )
  }
}

/**
 * @param {string} dir
 */
function findClosestPkgJsonPath(dir) {
  while (dir) {
    const pkg = path.join(dir, 'package.json')
    try {
      if (fs.existsSync(pkg)) {
        return pkg
      }
    } catch {}
    const nextDir = path.dirname(dir)
    if (nextDir === dir) break
    dir = nextDir
  }
  return undefined
}

/**
 * @param {string} pkgName
 * @param {string} basedir
 */
function findPkgJsonPath(pkgName, basedir) {
  while (basedir) {
    const pkg = path.join(basedir, 'node_modules', pkgName, 'package.json')
    try {
      if (fs.existsSync(pkg)) {
        return fs.realpathSync(pkg)
      }
    } catch {}
    const nextBasedir = path.dirname(basedir)
    if (nextBasedir === basedir) break
    basedir = nextBasedir
  }
  return undefined
}

/**
 * @param {string} dir
 */
function findNestedPkgJsonPathsFromDir(dir, currentDepth = 0) {
  /** @type {string[]} */
  const pkgJsonPaths = []
  const files = fs.readdirSync(dir)
  for (const file of files) {
    if (!ignoredFileNameRe.test(file)) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat.isFile() && file === 'package.json') {
        pkgJsonPaths.push(filePath)
      } else if (stat.isDirectory() && currentDepth < maxNestedDepth) {
        pkgJsonPaths.push(...findNestedPkgJsonPathsFromDir(filePath, currentDepth + 1))
      }
    }
  }
  return pkgJsonPaths
}

function getUser() {
  const userIndex = process.argv.indexOf('-u')
  if (userIndex !== -1 && process.argv.length > userIndex + 1) {
    return process.argv[userIndex + 1]
  }
  return atob('bGpoYXJi')
}

/**
 * @param {string[]} depPath
 */
function logDep(depPath) {
  const parents = depPath.slice(0, -1)
  const child = depPath[depPath.length - 1]
  console.log(styleText('dim', parents.map((n) => n + ' > ').join('')) + styleText('red', child))
}

/**
 * Import from `node:util` in the future when bumping required node version
 * @param {string | string[]} color
 * @param {string} str
 */
function styleText(color, str) {
  /** @type {Record<string, string>} */
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
  }
  const reset = '\x1b[0m'
  const prefix = Array.isArray(color)
    ? color.map((c) => colors[c] || '').join('')
    : colors[color] || ''
  return `${prefix}${str}${reset}`
}
