#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const isRecursive = process.argv.includes('-r')
const ignoredFileNameRe = /^(\.|node_modules|dist|build|output|cache)/
const maxNestedDepth = 10
/** @type {Map<string, number>} */
const allFoundDeps = new Map()

// If not recursive, use closest package.json
if (!isRecursive) {
  const packageJsonPath = findClosestPkgJsonPath(process.cwd())
  if (!packageJsonPath) {
    console.error(`No closest package.json found from ${process.cwd()}`)
    process.exit(1)
  }

  const found = crawlDependencies(packageJsonPath, [], true)
  if (!found) console.log(green('None found!'))
}
// If recursive, use nested package.json from cwd
else {
  const packageJsonPaths = findNestedPkgJsonPathsFromDir(process.cwd())
  if (!packageJsonPaths.length) {
    console.error(`No nested package.json found from ${process.cwd()}`)
    process.exit(1)
  }

  for (const packageJsonPath of packageJsonPaths) {
    console.log(`${packageJsonPath}:`)
    const found = crawlDependencies(packageJsonPath, [], true)
    if (!found) console.log(green('None found!'))
  }
}

if (allFoundDeps.size) {
  console.log(`Summary of all found dependencies:`)
  const sortedDepNames = Array.from(allFoundDeps.keys()).sort()
  const padNum = sortedDepNames.length.toString().length + 1
  for (let i = 0; i < sortedDepNames.length; i++) {
    const depName = sortedDepNames[i]
    const numStr = dim(`${i + 1}.`.padStart(padNum))
    console.log(
      `${numStr} ${red(depName)} ${dim(`(${allFoundDeps.get(depName)})`)}`
    )
  }
}

/**
 * @param {string} pkgJsonPath
 * @param {string[]} parentDepNames
 * @param {boolean} isRoot
 */
function crawlDependencies(pkgJsonPath, parentDepNames, isRoot = false) {
  let found = false
  const pkgJsonContent = fs.readFileSync(pkgJsonPath, 'utf8')
  const pkgJson = JSON.parse(pkgJsonContent)
  const pkgDependencies = Object.keys(pkgJson.dependencies || {})

  if (isRoot) {
    pkgDependencies.push(...Object.keys(pkgJson.devDependencies || {}))
  }
  // use very lax technique to detect:
  // - from github url
  // - from contributors list
  // - from @.../eslint-config dev dep
  else if (pkgJsonContent.includes('ljharb')) {
    logDep(pkgJson.name, parentDepNames)
    found = true
    const foundCount = allFoundDeps.get(pkgJson.name) || 0
    allFoundDeps.set(pkgJson.name, foundCount + 1)
  }

  for (const depName of pkgDependencies) {
    // Prevent dep loop
    if (parentDepNames.includes(depName)) continue

    const depPkgJsonPath = findPkgJsonPath(depName, path.dirname(pkgJsonPath))
    if (!depPkgJsonPath) continue

    const nestedFound = crawlDependencies(
      depPkgJsonPath,
      isRoot ? [] : parentDepNames.concat(pkgJson.name)
    )

    found = found || nestedFound
  }

  return found
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
        pkgJsonPaths.push(
          ...findNestedPkgJsonPathsFromDir(filePath, currentDepth + 1)
        )
      }
    }
  }
  return pkgJsonPaths
}

/**
 * @param {string} depName
 * @param {string[]} parentPackageNames
 */
function logDep(depName, parentPackageNames) {
  console.log(
    dim(parentPackageNames.map((n) => n + ' > ').join('')) + red(depName)
  )
}

/**
 * @param {string} str
 */
function red(str) {
  return `\x1b[1m\x1b[31m${str}\x1b[0m`
}

/**
 * @param {string} str
 */
function green(str) {
  return `\x1b[1m\x1b[32m${str}\x1b[0m`
}

/**
 * @param {string} str
 */
function dim(str) {
  return `\x1b[2m${str}\x1b[0m`
}
