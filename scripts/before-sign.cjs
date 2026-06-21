/**
 * electron-builder afterPack hook — prepare macOS bundles for distribution.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context
  if (electronPlatformName !== 'darwin') return

  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  const adhocScript = path.join(__dirname, 'adhoc-sign-mac-app.sh')

  console.log(`Clearing extended attributes in ${appOutDir}...`)
  execSync(`dot_clean -m "${appOutDir}"`, { stdio: 'inherit' })
  execSync(`xattr -cr "${appOutDir}"`, { stdio: 'inherit' })

  const signingDisabled =
    process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false' || !process.env.CSC_NAME

  if (!signingDisabled) return

  if (process.env.SKIP_AFTERPACK_SIGN === '1') {
    console.log('Skipping afterPack ad-hoc sign (handled by sign-and-dmg-mac-app.sh)')
    return
  }

  console.log('Ad-hoc signing unsigned Clarifi.app for local distribution...')
  execSync(`bash "${adhocScript}" "${appPath}"`, { stdio: 'inherit' })
  execSync(`codesign --verify --deep "${appPath}"`, { stdio: 'inherit' })
}
