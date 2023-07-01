#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const packageJsonPath = findClosestPkgJsonPath(process.cwd())
if (!packageJsonPath) {
  console.error(`No closest package.json found from ${process.cwd()}`)
  process.exit(1)
}

crawlDependencies(packageJsonPath, [], true)

/**
 * @param {string} pkgJsonPath
 * @param {string[]} parentDepNames
 * @param {boolean} isRoot
 */
function crawlDependencies(pkgJsonPath, parentDepNames, isRoot = false) {
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
  }

  for (const depName of pkgDependencies) {
    const depPkgJsonPath = findPkgJsonPath(depName, path.dirname(pkgJsonPath))
    crawlDependencies(
      depPkgJsonPath,
      isRoot ? [] : parentDepNames.concat(pkgJson.name)
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
 * @param {string} depName
 * @param {string} parentPackageNames
 */
function logDep(depName, parentPackageNames) {
  console.log(`${parentPackageNames.join(' > ')} > ${highlight(depName)}`)
}

/**
 * @param {string} str
 */
function highlight(str) {
  return `\x1b[1m\x1b[31m${str}\x1b[0m`
}
